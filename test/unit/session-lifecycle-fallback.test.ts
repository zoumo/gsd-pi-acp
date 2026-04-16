import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { advertiseCommands } from '../../src/acp/session-lifecycle.js'

/**
 * Test that the fallback sessionUpdate path in advertiseCommands()
 * does not produce unhandled rejections when conn.sessionUpdate() throws.
 * (Bug #14)
 */

describe('advertiseCommands fallback error handling (#14)', () => {
  const captured: unknown[] = []
  let handler: (reason: unknown) => void

  afterEach(() => {
    if (handler) process.removeListener('unhandledRejection', handler)
    captured.length = 0
  })

  it('does not produce unhandled rejection when fallback sessionUpdate throws', async () => {
    handler = (reason: unknown) => captured.push(reason)
    process.on('unhandledRejection', handler)

    const fakeConn = {
      sessionUpdate: async () => {
        throw new Error('connection closed')
      }
    }

    // proc.getCommands() throws → triggers fallback path
    // then conn.sessionUpdate() in fallback also throws → should be caught
    const fakeProc = {
      getCommands: async () => { throw new Error('getCommands failed') }
    }

    advertiseCommands(
      fakeConn as any,
      'session-123',
      fakeProc as any,
      [],
      { enableSkillCommands: false }
    )

    // Wait long enough for setTimeout(fn, 0) + async IIFE to settle
    await new Promise(resolve => setTimeout(resolve, 100))

    assert.equal(
      captured.length,
      0,
      `Expected no unhandled rejections, but got: ${captured.map(String).join(', ')}`
    )
  })

  it('does not produce unhandled rejection when only primary path throws', async () => {
    handler = (reason: unknown) => captured.push(reason)
    process.on('unhandledRejection', handler)

    let sessionUpdateCalls = 0
    const fakeConn = {
      sessionUpdate: async () => {
        sessionUpdateCalls++
        // Fallback call succeeds
      }
    }

    const fakeProc = {
      getCommands: async () => { throw new Error('getCommands failed') }
    }

    advertiseCommands(
      fakeConn as any,
      'session-123',
      fakeProc as any,
      [],
      { enableSkillCommands: false }
    )

    await new Promise(resolve => setTimeout(resolve, 100))

    assert.equal(captured.length, 0, 'No unhandled rejections')
    assert.equal(sessionUpdateCalls, 1, 'Fallback sessionUpdate should be called once')
  })

  it('does not produce unhandled rejection when primary path succeeds', async () => {
    handler = (reason: unknown) => captured.push(reason)
    process.on('unhandledRejection', handler)

    let sessionUpdateCalls = 0
    const fakeConn = {
      sessionUpdate: async () => { sessionUpdateCalls++ }
    }

    const fakeProc = {
      getCommands: async () => ([])
    }

    advertiseCommands(
      fakeConn as any,
      'session-123',
      fakeProc as any,
      [],
      { enableSkillCommands: false }
    )

    await new Promise(resolve => setTimeout(resolve, 100))

    assert.equal(captured.length, 0, 'No unhandled rejections')
    // Primary path succeeded → sessionUpdate called once, fallback not reached
    assert.equal(sessionUpdateCalls, 1, 'Primary sessionUpdate should be called once')
  })
})
