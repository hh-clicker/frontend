import test from 'node:test'
import assert from 'node:assert/strict'
import { relevanceProgress } from '../src/services/relevanceProgress.ts'

test('restoring a partially persisted run does not count completed batches twice', () => {
  assert.deepEqual(relevanceProgress({ evaluatedBefore: 100, evaluatedCount: 30, totalCount: 500 },
    { evaluated: 130, total: 500 }), { evaluated: 130, total: 500 })
})

test('out-of-order batch completion adds to the original run baseline', () => {
  const initial = { evaluated: 10, total: 500 }
  assert.deepEqual(relevanceProgress({ evaluatedBefore: 10, evaluatedCount: 20, totalCount: 500 }, initial),
    { evaluated: 30, total: 500 })
  assert.deepEqual(relevanceProgress({ evaluatedBefore: 10, evaluatedCount: 35, totalCount: 500 }, initial),
    { evaluated: 45, total: 500 })
})
