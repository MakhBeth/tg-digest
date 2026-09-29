import { describe, it, expect, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { existsSync } from 'node:fs'
import { createBridge, parseOrigins, claudeArgs, safeError } from './claude-bridge.mjs'

const ORIGIN = 'http://localhost:5173'

// CLI finta: registra argomenti, cwd e stdin, risponde con `reply` dopo `delay` ms.
function fakeSpawn({ reply = 'ok', code = 0, stderr = '', delay = 0 } = {}) {
  const calls = []
  const spawnImpl = (bin, args, opts) => {
    const child = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.exitCode = null
    const call = { bin, args, cwd: opts.cwd, cwdExisted: existsSync(opts.cwd), input: '', killed: false }
    calls.push(call)
    child.kill = () => { call.killed = true; child.exitCode = 137; setImmediate(() => child.emit('close', 137)) }
    child.stdin.on('data', d => { call.input += d })
    child.stdin.on('end', () => {
      setTimeout(() => {
        if (call.killed) return
        child.stdout.write(reply)
        if (stderr) child.stderr.write(stderr)
        child.exitCode = code
        setImmediate(() => child.emit('close', code))
      }, delay)
    })
    return child
  }
  return { spawnImpl, calls }
}

let server
async function start(opts) {
  server = createBridge({ claudeBin: '/fake/claude', ...opts })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return `http://127.0.0.1:${server.address().port}`
}
afterEach(() => new Promise(r => (server ? server.close(() => r()) : r())))

// `origin: null` = richiesta senza header Origin.
const chat = (url, { origin = ORIGIN, body } = {}) =>
  fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) },
    body: body ?? JSON.stringify({ model: '', messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'ciao' }] }),
  })

describe('claude-bridge', () => {
  it("risponde con il testo della CLI e rimanda solo l'origine ammessa", async () => {
    const { spawnImpl, calls } = fakeSpawn({ reply: 'risposta\n' })
    const url = await start({ spawnImpl })
    const res = await chat(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(await res.json()).toEqual({ choices: [{ message: { role: 'assistant', content: 'risposta' } }] })
    expect(calls[0].input).toBe('ciao')
  })

  it('rifiuta origini non ammesse, "null" e richieste senza Origin senza avviare la CLI', async () => {
    const { spawnImpl, calls } = fakeSpawn()
    const url = await start({ spawnImpl })
    for (const origin of ['https://evil.example', 'null', null]) {
      const res = await chat(url, { origin })
      expect(res.status).toBe(403)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    }
    const pre = await fetch(`${url}/v1/chat/completions`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
    expect(pre.status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it("risponde al preflight solo per un'origine ammessa", async () => {
    const url = await start({ spawnImpl: fakeSpawn().spawnImpl })
    const res = await fetch(`${url}/v1/chat/completions`, { method: 'OPTIONS', headers: { origin: ORIGIN } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
  })

  it('esegue la CLI senza strumenti, MCP e sessioni, in una directory temporanea poi rimossa', async () => {
    const { spawnImpl, calls } = fakeSpawn()
    const url = await start({ spawnImpl })
    await chat(url, { body: JSON.stringify({ model: 'sonnet', messages: [{ role: 'user', content: 'x' }] }) })
    const { args, cwd, cwdExisted } = calls[0]
    expect(args).toEqual(expect.arrayContaining(['--no-session-persistence', '--strict-mcp-config']))
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args.slice(-2)).toEqual(['--model', 'sonnet'])
    expect(cwdExisted).toBe(true)
    expect(cwd).not.toBe(process.cwd())
    expect(existsSync(cwd)).toBe(false)
  })

  it('rifiuta un corpo troppo grande', async () => {
    const { spawnImpl, calls } = fakeSpawn()
    const url = await start({ spawnImpl, maxBody: 100 })
    const res = await chat(url, { body: JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(500) }] }) })
    expect(res.status).toBe(413)
    expect(calls).toHaveLength(0)
  })

  it('rifiuta un modello che la CLI leggerebbe come opzione', async () => {
    const { spawnImpl, calls } = fakeSpawn()
    const url = await start({ spawnImpl })
    const res = await chat(url, { body: JSON.stringify({ model: '--dangerously-skip-permissions', messages: [] }) })
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('serializza le richieste: una sola CLI alla volta', async () => {
    let running = 0
    let peak = 0
    const base = fakeSpawn({ delay: 30 })
    const spawnImpl = (...a) => {
      running++
      peak = Math.max(peak, running)
      const child = base.spawnImpl(...a)
      child.once('close', () => running--)
      return child
    }
    const url = await start({ spawnImpl })
    const results = await Promise.all([chat(url), chat(url), chat(url)])
    expect(results.map(r => r.status)).toEqual([200, 200, 200])
    expect(peak).toBe(1)
  })

  it("termina la CLI quando scade il timeout e non espone segreti nell'errore", async () => {
    const { spawnImpl, calls } = fakeSpawn({ delay: 1000 })
    const url = await start({ spawnImpl, timeoutMs: 20 })
    const res = await chat(url)
    expect(res.status).toBe(500)
    expect(calls[0].killed).toBe(true)

    expect(safeError('x-api-key: sk-ant-segreto')).not.toContain('segreto')
    expect(safeError('a'.repeat(2000))).toHaveLength(500)
  })

  it("termina la CLI quando il client chiude la connessione", async () => {
    const { spawnImpl, calls } = fakeSpawn({ delay: 1000 })
    const url = await start({ spawnImpl })
    const ctrl = new AbortController()
    const pending = fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }),
    }).catch(() => {})
    await new Promise(r => setTimeout(r, 50))
    ctrl.abort()
    await pending
    await new Promise(r => setTimeout(r, 50))
    expect(calls[0].killed).toBe(true)
  })
})

describe('parseOrigins', () => {
  it('usa le origini di sviluppo come default e non ammette "*"', () => {
    expect(parseOrigins(undefined)).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173'])
    expect(parseOrigins('https://tg-digest.home/, http://localhost:4173')).toEqual(['https://tg-digest.home', 'http://localhost:4173'])
    expect(() => parseOrigins('*')).toThrow()
  })
})

describe('claudeArgs', () => {
  it("non passa --model per il valore vuoto o 'claude-code'", () => {
    expect(claudeArgs('', '')).not.toContain('--model')
    expect(claudeArgs('', 'claude-code')).not.toContain('--model')
    expect(claudeArgs('sys', '')).toEqual(expect.arrayContaining(['--append-system-prompt', 'sys']))
  })
})
