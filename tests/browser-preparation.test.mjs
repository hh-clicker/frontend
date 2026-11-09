import test from 'node:test'
import assert from 'node:assert/strict'
import { BrowserPreparation } from '../src/services/browserPreparation.ts'

function ports(overrides = {}) {
  const calls = []
  return { calls, status: async () => ({ status: 'READY', browserOpen: false, activeProfileId: null }),
    profile: async id => ({ id: `profile-${id}` }),
    open: async id => { calls.push(`open:${id}`); return { authorization: { status: 'AUTHORIZED', message: null } } },
    waitReady: async id => { calls.push(`ready:${id}`) }, ...overrides }
}

test('closed browser is opened for the action account and readiness is awaited', async () => {
  const operations = ports()
  await new BrowserPreparation().ensure('account-a', operations)
  assert.deepEqual(operations.calls, ['open:account-a', 'ready:profile-account-a'])
})

test('existing matching profile is neither reopened nor checked for authorization', async () => {
  const operations = ports({ status: async () => ({ status: 'BUSY', browserOpen: true, activeProfileId: 'profile-a' }) })
  await new BrowserPreparation().ensure('a', operations)
  assert.deepEqual(operations.calls, [])
})

test('busy browser of a different account is not switched', async () => {
  const operations = ports({ status: async () => ({ status: 'BUSY', browserOpen: true, activeProfileId: 'profile-other' }) })
  await assert.rejects(new BrowserPreparation().ensure('a', operations), /завершения текущей операции/)
  assert.deepEqual(operations.calls, [])
})

test('manual login or CAPTCHA stops preparation before the requested action', async () => {
  const operations = ports({ open: async () => ({ authorization: { status: 'REQUIRED', message: 'Войдите вручную' } }) })
  await assert.rejects(new BrowserPreparation().ensure('a', operations), /Войдите вручную/)
  assert.deepEqual(operations.calls, [])
})

test('concurrent clicks share a launch; another account cannot replace it', async () => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const operations = ports({ waitReady: async () => gate })
  const preparation = new BrowserPreparation()
  const first = preparation.ensure('a', operations)
  const second = preparation.ensure('a', operations)
  await assert.rejects(preparation.ensure('b', operations), /другого аккаунта/)
  release()
  await Promise.all([first, second])
  assert.deepEqual(operations.calls, ['open:a'])
})
