import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeMcpConfig } from '../../src/acp/mcp-config.js'
import type { BackendConfig } from '../../src/backend/config.js'

function makeGsdConfig(): BackendConfig {
  return {
    name: 'gsd',
    defaultCommand: 'gsd',
    commandEnvVar: 'PI_ACP_PI_COMMAND',
    agentDirBase: '/tmp/.gsd',
    agentDirEnvVar: 'GSD_AGENT_DIR',
    agentDir: '/tmp/.gsd',
    settingsPath: '/tmp/.gsd/settings.json',
    promptsDir: '/tmp/.gsd/prompts',
    extensionsDir: '/tmp/.gsd/extensions',
    sessionMapPath: '/tmp/.gsd/session-map.json',
    skillsDirs: () => [],
    spawnArgs: ['--mode', 'rpc'],
    npmPackage: 'gsd',
    useShell: () => false
  }
}

function makePiConfig(): BackendConfig {
  return { ...makeGsdConfig(), name: 'pi' }
}

let testDir: string

beforeEach(() => {
  testDir = join(tmpdir(), `mcp-config-test-${crypto.randomUUID()}`)
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

function readMcpFile(): Record<string, unknown> {
  const path = join(testDir, '.gsd', 'mcp.json')
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

describe('writeMcpConfig', () => {
  it('no-op: gsd backend but empty mcpServers', () => {
    writeMcpConfig(testDir, [], makeGsdConfig())
    assert.ok(!existsSync(join(testDir, '.gsd', 'mcp.json')))
  })

  it('no-op: pi backend with non-empty mcpServers', () => {
    writeMcpConfig(testDir, [
      { name: 'fetch', command: 'npx', args: ['-y', 'mcp-fetch'], env: [] }
    ], makePiConfig())
    assert.ok(!existsSync(join(testDir, '.gsd', 'mcp.json')))
    assert.ok(!existsSync(join(testDir, '.pi', 'mcp.json')))
  })

  it('creates file with stdio server', () => {
    writeMcpConfig(testDir, [
      { name: 'my-tool', command: 'node', args: ['server.js'], env: [{ name: 'KEY', value: 'val' }] }
    ], makeGsdConfig())
    const data = readMcpFile()
    assert.deepEqual(data, {
      mcpServers: {
        'my-tool': { command: 'node', args: ['server.js'], env: { KEY: 'val' } }
      }
    })
  })

  it('creates file with http server', () => {
    writeMcpConfig(testDir, [
      { type: 'http', name: 'remote', url: 'https://example.com/mcp', headers: [{ name: 'Authorization', value: 'Bearer tok' }] }
    ], makeGsdConfig())
    const data = readMcpFile()
    assert.deepEqual(data, {
      mcpServers: {
        remote: { url: 'https://example.com/mcp', headers: { Authorization: 'Bearer tok' } }
      }
    })
  })

  it('creates file with sse server', () => {
    writeMcpConfig(testDir, [
      { type: 'sse', name: 'sse-srv', url: 'https://example.com/sse', headers: [] }
    ], makeGsdConfig())
    const data = readMcpFile()
    assert.deepEqual(data, {
      mcpServers: {
        'sse-srv': { url: 'https://example.com/sse', headers: {} }
      }
    })
  })

  it('creates file with multiple servers', () => {
    writeMcpConfig(testDir, [
      { name: 'tool-a', command: 'node', args: ['a.js'], env: [] },
      { type: 'http', name: 'tool-b', url: 'https://b.example.com', headers: [] }
    ], makeGsdConfig())
    const data = readMcpFile()
    const servers = data.mcpServers as Record<string, unknown>
    assert.ok('tool-a' in servers)
    assert.ok('tool-b' in servers)
  })

  it('merges with existing file: preserves other keys, ACP server wins on collision', () => {
    const gsdDir = join(testDir, '.gsd')
    mkdirSync(gsdDir, { recursive: true })
    writeFileSync(join(gsdDir, 'mcp.json'), JSON.stringify({
      mcpServers: {
        'existing-tool': { command: 'old-cmd', args: [], env: {} },
        'shared-name': { command: 'old-shared', args: [], env: {} }
      }
    }, null, 2) + '\n', 'utf-8')

    writeMcpConfig(testDir, [
      { name: 'shared-name', command: 'new-cmd', args: ['--flag'], env: [] },
      { name: 'new-tool', command: 'new-tool', args: [], env: [] }
    ], makeGsdConfig())

    const data = readMcpFile()
    const servers = data.mcpServers as Record<string, unknown>

    // Existing-only key preserved
    assert.deepEqual(servers['existing-tool'], { command: 'old-cmd', args: [], env: {} })
    // Collision: ACP wins
    assert.deepEqual(servers['shared-name'], { command: 'new-cmd', args: ['--flag'], env: {} })
    // New key added
    assert.deepEqual(servers['new-tool'], { command: 'new-tool', args: [], env: {} })
  })

  it('overwrites invalid JSON in existing file', () => {
    const gsdDir = join(testDir, '.gsd')
    mkdirSync(gsdDir, { recursive: true })
    writeFileSync(join(gsdDir, 'mcp.json'), 'not-json', 'utf-8')

    writeMcpConfig(testDir, [
      { name: 'tool', command: 'cmd', args: [], env: [] }
    ], makeGsdConfig())

    const data = readMcpFile()
    assert.deepEqual(data, {
      mcpServers: { tool: { command: 'cmd', args: [], env: {} } }
    })
  })

  it('creates .gsd dir if it does not exist', () => {
    assert.ok(!existsSync(join(testDir, '.gsd')))
    writeMcpConfig(testDir, [
      { name: 'tool', command: 'cmd', args: [], env: [] }
    ], makeGsdConfig())
    assert.ok(existsSync(join(testDir, '.gsd', 'mcp.json')))
  })
})
