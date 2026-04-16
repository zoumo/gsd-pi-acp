import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { PiAcpAgent } from './acp/agent.js'
import { shouldUseShellForPiCommand } from './pi-rpc/command.js'
import { getBackendCommand } from './backend/config.js'
import { debugLog } from './logger.js'
import { stdoutWrite } from './stdout-writer.js'

// Backend detection at startup - log the detected backend for debugging
const { command, backend, autoDetected } = getBackendCommand()
debugLog(`startup: backend=${backend} command=${command} autoDetected=${autoDetected}`)

// Terminal Auth entrypoint. The ACP client launches the agent with `--terminal-login`.
if (process.argv.includes('--terminal-login')) {
  const { spawnSync } = await import('node:child_process')
  // Use the already-detected command from startup, or override if PI_ACP_PI_COMMAND is set
  const cmd = process.env.PI_ACP_PI_COMMAND?.trim() || command
  const res = spawnSync(cmd, [], {
    stdio: 'inherit',
    env: process.env,
    shell: shouldUseShellForPiCommand(cmd)
  })

  const err = res.error as NodeJS.ErrnoException | undefined
  if (err?.code === 'ENOENT') {
    process.stderr.write(
      `pi-acp: could not start pi (command not found: ${cmd}). Install it via \`npm install -g @mariozechner/pi-coding-agent\` or ensure \`pi\` is on your PATH.\n`
    )
    process.exit(1)
  }

  process.exit(typeof res.status === 'number' ? res.status : 1)
}

const input = new WritableStream<Uint8Array>({
  write(chunk) {
    return stdoutWrite(chunk)
  }
})

const output = new ReadableStream<Uint8Array>({
  start(controller) {
    process.stdin.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
    process.stdin.on('end', () => controller.close())
    process.stdin.on('error', err => controller.error(err))
  }
})

const stream = ndJsonStream(input, output)

let acpAgent: PiAcpAgent | null = null
const _agent = new AgentSideConnection(conn => {
  acpAgent = new PiAcpAgent(conn)
  return acpAgent
}, stream)

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  debugLog('shutdown')
  try {
    // Best-effort: dispose session subprocesses when the client disconnects.
    acpAgent?.dispose()
  } catch {
    // ignore
  }
  try {
    process.exit(0)
  } catch {
    // ignore
  }
}

process.stdin.on('end', shutdown)
process.stdin.on('close', shutdown)

process.stdin.resume()
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Avoid crashing if the client closes stdout early.
process.stdout.on('error', () => {
  try {
    process.exit(0)
  } catch {
    // ignore
  }
})
