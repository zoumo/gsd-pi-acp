import test from 'node:test'
import assert from 'node:assert/strict'
import { getBackendCommand } from '../../src/backend/config.js'

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

const ENV_KEY = 'PI_ACP_PI_COMMAND'

// --- gsd detection: basename starts with 'gsd' ---

test('getBackendCommand: bare "gsd" → gsd backend', () => {
  withEnv(ENV_KEY, 'gsd', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'gsd')
    assert.equal(result.command, 'gsd')
  })
})

test('getBackendCommand: "/usr/local/bin/gsd" → gsd backend (basename is gsd)', () => {
  withEnv(ENV_KEY, '/usr/local/bin/gsd', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'gsd')
  })
})

test('getBackendCommand: "gsd.cmd" → gsd backend (basename starts with gsd)', () => {
  withEnv(ENV_KEY, 'gsd.cmd', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'gsd')
  })
})

test('getBackendCommand: "gsd-nightly" → gsd backend', () => {
  withEnv(ENV_KEY, 'gsd-nightly', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'gsd')
  })
})

// --- pi detection: basename does NOT start with 'gsd' ---

test('getBackendCommand: bare "pi" → pi backend', () => {
  withEnv(ENV_KEY, 'pi', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'pi')
    assert.equal(result.command, 'pi')
  })
})

test('getBackendCommand: "/pitools/gsd-disabled/pi" → pi backend (Bug #15 — gsd in path, not basename)', () => {
  withEnv(ENV_KEY, '/pitools/gsd-disabled/pi', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'pi', 'should detect pi from basename, not match gsd in directory name')
  })
})

test('getBackendCommand: "/opt/gsd-data/tools/pi" → pi backend (gsd in directory, not basename)', () => {
  withEnv(ENV_KEY, '/opt/gsd-data/tools/pi', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'pi', 'gsd in parent directory should not trigger gsd backend')
  })
})

test('getBackendCommand: "/opt/gsd-old/bin/pi" → pi backend', () => {
  withEnv(ENV_KEY, '/opt/gsd-old/bin/pi', () => {
    const result = getBackendCommand()
    assert.equal(result.backend, 'pi')
  })
})

// --- env override sets autoDetected=false ---

test('getBackendCommand: env override sets autoDetected=false', () => {
  withEnv(ENV_KEY, 'pi', () => {
    const result = getBackendCommand()
    assert.equal(result.autoDetected, false)
  })
})
