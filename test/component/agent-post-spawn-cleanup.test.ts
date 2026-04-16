import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

/**
 * Minimal FakeSessions that tracks close() calls for leak-detection assertions.
 */
class FakeSessions {
  closedIds: string[] = []
  constructor(private readonly session: any) {}
  async create(_params: any) {
    return this.session
  }
  close(sessionId: string) {
    this.closedIds.push(sessionId)
    try { this.session.proc.dispose?.() } catch { /* ignore */ }
  }
}

// ── Issue #3: post-spawn failure disposes subprocess ─────────────────────

test('newSession disposes subprocess when post-spawn code throws after spawn', async () => {
  // Ensure auth gate passes in CI where no real API keys exist.
  const prevApiKey = process.env.ANTHROPIC_API_KEY
  if (!prevApiKey) process.env.ANTHROPIC_API_KEY = 'test-key'

  const conn = new FakeAgentSideConnection()

  const session = {
    sessionId: 's-post-spawn',
    cwd: process.cwd(),
    proc: {
      disposeCalled: 0,
      async getAvailableModels() {
        return { models: [{ provider: 'test', id: 'test-model', name: 'Test' }] }
      },
      async getState() {
        return { thinkingLevel: 'medium', model: { provider: 'test', id: 'test-model' } }
      },
      dispose() {
        this.disposeCalled += 1
      }
    },
    setStartupInfo() { /* no-op */ },
    sendStartupInfoIfPending() { /* no-op */ }
  }

  class FailingFakeSessions extends FakeSessions {
    // Simulate a post-spawn failure: closeAllExcept throws after models/thinking state succeed.
    closeAllExcept(_keepId: string) {
      throw new Error('simulated post-spawn failure')
    }
  }

  const fakeSessions = new FailingFakeSessions(session)
  const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
  ;(agent as any).sessions = fakeSessions as any

  await assert.rejects(
    () => agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any),
    (err: any) => {
      // The original error should propagate (re-thrown after cleanup)
      assert.match(String(err?.message), /simulated post-spawn failure/)
      return true
    }
  )

  // The session must have been cleaned up via sessions.close()
  assert.deepEqual(fakeSessions.closedIds, ['s-post-spawn'])
  assert.equal(session.proc.disposeCalled, 1)

  if (prevApiKey == null) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = prevApiKey
})

test('newSession disposes subprocess when getAvailableModels throws after spawn', async () => {
  // Ensure auth gate passes in CI where no real API keys exist.
  const prevApiKey = process.env.ANTHROPIC_API_KEY
  if (!prevApiKey) process.env.ANTHROPIC_API_KEY = 'test-key'

  const conn = new FakeAgentSideConnection()

  const session = {
    sessionId: 's-models-fail',
    cwd: process.cwd(),
    proc: {
      disposeCalled: 0,
      async getAvailableModels() {
        throw new Error('models RPC failed')
      },
      async getState() {
        return {}
      },
      dispose() {
        this.disposeCalled += 1
      }
    }
  }

  const fakeSessions = new FakeSessions(session)
  const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
  ;(agent as any).sessions = fakeSessions as any

  // getAvailableModels failure is caught by Promise.all's .catch(), so availableModels=null,
  // which means rawModelsCount=0, triggering the AUTH_REQUIRED error.
  // The subprocess should still be disposed via sessions.close().
  await assert.rejects(
    () => agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any),
    (err: any) => {
      assert.match(String(err?.message), /Configure an API key or log in with an OAuth provider/i)
      return true
    }
  )

  assert.deepEqual(fakeSessions.closedIds, ['s-models-fail'])
  assert.equal(session.proc.disposeCalled, 1)

  if (prevApiKey == null) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = prevApiKey
})
