import test from 'node:test'
import assert from 'node:assert/strict'
import { getPiCommand, getBackendName, shouldUseShellForPiCommand } from '../../src/pi-rpc/command.js'

test('getPiCommand: returns override when provided', () => {
  assert.equal(getPiCommand('my-custom-pi'), 'my-custom-pi')
  assert.equal(getPiCommand('gsd'), 'gsd')
  assert.equal(getPiCommand('/usr/local/bin/pi'), '/usr/local/bin/pi')
})

test('getPiCommand: auto-detects backend when no override', () => {
  // When no override is provided, getPiCommand delegates to BackendConfig's auto-detection.
  // The result depends on what's installed on the system (gsd first, pi fallback).
  // We can't easily test the exact result, but we can verify it returns a non-empty string.
  const cmd = getPiCommand()
  assert.ok(cmd.length > 0, 'auto-detected command should be non-empty')
})

test('getBackendName: returns valid backend name', () => {
  const name = getBackendName()
  assert.ok(name === 'gsd' || name === 'pi', 'backend name should be gsd or pi')
})

test('shouldUseShellForPiCommand: enables shell for Windows cmd launchers only', () => {
  const originalPlatform = process.platform
  Object.defineProperty(process, 'platform', { value: 'win32', writable: true, configurable: true })

  try {
    assert.equal(shouldUseShellForPiCommand('pi.cmd'), true)
    assert.equal(shouldUseShellForPiCommand('C:\\Users\\me\\AppData\\Roaming\\npm\\pi.CMD'), true)
    assert.equal(shouldUseShellForPiCommand('pi.bat'), true)
    assert.equal(shouldUseShellForPiCommand('pi'), false)
    assert.equal(shouldUseShellForPiCommand('C:\\tools\\pi.exe'), false)
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true, configurable: true })
  }
})

test('shouldUseShellForPiCommand: keeps shell disabled on non-Windows', () => {
  const originalPlatform = process.platform
  Object.defineProperty(process, 'platform', { value: 'darwin', writable: true, configurable: true })

  try {
    assert.equal(shouldUseShellForPiCommand('pi.cmd'), false)
    assert.equal(shouldUseShellForPiCommand('pi'), false)
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true, configurable: true })
  }
})