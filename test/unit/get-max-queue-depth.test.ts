import test from 'node:test'
import assert from 'node:assert/strict'
import { getMaxQueueDepth } from '../../src/acp/session.js'

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const prev = process.env[key]
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
  try {
    fn()
  } finally {
    if (prev === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = prev
    }
  }
}

const ENV_KEY = 'PI_ACP_MAX_QUEUE_DEPTH'

test('getMaxQueueDepth: returns env value when valid positive integer', () => {
  withEnv(ENV_KEY, '5', () => {
    assert.equal(getMaxQueueDepth(), 5)
  })
})

test('getMaxQueueDepth: returns env value for large positive integer', () => {
  withEnv(ENV_KEY, '100', () => {
    assert.equal(getMaxQueueDepth(), 100)
  })
})

test('getMaxQueueDepth: returns 20 for negative value', () => {
  withEnv(ENV_KEY, '-1', () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})

test('getMaxQueueDepth: returns 20 for large negative value', () => {
  withEnv(ENV_KEY, '-999', () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})

test('getMaxQueueDepth: returns 20 for zero', () => {
  withEnv(ENV_KEY, '0', () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})

test('getMaxQueueDepth: returns 20 for NaN string', () => {
  withEnv(ENV_KEY, 'abc', () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})

test('getMaxQueueDepth: returns 20 for empty string', () => {
  withEnv(ENV_KEY, '', () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})

test('getMaxQueueDepth: returns 20 when env var is undefined', () => {
  withEnv(ENV_KEY, undefined, () => {
    assert.equal(getMaxQueueDepth(), 20)
  })
})
