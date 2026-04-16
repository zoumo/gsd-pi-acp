import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareSemver, isSemver } from '../../src/acp/model-utils.js'

describe('compareSemver', () => {
  it('returns -1 when a < b (patch)', () => {
    assert.equal(compareSemver('1.0.0', '1.0.1'), -1)
  })

  it('returns 1 when a > b (major)', () => {
    assert.equal(compareSemver('2.0.0', '1.9.9'), 1)
  })

  it('returns 0 for equal versions', () => {
    assert.equal(compareSemver('1.2.3', '1.2.3'), 0)
  })

  it('pre-release < release when numeric parts equal', () => {
    assert.equal(compareSemver('1.0.0-alpha', '1.0.0'), -1)
  })

  it('release > pre-release when numeric parts equal', () => {
    assert.equal(compareSemver('1.0.0', '1.0.0-beta'), 1)
  })

  it('both pre-release with equal numeric parts treated as equal', () => {
    assert.equal(compareSemver('1.0.0-alpha', '1.0.0-beta'), 0)
  })

  it('pre-release with different numeric parts compares numerically', () => {
    assert.equal(compareSemver('1.0.0-alpha', '2.0.0'), -1)
    assert.equal(compareSemver('2.0.0-rc1', '1.9.9'), 1)
  })
})

describe('isSemver', () => {
  it('accepts standard semver', () => {
    assert.equal(isSemver('1.2.3'), true)
  })

  it('accepts semver with pre-release', () => {
    assert.equal(isSemver('1.0.0-alpha.1'), true)
  })

  it('rejects non-semver', () => {
    assert.equal(isSemver('latest'), false)
    assert.equal(isSemver('1.0'), false)
  })
})
