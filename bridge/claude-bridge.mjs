// Bridge HTTP locale che espone la CLI "claude" (Claude Code) tramite un'API
// compatibile OpenAI, cosi' l'app puo' usare l'abbonamento Claude Code al posto
// di una chiave API Anthropic separata. Nessuna dipendenza esterna.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { delimiter } from 'node:path'

const PORT = Number(process.env.PORT) || 11435
const TIMEOUT_MS = 5 * 60 * 1000

// Trova il binario "claude": CLAUDE_BIN, poi PATH, poi le posizioni di installazione
// note (il PATH del processo che avvia il bridge spesso non include ~/.local/bin).
function findClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  const home = homedir()
  const candidates = [
    ...(process.env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => path.join(dir, 'claude')),
    path.join(home, '.local', 'bin', 'claude'),
    path.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
  return candidates.find(c => existsSync(c)) ?? 'claude'
}
const CLAUDE_BIN = findClaudeBin()
console.log(`Uso il binario claude: ${CLAUDE_BIN}`)

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
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

function runClaude(system, user, model) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'text']
    if (system) {
      args.push('--append-system-prompt', system)
    }
    // Modello esplicito solo se indicato: vuoto o 'claude-code' = default del CLI
    if (model && model !== 'claude-code') {
      args.push('--model', model)
    }

    let child
    try {
      child = spawn(CLAUDE_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      reject(new Error(`comando 'claude' non trovato nel PATH: ${err.message}`))
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`timeout dopo ${TIMEOUT_MS}ms in attesa della CLI 'claude'`))
    }, TIMEOUT_MS)

    child.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new Error(`comando 'claude' non trovato (cercato: ${CLAUDE_BIN}); imposta CLAUDE_BIN`))
      } else {
        reject(err)
      }
    })

    child.stdout.on('data', d => { stdout += d.toString('utf8') })
    child.stderr.on('data', d => { stderr += d.toString('utf8') })

    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`CLI 'claude' uscita con codice ${code}: ${stderr || '(nessun output stderr)'}`))
        return
      }
      resolve(stdout.trim())
    })

    child.stdin.write(user ?? '')
    child.stdin.end()
  })
}

const server = createServer(async (req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body
    try {
      const raw = await readBody(req)
      body = JSON.parse(raw)
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'JSON non valido nel corpo della richiesta' }))
      return
    }

    const { system, user } = extractMessages(body.messages)

    try {
      const text = await runClaude(system, user, typeof body.model === 'string' ? body.model.trim() : '')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: text } }],
      }))
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Bridge già attivo su ${PORT}, riuso quello`)
    process.exit(0)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`Bridge Claude Code su http://localhost:${PORT} (serve il comando 'claude' nel PATH)`)
})
