import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const cwd = process.cwd()

// Build first so Zed-style invocation (node dist/index.js) works.
await new Promise((resolve, reject) => {
  const p = spawn('npm', ['run', 'build'], { stdio: 'inherit', cwd })
  p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`build failed: ${code}`))))
})

const child = spawn('node', ['dist/index.js'], {
  cwd,
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env
})

child.stdout.setEncoding('utf8')
child.stdout.on('data', chunk => {
  process.stdout.write(chunk)
})

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n')
}

// Smoke test 1: MCP config injection
// Clean up any leftover mcp.json from a previous run so the assertion is reliable.
const mcpJsonPath = join(cwd, '.gsd', 'mcp.json')
let mcpJsonExistedBefore = existsSync(mcpJsonPath)
let mcpJsonContentBefore = mcpJsonExistedBefore ? readFileSync(mcpJsonPath, 'utf-8') : null

// Basic ACP handshake + one prompt.
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1 } })
send({
  jsonrpc: '2.0', id: 2, method: 'session/new', params: {
    cwd,
    mcpServers: [
      { name: 'smoke-stdio', command: 'node', args: ['smoke-server.js'], env: [{ name: 'SMOKE_KEY', value: 'smoke-val' }] },
      { type: 'http', name: 'smoke-http', url: 'https://smoke.example.com/mcp', headers: [{ name: 'X-Token', value: 'abc' }] }
    ]
  }
})

// We'll send prompt a moment later; sessionId is in response to id=2.
let sessionId = null
let buffer = ''
child.stdout.on('data', chunk => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''

  for (const line of lines) {
    if (!line.trim()) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }

    if (msg?.id === 2 && msg?.result?.sessionId && !sessionId) {
      sessionId = msg.result.sessionId

      // Smoke test 1: verify .gsd/mcp.json was written with injected servers
      if (!existsSync(mcpJsonPath)) {
        console.error('SMOKE FAIL: .gsd/mcp.json was not created')
        process.exit(1)
      }
      let mcpJson
      try {
        mcpJson = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'))
      } catch {
        console.error('SMOKE FAIL: .gsd/mcp.json is not valid JSON')
        process.exit(1)
      }
      const servers = mcpJson?.mcpServers ?? {}
      if (!servers['smoke-stdio'] || servers['smoke-stdio'].command !== 'node') {
        console.error('SMOKE FAIL: smoke-stdio server missing or incorrect', servers['smoke-stdio'])
        process.exit(1)
      }
      if (!servers['smoke-http'] || servers['smoke-http'].url !== 'https://smoke.example.com/mcp') {
        console.error('SMOKE FAIL: smoke-http server missing or incorrect', servers['smoke-http'])
        process.exit(1)
      }
      if (servers['smoke-http'].headers?.['X-Token'] !== 'abc') {
        console.error('SMOKE FAIL: smoke-http headers not converted correctly', servers['smoke-http'].headers)
        process.exit(1)
      }
      console.error('SMOKE PASS: .gsd/mcp.json written and verified')

      // Restore previous state of .gsd/mcp.json
      if (mcpJsonContentBefore !== null) {
        writeFileSync(mcpJsonPath, mcpJsonContentBefore, 'utf-8')
      } else {
        rmSync(mcpJsonPath, { force: true })
      }

      send({
        jsonrpc: '2.0',
        id: 3,
        method: 'session/prompt',
        params: {
          sessionId,
          prompt: [{ type: 'text', text: 'Say hello in one short sentence.' }]
        }
      })
    }

    if (msg?.id === 3) {
      // Turn finished.
      setTimeout(() => child.kill('SIGTERM'), 50)
    }
  }
})
