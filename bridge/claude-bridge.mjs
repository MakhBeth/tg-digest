// Bridge HTTP locale che espone la CLI "claude" (Claude Code) tramite un'API
// compatibile OpenAI, cosi' l'app puo' usare l'abbonamento Claude Code al posto
// di una chiave API Anthropic separata. Nessuna dipendenza esterna.
//
// Protezioni: ascolta solo su 127.0.0.1, accetta solo le origini in ALLOWED_ORIGINS,
// esegue la CLI senza strumenti ne' MCP in una directory temporanea, senza salvare
// sessioni, una richiesta alla volta e con un limite alla dimensione del corpo.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HOST = '127.0.0.1'
export const DEFAULT_PORT = 11435
export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
export const MAX_BODY = 5 * 1024 * 1024
const MAX_OUTPUT = 20 * 1024 * 1024
const TIMEOUT_MS = 5 * 60 * 1000

// Trova il binario "claude": CLAUDE_BIN, poi PATH, poi le posizioni di installazione
// note (il PATH del processo che avvia il bridge spesso non include ~/.local/bin).
export function findClaudeBin(env = process.env) {
  if (env.CLAUDE_BIN) return env.CLAUDE_BIN
  const home = homedir()
  const candidates = [
    ...(env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => path.join(dir, 'claude')),
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
  return candidates.find(c => existsSync(c)) ?? 'claude'
}

// Origini esatte separate da virgole. "*" non e' ammesso: renderebbe il bridge
// utilizzabile da qualsiasi sito aperto nel browser.
export function parseOrigins(value) {
  if (!value) return DEFAULT_ORIGINS
  const origins = value.split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean)
  if (origins.includes('*')) throw new Error("ALLOWED_ORIGINS non puo' contenere '*'")
  return origins
}

// Argomenti fissi: nessuno strumento, nessun server MCP, nessuna sessione salvata.
export function claudeArgs(system, model) {
  const args = ['-p', '--output-format', 'text', '--no-session-persistence', '--tools', '', '--strict-mcp-config']
  if (system) args.push('--append-system-prompt', system)
  // Modello esplicito solo se indicato: vuoto o 'claude-code' = default del CLI
  if (model && model !== 'claude-code') args.push('--model', model)
  return args
}

// Gli errori tornano al browser: niente segreti, lunghezza limitata.
export function safeError(value) {
  return String(value)
    .replace(/(authorization|x-api-key)\s*[:=][^\r\n]+/gi, '$1: [redacted]')
    .replace(/\bsk-[\w-]+/g, '[redacted]')
    .slice(0, 500)
}

function extractMessages(messages) {
  let system = ''
  const userParts = []
  for (const m of messages ?? []) {
    if (m.role === 'system') {
      system += (system ? '\n' : '') + String(m.content ?? '')
    } else {
      userParts.push(String(m.content ?? ''))
    }
  }
  return { system, user: userParts.join('\n') }
}

function validModel(model) {
  // Un modello che inizia con '-' verrebbe letto dalla CLI come un'opzione.
  return typeof model === 'string' && model.length <= 200 && !model.trim().startsWith('-')
}

function sendJson(res, status, value) {
  if (res.destroyed || res.writableEnded) return
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

function readBody(req, maxBody) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', chunk => {
      if (tooLarge) return
      size += chunk.length
      if (size > maxBody) {
        tooLarge = true
        chunks.length = 0
        reject(Object.assign(new Error('Corpo della richiesta troppo grande'), { status: 413 }))
      } else {
        chunks.push(chunk)
      }
    })
    req.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks).toString('utf8')) })
    req.on('error', reject)
  })
}

