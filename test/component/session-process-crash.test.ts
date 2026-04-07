import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession, SessionManager } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

function makeSession(overrides?: { sessionId?: string }) {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()
  const session = new PiAcpSession({
    sessionId: overrides?.sessionId ?? 's1',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })
  return { conn, proc, session }
}

// ── Issue #1: process crash resolves pending prompt ──────────────────────

test('process_exit resolves in-flight prompt with error', async () => {
  const { proc, session } = makeSession()

  const result = session.prompt('hello')
  // prompt() started the turn
  assert.equal(proc.prompts.length, 1)

  // Simulate subprocess crash
  proc.emit({ type: 'process_exit' })

  assert.equal(await result, 'error')
})

test('process_exit resolves queued prompts with error', async () => {
  const { proc, session } = makeSession()

  const first = session.prompt('one')
  const second = session.prompt('two')
  const third = session.prompt('three')

  // Only the first should have been sent to pi
  assert.equal(proc.prompts.length, 1)

  // Simulate subprocess crash
  proc.emit({ type: 'process_exit' })

  // All three should resolve with 'error', not hang
  assert.equal(await first, 'error')
  assert.equal(await second, 'error')
  assert.equal(await third, 'error')
})

test('process_exit with no pending turn is a no-op', () => {
  const { proc } = makeSession()

  // No prompt in flight — should not throw
  proc.emit({ type: 'process_exit' })
})

// ── Issue #2: session close resolves in-flight prompt ────────────────────

test('SessionManager.close resolves in-flight prompt with error', async () => {
  const { proc, session } = makeSession({ sessionId: 'close-test' })

  const mgr = new SessionManager()
  // Manually register the session in the manager's internal map
  ;(mgr as any).sessions.set('close-test', session)

  const result = session.prompt('hello')
  assert.equal(proc.prompts.length, 1)

  mgr.close('close-test')

  assert.equal(await result, 'error')
})

test('SessionManager.close resolves queued prompts with error', async () => {
  const { proc, session } = makeSession({ sessionId: 'close-queue' })

  const mgr = new SessionManager()
  ;(mgr as any).sessions.set('close-queue', session)

  const first = session.prompt('one')
  const second = session.prompt('two')
  assert.equal(proc.prompts.length, 1)

  mgr.close('close-queue')

  assert.equal(await first, 'error')
  assert.equal(await second, 'error')
})

// ── settleAllPending resets agent loop state ──────────────────────────────

test('settleAllPending resets inAgentLoop so subsequent prompts work', async () => {
  const { proc, session } = makeSession()

  const first = session.prompt('one')
  proc.emit({ type: 'agent_start' })

  // Crash mid-agent-loop
  proc.emit({ type: 'process_exit' })
  assert.equal(await first, 'error')

  // A new prompt should start cleanly (not queue behind a stale state)
  const second = session.prompt('two')
  assert.equal(proc.prompts.length, 2)

  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'agent_end' })
  assert.equal(await second, 'end_turn')
})
