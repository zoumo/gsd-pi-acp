import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

test('PiAcpSession: queue overflow rejects with error', async () => {
  // Set a low queue depth for testing
  const originalMaxDepth = process.env.PI_ACP_MAX_QUEUE_DEPTH
  process.env.PI_ACP_MAX_QUEUE_DEPTH = '3'

  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()

  const session = new PiAcpSession({
    sessionId: 'overflow-test',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  // Start first prompt (will be running, not queued)
  const first = session.prompt('first')

  // Queue prompts up to the limit (3 items)
  const queued = []
  for (let i = 0; i < 3; i++) {
    queued.push(session.prompt(`queued-${i}`))
  }

  // This one should be rejected with queue full error
  try {
    await session.prompt('overflow')
    assert.fail('Expected queue full rejection but prompt resolved')
  } catch (e: any) {
    assert.ok(e.data?.includes('queue full'), `Expected "queue full" in error data, got: ${e.data}`)
    assert.ok(e.data?.includes('max 3'), `Expected max depth in error data, got: ${e.data}`)
  }

  // Clean up: cancel the running prompt and queued prompts
  await session.cancel()

  // Finish the first prompt
  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })

  assert.equal(await first, 'cancelled')

  // Restore original env var
  if (originalMaxDepth === undefined) {
    delete process.env.PI_ACP_MAX_QUEUE_DEPTH
  } else {
    process.env.PI_ACP_MAX_QUEUE_DEPTH = originalMaxDepth
  }
})

test('PiAcpSession: queue accepts up to MAX_QUEUE_DEPTH items', async () => {
  // Set a low queue depth for testing
  const originalMaxDepth = process.env.PI_ACP_MAX_QUEUE_DEPTH
  process.env.PI_ACP_MAX_QUEUE_DEPTH = '5'

  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess()

  const session = new PiAcpSession({
    sessionId: 'queue-limit-test',
    cwd: process.cwd(),
    mcpServers: [],
    proc: proc as any,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  // Start first prompt (will be running)
  const first = session.prompt('first')

  // Queue exactly MAX_QUEUE_DEPTH items - all should be accepted
  const queued = []
  for (let i = 0; i < 5; i++) {
    queued.push(session.prompt(`queued-${i}`))
    // These should not throw
  }

  // Verify queue depth is exactly 5
  assert.equal(queued.length, 5)

  // The 6th prompt should be rejected (queue full)
  try {
    await session.prompt('overflow')
    assert.fail('Expected queue full rejection')
  } catch (e: any) {
    assert.ok(e.data?.includes('queue full'), `Expected "queue full" in error data, got: ${e.data}`)
  }

  // Clean up
  await session.cancel()
  proc.emit({ type: 'agent_start' })
  proc.emit({ type: 'turn_end' })
  proc.emit({ type: 'agent_end' })

  assert.equal(await first, 'cancelled')

  // Restore original env var
  if (originalMaxDepth === undefined) {
    delete process.env.PI_ACP_MAX_QUEUE_DEPTH
  } else {
    process.env.PI_ACP_MAX_QUEUE_DEPTH = originalMaxDepth
  }
})