function runClaude({ claudeBin, spawnImpl, system, user, model, cwd, timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawnImpl(claudeBin, claudeArgs(system, model), { cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    } catch (err) {
      reject(new Error(`comando 'claude' non trovato nel PATH: ${err.message}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      fn(value)
    }
    const kill = () => { if (child.exitCode === null) child.kill('SIGKILL') }
    const onAbort = () => { kill(); finish(reject, new Error('richiesta annullata dal client')) }

    const timer = setTimeout(() => {
      kill()
      finish(reject, new Error(`timeout dopo ${timeoutMs}ms in attesa della CLI 'claude'`))
    }, timeoutMs)
    signal.addEventListener('abort', onAbort)

    child.on('error', err => {
      if (err.code === 'ENOENT') {
        finish(reject, new Error(`comando 'claude' non trovato (cercato: ${claudeBin}); imposta CLAUDE_BIN`))
      } else {
        finish(reject, err)
      }
    })

    child.stdout.on('data', d => {
      stdout += d.toString('utf8')
      if (stdout.length > MAX_OUTPUT) {
        kill()
        finish(reject, new Error("risposta della CLI 'claude' troppo grande"))
      }
    })
    child.stderr.on('data', d => { if (stderr.length < 4096) stderr += d.toString('utf8') })

    child.on('close', code => {
      if (code !== 0) {
        finish(reject, new Error(`CLI 'claude' uscita con codice ${code}: ${stderr || '(nessun output stderr)'}`))
        return
      }
      finish(resolve, stdout.trim())
    })

    child.stdin.on('error', () => {})
    child.stdin.write(user ?? '')
    child.stdin.end()
  })
}

export function createBridge({
  claudeBin = findClaudeBin(),
  allowedOrigins = DEFAULT_ORIGINS,
  maxBody = MAX_BODY,
  timeoutMs = TIMEOUT_MS,
  spawnImpl = spawn,
} = {}) {
  const origins = new Set(allowedOrigins)
  // Le richieste passano una alla volta: niente CLI in parallelo a raffica.
  let queue = Promise.resolve()

  return createServer(async (req, res) => {
    // Controllo esplicito su ogni richiesta, non solo tramite CORS: senza un'origine
    // ammessa la richiesta non arriva mai alla CLI.
    const origin = req.headers.origin
    if (typeof origin !== 'string' || !origins.has(origin)) {
      sendJson(res, 403, { error: 'origine non ammessa: aggiungila a ALLOWED_ORIGINS' })
      return
    }
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body
      try {
        body = JSON.parse(await readBody(req, maxBody))
      } catch (err) {
        sendJson(res, err.status ?? 400, { error: err.status ? err.message : 'JSON non valido nel corpo della richiesta' })
        return
      }
      if (!body || !Array.isArray(body.messages) || (body.model !== undefined && !validModel(body.model))) {
        sendJson(res, 400, { error: 'richiesta non valida' })
        return
      }

      const { system, user } = extractMessages(body.messages)
      const model = typeof body.model === 'string' ? body.model.trim() : ''
      // Se il client chiude la connessione la CLI viene terminata (o non parte proprio).
      const aborter = new AbortController()
      res.once('close', () => { if (!res.writableEnded) aborter.abort() })

      const job = queue.then(async () => {
        if (aborter.signal.aborted) return
        const cwd = await mkdtemp(path.join(tmpdir(), 'tg-digest-claude-'))
        let status = 200
        let payload
        try {
          const text = await runClaude({ claudeBin, spawnImpl, system, user, model, cwd, timeoutMs, signal: aborter.signal })
          payload = { choices: [{ message: { role: 'assistant', content: text } }] }
        } catch (err) {
          status = 500
          payload = { error: safeError(err instanceof Error ? err.message : err) }
        }
        // La directory temporanea sparisce prima della risposta.
        await rm(cwd, { recursive: true, force: true })
        sendJson(res, status, payload)
      })
      queue = job.catch(() => {})
      await queue
      return
    }

    sendJson(res, 404, { error: 'not found' })
  })
}

function main() {
  const port = Number(process.env.PORT) || DEFAULT_PORT
  const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS)
  const claudeBin = findClaudeBin()
  console.log(`Uso il binario claude: ${claudeBin}`)

  const server = createBridge({ claudeBin, allowedOrigins })
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Bridge già attivo su ${port}, riuso quello`)
      process.exit(0)
    }
    throw err
  })
  server.listen(port, HOST, () => {
    console.log(`Bridge Claude Code su http://${HOST}:${port} (serve il comando 'claude' nel PATH)`)
    console.log(`Origini ammesse: ${allowedOrigins.join(', ')}`)
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
