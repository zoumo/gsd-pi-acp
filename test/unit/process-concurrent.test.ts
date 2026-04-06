import test from 'node:test'
import assert from 'node:assert/strict'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeChildProcess } from '../helpers/fake-child.js'

test('multiple concurrent requests receive correct responses', async () => {
  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // Make two concurrent requests
  const statePromise = proc.getState()
  const modelsPromise = proc.getAvailableModels()

  // Wait a moment for stdin writes to complete
  await new Promise(resolve => setTimeout(resolve, 10))

  // Parse request IDs from stdin writes
  const stdinWrites = child.stdinWrites
  assert.ok(stdinWrites.length >= 2, 'should have two stdin writes')

  const stateRequest = JSON.parse(stdinWrites[0])
  const modelsRequest = JSON.parse(stdinWrites[1])

  assert.equal(stateRequest.type, 'get_state')
  assert.equal(modelsRequest.type, 'get_available_models')

  const stateId = stateRequest.id
  const modelsId = modelsRequest.id

  assert.ok(stateId, 'state request should have id')
  assert.ok(modelsId, 'models request should have id')
  assert.notEqual(stateId, modelsId, 'request IDs should be unique')

  // Send response for state request first
  child.emitStdoutJson({
    type: 'response',
    id: stateId,
    command: 'get_state',
    success: true,
    data: { status: 'ready', sessionFile: '/tmp/test-session.json' }
  })

  // Wait for state to resolve
  const stateResult = await statePromise
  assert.deepEqual(stateResult, { status: 'ready', sessionFile: '/tmp/test-session.json' })

  // Send response for models request
  child.emitStdoutJson({
    type: 'response',
    id: modelsId,
    command: 'get_available_models',
    success: true,
    data: { models: [{ id: 'model-1', name: 'Test Model' }] }
  })

  // Wait for models to resolve
  const modelsResult = await modelsPromise
  assert.deepEqual(modelsResult, { models: [{ id: 'model-1', name: 'Test Model' }] })

  proc.dispose()
})

test('responses are routed to correct callers regardless of send order', async () => {
  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // Make three concurrent requests
  const statePromise = proc.getState()
  const modelsPromise = proc.getAvailableModels()
  const commandsPromise = proc.getCommands()

  await new Promise(resolve => setTimeout(resolve, 10))

  const stdinWrites = child.stdinWrites
  assert.ok(stdinWrites.length >= 3, 'should have three stdin writes')

  const requests = stdinWrites.map(w => JSON.parse(w))
  const stateId = requests.find(r => r.type === 'get_state')!.id
  const modelsId = requests.find(r => r.type === 'get_available_models')!.id
  const commandsId = requests.find(r => r.type === 'get_commands')!.id

  // Send responses in reverse order (commands first, then models, then state)
  child.emitStdoutJson({
    type: 'response',
    id: commandsId,
    command: 'get_commands',
    success: true,
    data: { commands: ['help', 'exit'] }
  })

  child.emitStdoutJson({
    type: 'response',
    id: modelsId,
    command: 'get_available_models',
    success: true,
    data: { models: [{ id: 'm1' }] }
  })

  child.emitStdoutJson({
    type: 'response',
    id: stateId,
    command: 'get_state',
    success: true,
    data: { status: 'ready' }
  })

  // Each promise should resolve with its correct response
  const stateResult = await statePromise
  const modelsResult = await modelsPromise
  const commandsResult = await commandsPromise

  assert.deepEqual(stateResult, { status: 'ready' })
  assert.deepEqual(modelsResult, { models: [{ id: 'm1' }] })
  assert.deepEqual(commandsResult, { commands: ['help', 'exit'] })

  proc.dispose()
})

test('pending Map state transitions correctly during concurrent requests', async () => {
  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // Make two requests
  const promise1 = proc.getState()
  const promise2 = proc.getAvailableModels()

  await new Promise(resolve => setTimeout(resolve, 10))

  const stdinWrites = child.stdinWrites
  const requests = stdinWrites.map(w => JSON.parse(w))
  const id1 = requests[0].id
  const id2 = requests[1].id

  // Resolve first request
  child.emitStdoutJson({
    type: 'response',
    id: id1,
    command: 'get_state',
    success: true,
    data: { status: 'ok' }
  })

  const _result1 = await promise1

  // First request is done, second is still pending
  // Verify by making a third request and resolving it before the second
  const promise3 = proc.getSessionStats()

  await new Promise(resolve => setTimeout(resolve, 10))

  const request3 = JSON.parse(stdinWrites[stdinWrites.length - 1])
  const id3 = request3.id

  // Resolve third request before second
  child.emitStdoutJson({
    type: 'response',
    id: id3,
    command: 'get_session_stats',
    success: true,
    data: { turns: 5 }
  })

  const result3 = await promise3
  assert.deepEqual(result3, { turns: 5 })

  // Now resolve the second request (still pending)
  child.emitStdoutJson({
    type: 'response',
    id: id2,
    command: 'get_available_models',
    success: true,
    data: { models: [] }
  })

  const result2 = await promise2
  assert.deepEqual(result2, { models: [] })

  proc.dispose()
})

test('concurrent requests handle mixed success/failure correctly', async () => {
  const child = new FakeChildProcess()
  const proc = PiRpcProcess.createForTest(child)

  setTimeout(() => child.simulateSpawn(), 0)

  // Make two concurrent requests
  const statePromise = proc.getState()
  const modelsPromise = proc.getAvailableModels()

  await new Promise(resolve => setTimeout(resolve, 10))

  const stdinWrites = child.stdinWrites
  const requests = stdinWrites.map(w => JSON.parse(w))
  const stateId = requests.find(r => r.type === 'get_state')!.id
  const modelsId = requests.find(r => r.type === 'get_available_models')!.id

  // Send success response for state
  child.emitStdoutJson({
    type: 'response',
    id: stateId,
    command: 'get_state',
    success: true,
    data: { status: 'ready' }
  })

  // Send failure response for models
  child.emitStdoutJson({
    type: 'response',
    id: modelsId,
    command: 'get_available_models',
    success: false,
    error: 'No models available'
  })

  // State should resolve successfully
  const stateResult = await statePromise
  assert.deepEqual(stateResult, { status: 'ready' })

  // Models should throw
  try {
    await modelsPromise
    assert.fail('expected models to throw')
  } catch (err) {
    assert.ok(err instanceof Error)
    assert.ok(err.message.includes('get_available_models failed'))
    assert.ok(err.message.includes('No models available'))
  }

  proc.dispose()
})