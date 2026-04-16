import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'

/**
 * Test dispose() cleanup behavior:
 * - readline.close() stops stdout data processing (behavioral verification)
 * - child.kill() is called (direct verification via FakeChildProcess.killed)
 * - dispose() is idempotent (calling twice doesn't error)
 */

describe('PiRpcProcess dispose cleanup', () => {
  let fakeChild: FakeChildProcess

  beforeEach(() => {
    fakeChild = new FakeChildProcess()
  })

  it('stops processing stdout data after dispose() (readline.close() effect)', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Track event handler calls
    let eventCount = 0
    proc.onEvent(() => {
      eventCount++
    })

    // Emit a non-response event on stdout (should be processed)
    fakeChild.emitStdoutJson({ type: 'test_event', data: 'before' })
    await new Promise(resolve => setTimeout(resolve, 10)) // Let event loop process

    assert.strictEqual(eventCount, 1, 'Event should be processed before dispose')

    // Call dispose
    proc.dispose()

    // Emit another event (should NOT be processed after dispose)
    fakeChild.emitStdoutJson({ type: 'test_event', data: 'after' })
    await new Promise(resolve => setTimeout(resolve, 10)) // Let event loop process

    assert.strictEqual(eventCount, 1, 'Event should NOT be processed after dispose')
  })

  it('calls child.kill() exactly once on dispose()', () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    proc.dispose()

    assert.strictEqual(fakeChild.killed, true, 'child.kill() should mark killed=true')
    // FakeChildProcess.kill() returns false if already killed
    const secondKillResult = fakeChild.kill()
    assert.strictEqual(secondKillResult, false, 'second kill() returns false (already killed)')
  })

  it('dispose() is idempotent - calling twice does not error', () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // First dispose
    proc.dispose()
    assert.strictEqual(fakeChild.killed, true, 'first dispose killed the child')

    // Second dispose should not throw
    proc.dispose()
    assert.strictEqual(fakeChild.killed, true, 'child remains killed after second dispose')
  })

  it('dispose() ignores errors from child.kill()', async () => {
    // Create a child that throws on kill
    const throwingChild = new FakeChildProcess()
    const _originalKill = throwingChild.kill.bind(throwingChild)
    throwingChild.kill = function (_signal?: NodeJS.Signals | number): boolean {
      if (this.killed) return false
      this.killed = true
      throw new Error('Mock kill error')
    }

    const proc = PiRpcProcess.createForTest(throwingChild)

    // Should not throw despite child.kill() throwing
    proc.dispose()

    assert.strictEqual(throwingChild.killed, true, 'child.kill() was attempted and marked killed')

    // Verify stdout processing still stopped (readline.close() succeeded before kill)
    let eventCount = 0
    proc.onEvent(() => {
      eventCount++
    })

    fakeChild.emitStdoutJson({ type: 'test_event', data: 'after' })
    await new Promise(resolve => setTimeout(resolve, 10))

    assert.strictEqual(eventCount, 0, 'stdout processing stopped after dispose')
  })

  it('dispose() cleans up pending requests on process exit', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Make a request that will never resolve (no response emitted)
    const requestPromise = proc.getState().catch(err => err)

    // Simulate process exit (should reject all pending requests)
    fakeChild.simulateExit(1, 'SIGTERM')

    const error = await requestPromise
    assert.ok(error instanceof Error, 'Pending request should be rejected with Error')
    assert.ok(error.message.includes('pi process exited'), 'Error message mentions process exit')
  })

  it('dispose() with custom signal propagates to child.kill()', async () => {
    const proc = PiRpcProcess.createForTest(fakeChild)

    // Track what signal was passed to kill
    let killedSignal: NodeJS.Signals | number | undefined
    const originalKill = fakeChild.kill.bind(fakeChild)
    fakeChild.kill = function (signal?: NodeJS.Signals | number): boolean {
      killedSignal = signal
      return originalKill(signal)
    }

    proc.dispose('SIGKILL')

    assert.strictEqual(killedSignal, 'SIGKILL', 'Custom signal should be passed to child.kill()')
    assert.strictEqual(fakeChild.killed, true, 'child should be killed')
  })
})