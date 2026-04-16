import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'
import { readFile, rm } from 'node:fs/promises'

/**
 * Test that subprocess stderr data is forwarded to debugLog() instead of
 * being silently swallowed. (Bug #29)
 */

describe('subprocess stderr debug logging (#29)', () => {
  const logPath = '/tmp/pi-acp-stderr-test-debug.log'
  let savedDebugLog: string | undefined
  let savedDebugLogPath: string | undefined

  beforeEach(async () => {
    savedDebugLog = process.env.PI_ACP_DEBUG_LOG
    savedDebugLogPath = process.env.PI_ACP_DEBUG_LOG_PATH
    // Enable debug logging to a temp file
    process.env.PI_ACP_DEBUG_LOG = '1'
    process.env.PI_ACP_DEBUG_LOG_PATH = logPath
    // Clean up any previous test log
    await rm(logPath, { force: true })
  })

  afterEach(() => {
    if (savedDebugLog === undefined) {
      delete process.env.PI_ACP_DEBUG_LOG
    } else {
      process.env.PI_ACP_DEBUG_LOG = savedDebugLog
    }
    if (savedDebugLogPath === undefined) {
      delete process.env.PI_ACP_DEBUG_LOG_PATH
    } else {
      process.env.PI_ACP_DEBUG_LOG_PATH = savedDebugLogPath
    }
  })

  it('forwards stderr data to debugLog when debug logging is enabled', async () => {
    const fakeChild = new FakeChildProcess()
    const _proc = PiRpcProcess.createForTest(fakeChild)

    // Emit stderr data
    fakeChild.stderr.push(Buffer.from('warning: something went wrong\n'))

    // Wait for async debugLog to flush
    await new Promise(resolve => setTimeout(resolve, 200))

    const logContents = await readFile(logPath, 'utf-8')
    assert.ok(
      logContents.includes('subprocess stderr:'),
      `Debug log should contain 'subprocess stderr:' prefix, got: ${logContents}`
    )
    assert.ok(
      logContents.includes('warning: something went wrong'),
      `Debug log should contain the stderr content, got: ${logContents}`
    )
  })

  it('forwards multiple stderr chunks to debugLog', async () => {
    const fakeChild = new FakeChildProcess()
    const _proc = PiRpcProcess.createForTest(fakeChild)

    // Emit multiple stderr chunks
    fakeChild.stderr.push(Buffer.from('first error\n'))
    fakeChild.stderr.push(Buffer.from('second error\n'))

    // Wait for async debugLog to flush
    await new Promise(resolve => setTimeout(resolve, 200))

    const logContents = await readFile(logPath, 'utf-8')
    assert.ok(
      logContents.includes('first error'),
      `Debug log should contain first stderr chunk`
    )
    assert.ok(
      logContents.includes('second error'),
      `Debug log should contain second stderr chunk`
    )
  })

  it('does not throw when stderr emits data and debug logging is disabled', async () => {
    // Disable debug logging
    delete process.env.PI_ACP_DEBUG_LOG

    const fakeChild = new FakeChildProcess()
    const _proc = PiRpcProcess.createForTest(fakeChild)

    // This should not throw — debugLog is a no-op when disabled
    fakeChild.stderr.push(Buffer.from('some stderr output\n'))

    // Wait a tick to ensure no errors surface
    await new Promise(resolve => setTimeout(resolve, 50))

    // If we get here without an error, the test passes
    assert.ok(true, 'No error thrown when stderr emits with debug logging disabled')
  })
})
