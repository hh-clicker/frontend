import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshResumeTextFromHh } from '../src/services/resumeTextRefresh.ts'

test('refresh saves only after a successful read and keeps the originally selected resume target', async () => {
  const target = { id: 'local-a', accountId: 'account-a', hhResumeId: 'hash-a' }
  const calls = []
  const result = await refreshResumeTextFromHh(target, {
    prepare: async account => { calls.push(['prepare', account]); target.id = 'local-b'; target.hhResumeId = 'hash-b' },
    read: async (account, hash) => { calls.push(['read', account, hash]); return '  Updated resume\nExperience  ' },
    save: async (id, text) => { calls.push(['save', id, text]); return { id, plainText: text } },
  })
  assert.equal(result.id, 'local-a')
  assert.deepEqual(calls, [['prepare', 'account-a'], ['read', 'account-a', 'hash-a'], ['save', 'local-a', 'Updated resume\nExperience']])
})
test('browser/read failures and invalid text never reach persistence', async () => {
  for (const failure of ['prepare', 'read', 'empty', 'oversized']) {
    let writes = 0
    await assert.rejects(refreshResumeTextFromHh({ id: 'a', accountId: 'b', hhResumeId: 'c' }, {
      prepare: async () => { if (failure === 'prepare') throw new Error('Browser unavailable') },
      read: async () => { if (failure === 'read') throw new Error('Parsing failure'); return failure === 'empty' ? ' \n ' : 'x'.repeat(100001) },
      save: async () => { writes++; return {} },
    }))
    assert.equal(writes, 0)
  }
})
