import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeCommands } from '../../src/acp/builtin-commands.js'

test('mergeCommands: preserves order and de-dupes (first wins)', () => {
  const res = mergeCommands(
    [{ name: 'a', description: 'desc-a' }, { name: 'b', description: 'desc-b' }],
    [{ name: 'b', description: 'desc-b2' }, { name: 'c', description: 'desc-c' }]
  )
  assert.deepEqual(res, [
    { name: 'a', description: 'desc-a' },
    { name: 'b', description: 'desc-b' },
    { name: 'c', description: 'desc-c' }
  ])
})
