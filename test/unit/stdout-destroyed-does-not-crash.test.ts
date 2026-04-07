import test from 'node:test'
import assert from 'node:assert/strict'
import { stdoutWrite } from '../../src/stdout-writer.js'

// Regression test: the real stdout writer should not throw
// if stdout is marked as destroyed.

test('stdout writer: resolves even if stdout is destroyed', async () => {
  const prevDestroyed = (process.stdout as any).destroyed
  const prevWritable = (process.stdout as any).writable

  try {
    ;(process.stdout as any).destroyed = true
    ;(process.stdout as any).writable = false

    await stdoutWrite(new Uint8Array([1, 2, 3]))
    assert.ok(true)
  } finally {
    ;(process.stdout as any).destroyed = prevDestroyed
    ;(process.stdout as any).writable = prevWritable
  }
})
