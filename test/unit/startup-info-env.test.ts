import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { _resetBackendCache } from '../../src/backend/config.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

class FakeSessions {
  constructor(private readonly session: any) {}
  async create(_params: any) {
    return this.session
  }
}

test('PiAcpAgent: quietStartup=true disables startup info generation/emission', async () => {
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR
  // Set a fake API key so auth check passes in CI where no real keys exist.
  const prevApiKey: string | undefined = process.env.ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = 'test-key'

  // Create a temp dir with settings.json containing quietStartup: true
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'pi-acp-quietstartup-'))
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ quietStartup: true }, null, 2), 'utf-8')
  process.env.PI_CODING_AGENT_DIR = dir

  // Spy on setTimeout calls (agent schedules startup info + available commands)
  const realSetTimeout = globalThis.setTimeout
  const timeouts: Array<unknown> = []
  ;(globalThis as any).setTimeout = (fn: unknown, _ms?: number) => {
    timeouts.push(fn)
    return 0 as any
  }

  try {
    const conn = new FakeAgentSideConnection()

    let setStartupInfoCalled = false
    const session = {
      sessionId: 's1',
      cwd: process.cwd(),
      proc: {
        async getAvailableModels() {
          return { models: [{ provider: 'test', id: 'model', name: 'model' }] }
        },
        async getState() {
          return {
            thinkingLevel: 'medium',
            model: { provider: 'test', id: 'model' }
          }
        }
      },
      setStartupInfo(_text: string) {
        setStartupInfoCalled = true
      },
      sendStartupInfoIfPending() {
        throw new Error('should not be scheduled when startup info is disabled')
      }
    }

    _resetBackendCache()
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)

    // Override config.settingsPath so getMergedSettings() reads from our temp dir.
    // The default settingsPath is hardcoded to ~/.pi/agent/settings.json (or ~/.gsd/settings.json)
    // and doesn't respect PI_CODING_AGENT_DIR, so we patch it directly.
    const cfg = (agent as any).config
    ;(agent as any).config = { ...cfg, settingsPath: join(dir, 'settings.json') }

    ;(agent as any).sessions = new FakeSessions(session) as any

    const res = await agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any)

    assert.equal(res?._meta?.piAcp?.startupInfo, null)
    assert.equal(setStartupInfoCalled, false)

    // Only available_commands_update should be scheduled.
    // (Startup info will only be scheduled if an update notice exists, which we don't assume in tests.)
    assert.equal(timeouts.length, 1)
  } finally {
    ;(globalThis as any).setTimeout = realSetTimeout
    _resetBackendCache()
    if (prevAgentDir == null) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir
    if (prevApiKey == null) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = prevApiKey
  }
})
