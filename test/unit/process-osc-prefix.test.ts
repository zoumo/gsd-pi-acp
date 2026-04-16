import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PiRpcProcess, type PiRpcEvent } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'

/**
 * gsd prepends OSC terminal escape sequences (e.g. \x1b]777;notify;...\x07)
 * to certain NDJSON lines like agent_start and agent_end.
 * Verify the adapter extracts JSON from these lines instead of dropping them.
 */
describe('PiRpcProcess OSC-prefixed NDJSON lines', () => {
  let fakeChild: FakeChildProcess
  let proc: PiRpcProcess
  let receivedEvents: PiRpcEvent[]

  beforeEach(() => {
    fakeChild = new FakeChildProcess()
    proc = PiRpcProcess.createForTest(fakeChild)
    receivedEvents = []
    proc.onEvent(ev => receivedEvents.push(ev))
  })

  it('parses agent_start with OSC prefix', async () => {
    // Simulate gsd output: OSC 777 notification prepended to agent_start
    fakeChild.emitStdoutLine('\x1b]777;notify;Pi;Started\x07{"type":"agent_start"}')

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 1)
    assert.equal(receivedEvents[0]!.type, 'agent_start')
  })

  it('parses agent_end with OSC prefix', async () => {
    // Simulate gsd output: OSC 777 notification prepended to agent_end
    fakeChild.emitStdoutLine('\x1b]777;notify;Pi;Ready for input\x07{"type":"agent_end","messages":[]}')

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 1)
    assert.equal(receivedEvents[0]!.type, 'agent_end')
  })

  it('parses turn_end with OSC prefix', async () => {
    fakeChild.emitStdoutLine('\x1b]777;notify;Pi;Done\x07{"type":"turn_end"}')

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 1)
    assert.equal(receivedEvents[0]!.type, 'turn_end')
  })

  it('still handles clean JSON lines (no prefix)', async () => {
    fakeChild.emitStdoutJson({ type: 'agent_start' })
    fakeChild.emitStdoutJson({ type: 'agent_end', messages: [] })

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 2)
    assert.equal(receivedEvents[0]!.type, 'agent_start')
    assert.equal(receivedEvents[1]!.type, 'agent_end')
  })

  it('still treats non-JSON lines as prelude', async () => {
    fakeChild.emitStdoutLine('Welcome to gsd v2.70.1')

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 0)
    const prelude = proc.consumePreludeLines()
    assert.ok(prelude.some(l => l.includes('Welcome to gsd')))
  })

  it('treats OSC-only lines (no JSON) as prelude', async () => {
    // Line with OSC prefix but no JSON after it
    fakeChild.emitStdoutLine('\x1b]777;notify;Pi;Started\x07')

    await new Promise(resolve => setTimeout(resolve, 20))

    assert.equal(receivedEvents.length, 0)
  })
})
