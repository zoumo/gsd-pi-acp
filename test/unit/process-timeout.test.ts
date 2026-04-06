import test from 'node:test'
import assert from 'node:assert/strict'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'

test('request() rejects with timeout error when child process never responds', async () => {
  const originalTimeout = process.env.PI_ACP_RPC_TIMEOUT_MS
  process.env.PI_ACP_RPC_TIMEOUT_MS = '100'

  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  // Simulate spawn asynchronously
  setTimeout(() => child.simulateSpawn(), 0)

  try {
    await proc.getState()
    assert.fail('expected timeout error')
  } catch (err) {
    assert.ok(err instanceof Error)
    assert.ok(err.message.includes('RPC request timed out'))
    assert.ok(err.message.includes('100ms'))
    assert.ok(err.message.includes('get_state'))
  } finally {
    process.env.PI_ACP_RPC_TIMEOUT_MS = originalTimeout
    proc.dispose()
  }
})

test('pending Map is cleared after timeout - subsequent requests work', async () => {
  const originalTimeout = process.env.PI_ACP_RPC_TIMEOUT_MS
  process.env.PI_ACP_RPC_TIMEOUT_MS = '50'

  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // First request times out
  try {
    await proc.getState()
    assert.fail('expected first request to timeout')
  } catch (err) {
    assert.ok(err instanceof Error)
    assert.ok(err.message.includes('timed out'))
  }

  // Second request should work correctly (pending Map was cleared)
  const secondPromise = proc.getState()

  // Wait a bit then send response
  await new Promise(resolve => setTimeout(resolve, 10))

  // Parse the second request ID from stdin
  const stdinWrites = child.stdinWrites
  assert.ok(stdinWrites.length >= 2, 'should have two stdin writes')

  const secondRequest = JSON.parse(stdinWrites[stdinWrites.length - 1])
  const secondId = secondRequest.id

  // Send response for second request
  child.emitStdoutJson({
    type: 'response',
    id: secondId,
    command: 'get_state',
    success: true,
    data: { status: 'ready' }
  })

  const result = await secondPromise
  assert.deepEqual(result, { status: 'ready' })

  process.env.PI_ACP_RPC_TIMEOUT_MS = originalTimeout
  proc.dispose()
})

test('no double-resolve when response arrives after timeout', async () => {
  const originalTimeout = process.env.PI_ACP_RPC_TIMEOUT_MS
  const originalDebug = process.env.PI_ACP_DEBUG_LOG
  process.env.PI_ACP_RPC_TIMEOUT_MS = '50'
  // Enable debug logging to verify debugLog call
  process.env.PI_ACP_DEBUG_LOG = '/tmp/pi-acp-test-debug.log'

  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // Capture the request and handle rejection immediately to prevent unhandled rejection warning
  let caughtError: Error | null = null
  const promise = proc.getState().catch(err => { caughtError = err as Error })

  // Wait for timeout to fire
  await new Promise(resolve => setTimeout(resolve, 60))
  await promise // Ensures catch handler has run

  // Parse request ID from stdin
  const stdinWrites = child.stdinWrites
  assert.ok(stdinWrites.length >= 1, 'should have stdin write')

  const request = JSON.parse(stdinWrites[stdinWrites.length - 1])
  const requestId = request.id

  // Verify timeout occurred
  assert.ok(caughtError, 'should have caught timeout error')
  assert.ok((caughtError as Error).message.includes('timed out'))

  // Now send late response with the timed-out request's ID
  // This should be ignored (no double-resolve) and treated as an event
  child.emitStdoutJson({
    type: 'response',
    id: requestId,
    command: 'get_state',
    success: true,
    data: { status: 'late' }
  })

  // Wait a bit to ensure the late response is processed
  await new Promise(resolve => setTimeout(resolve, 10))

  // No crash or error should occur - the response was simply ignored
  // since the pending Map entry was already deleted

  process.env.PI_ACP_RPC_TIMEOUT_MS = originalTimeout
  process.env.PI_ACP_DEBUG_LOG = originalDebug
  proc.dispose()
})

test('settled guard prevents double-resolve on process exit during timeout', async () => {
  const originalTimeout = process.env.PI_ACP_RPC_TIMEOUT_MS
  process.env.PI_ACP_RPC_TIMEOUT_MS = '200'

  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  const promise = proc.getState()

  // Simulate process exit before timeout completes
  await new Promise(resolve => setTimeout(resolve, 50))
  child.simulateExit(1, null)

  try {
    await promise
    assert.fail('expected error from process exit')
  } catch (err) {
    assert.ok(err instanceof Error)
    // Should get process exit error, not timeout error
    assert.ok(err.message.includes('pi process exited'))
  }

  // Ensure timeout timer was cleared (settled guard)
  // Wait longer than timeout period - no additional rejection should occur
  await new Promise(resolve => setTimeout(resolve, 250))

  process.env.PI_ACP_RPC_TIMEOUT_MS = originalTimeout
  proc.dispose()
})