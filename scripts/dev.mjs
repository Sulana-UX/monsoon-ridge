// Starts the API (backend/server) and the website (frontend) together.
// Usage: npm start   (Ctrl+C stops both)
import { spawn } from 'node:child_process'

const procs = [
  { name: 'api', color: '\x1b[36m', args: ['--prefix', 'backend/server', 'run', 'dev'] },
  { name: 'web', color: '\x1b[33m', args: ['--prefix', 'frontend', 'run', 'dev'] },
]

const children = procs.map(({ name, color, args }) => {
  const child = spawn('npm', args, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] })
  const tag = `${color}[${name}]\x1b[0m `
  const out = (stream) => (chunk) =>
    chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => stream.write(tag + line + '\n'))
  child.stdout.on('data', out(process.stdout))
  child.stderr.on('data', out(process.stderr))
  child.on('exit', (code) => {
    console.log(`${tag}stopped (code ${code}). Stopping the other one too.`)
    stopAll()
  })
  return child
})

let stopping = false
function stopAll() {
  if (stopping) return
  stopping = true
  for (const c of children) if (c.exitCode === null) c.kill()
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
