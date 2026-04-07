import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'

/**
 * Test child.on('exit') handler behavior (process crash recovery):
 * - All pending requests are rejected with 'pi process exited' error
 * - Pending Map is cleared after exit
 * - process_exit event is emitted to event handlers
 * - Error includes exit code and signal in message
 */

describe('PiRpcProcess crash recovery (exit handler)', () => {
  let fakeChild: FakeChildProcess

  beforeEach(() => {
    fakeChild = new FakeChildProcess()
  })

  it('rejects all pending requests when process exits with code=1', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Create multiple pending requests (no responses emitted)
    const request1 = proc.getState().catch(err => err)
    const request2 = proc.getAvailableModels().catch(err => err)
    const request3 = proc.getMessages().catch(err => err)

    // Simulate crash (exit with code=1, no signal)
    fakeChild.simulateExit(1, null)

    // All requests should be rejected
    const errors = await Promise.all([request1, request2, request3])

    for (const error of errors) {
      assert.ok(error instanceof Error, 'Each pending request should reject with Error')
      assert.ok(
        error.message.includes('pi process exited'),
        'Error message should mention process exit'
      )
      assert.ok(error.message.includes('code=1'), 'Error message should include exit code')
    }
  })

  it('clears pending Map after exit', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Create pending request
    const requestPromise = proc.getState().catch(() => {})

    // Verify request was written to stdin (means it's in pending Map)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(fakeChild.stdinWrites.length > 0, 'Request should be written to stdin')

    // Simulate exit
    fakeChild.simulateExit(1, null)

    // Wait for exit handling
    await requestPromise

    // Make another request after exit - it should also fail
    // (but this tests that the Map was cleared and new requests get added then rejected)
    const secondRequest = proc.getState().catch(err => err)
    fakeChild.simulateExit(1, null) // Exit again to reject

    const secondError = await secondRequest
    assert.ok(
      secondError instanceof Error,
      'Request after exit should also be rejected when exit occurs'
    )
  })

  it('emits process_exit event to event handlers', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Track events received
    const events: Array<{ type: string; code?: number | null; signal?: NodeJS.Signals | null }> = []
    proc.onEvent(ev => {
      events.push(ev as any)
    })

    // Simulate exit with code=1
    fakeChild.simulateExit(1, null)

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 10))

    // Verify process_exit event was emitted
    const exitEvent = events.find(e => e.type === 'process_exit')
    assert.ok(exitEvent, 'process_exit event should be emitted')
    assert.strictEqual(exitEvent?.code, 1, 'Event should include exit code')
    assert.strictEqual(exitEvent?.signal, null, 'Event should include signal')
  })

  it('includes exit code and signal in error message', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    const requestPromise = proc.getState().catch(err => err)

    // Simulate exit with specific code and signal
    fakeChild.simulateExit(137, 'SIGKILL')

    const error = await requestPromise
    assert.ok(error instanceof Error, 'Should reject with Error')
    assert.ok(
      error.message.includes('code=137'),
      'Error message should include exit code 137'
    )
    assert.ok(
      error.message.includes('signal=SIGKILL'),
      'Error message should include signal SIGKILL'
    )
  })

  it('handles exit with null code and signal', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    const requestPromise = proc.getState().catch(err => err)

    // Simulate exit with null/null (graceful exit scenario)
    fakeChild.simulateExit(null, null)

    const error = await requestPromise
    assert.ok(error instanceof Error, 'Should reject with Error')
    // Message format: "pi process exited (code=null, signal=null)"
    assert.ok(
      error.message.includes('pi process exited'),
      'Error message should mention process exit'
    )
  })

  it('rejects pending requests before clearing Map (settled-guard prevents double-reject)', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Create pending request
    const requestPromise = proc.getState().catch(err => err)

    // Emit a late response AFTER exit (this should not resolve the request)
    fakeChild.simulateExit(1, null)

    // Wait a moment, then emit a response (too late - request already rejected)
    await new Promise(resolve => setTimeout(resolve, 10))
    fakeChild.emitStdoutJson({
      type: 'response',
      id: fakeChild.stdinWrites[0].match(/"id":"([^"]+)"/)?.[1],
      command: 'get_state',
      success: true,
      data: { test: 'data' }
    })

    const error = await requestPromise
    // Should still be rejected (not resolved with the late response)
    assert.ok(error instanceof Error, 'Should reject with Error (not resolve with late response)')
    assert.ok(
      error.message.includes('pi process exited'),
      'Should be rejected with exit error, not late response'
    )
  })

  it('rejects pending promises even when an event handler throws on exit (#5)', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Register a handler that always throws
    proc.onEvent(() => {
      throw new Error('handler kaboom')
    })

    // Create pending request
    const requestPromise = proc.getState().catch(err => err)

    // Simulate exit — the throwing handler must not prevent pending rejection
    fakeChild.simulateExit(1, null)

    const error = await requestPromise
    assert.ok(error instanceof Error, 'Pending request should still be rejected')
    assert.ok(
      error.message.includes('pi process exited'),
      'Error should be the exit error, not the handler exception'
    )
  })

  it('rejects pending promises even when an event handler throws on error (#5)', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Register a handler that always throws
    proc.onEvent(() => {
      throw new Error('handler kaboom')
    })

    // Create pending request
    const requestPromise = proc.getState().catch(err => err)

    // Simulate error — the throwing handler must not prevent pending rejection
    fakeChild.simulateError(new Error('spawn ENOENT'))

    const error = await requestPromise
    assert.ok(error instanceof Error, 'Pending request should still be rejected')
    assert.ok(
      error.message.includes('spawn ENOENT'),
      'Error should be the original spawn error'
    )
  })

  it('calls all event handlers even when an earlier one throws on exit (#5)', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    const handlerCalls: string[] = []

    // First handler throws
    proc.onEvent(() => {
      handlerCalls.push('first')
      throw new Error('first handler throws')
    })

    // Second handler should still be called
    proc.onEvent(() => {
      handlerCalls.push('second')
    })

    fakeChild.simulateExit(0, null)

    // Both handlers should have been called despite the first one throwing
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepStrictEqual(handlerCalls, ['first', 'second'],
      'All event handlers should run even when one throws')
  })
})