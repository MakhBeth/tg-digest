// Avvia il bridge Claude Code (se non già attivo) e vite insieme, in dev.
// Node puro, nessuna dipendenza esterna.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const BRIDGE_PORT = Number(process.env.PORT) || 11435

function isPortInUse(port) {
  return new Promise(resolve => {
    const tester = createServer()
    tester.once('error', err => {
      resolve(err.code === 'EADDRINUSE')
    })
    tester.once('listening', () => {
      tester.close(() => resolve(false))
    })
    tester.listen(port, '127.0.0.1')
  })
}

let bridge = null
let vite = null
let shuttingDown = false

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  if (bridge && !bridge.killed) bridge.kill('SIGTERM')
  if (vite && !vite.killed) vite.kill('SIGTERM')
  process.exit(code)
}

async function main() {
  const inUse = await isPortInUse(BRIDGE_PORT)
  if (inUse) {
    console.log(`Bridge già attivo su ${BRIDGE_PORT}, riuso quello`)
  } else {
    bridge = spawn(process.execPath, [path.join(rootDir, 'bridge', 'claude-bridge.mjs')], {
      stdio: 'inherit',
      cwd: rootDir,
      env: process.env,
    })
    bridge.on('exit', code => {
      bridge = null
      if (!shuttingDown && code !== 0 && code !== null) {
        console.error(`Bridge terminato con codice ${code}`)
      }
    })
  }

  const viteBin = path.join(rootDir, 'node_modules', '.bin', 'vite')
  vite = spawn(viteBin, process.argv.slice(2), {
    stdio: 'inherit',
    cwd: rootDir,
    env: process.env,
  })

  vite.on('exit', code => {
    shutdown(code ?? 0)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main()
