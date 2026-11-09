import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnosticIssueRoute, parseDiagnosticEntry, selectorRepairReady } from '../src/services/selectorDiagnosticEntry.ts'

test('runtime issue links to its own scenario and tab, carrying failed field names but no page values', () => {
  const tabId = '11111111-1111-4111-8111-111111111111'
  const route = diagnosticIssueRoute({ report: { pageType: 'SEARCH', tabId, rows: [
    { status: 'FAIL', purpose: 'Название компании', selector: 'a[href="/private/path"]' },
    { status: 'PASS', purpose: 'Зарплата' },
  ] } }, 'account-one')
  assert.equal(route.path, '/browser')
  assert.deepEqual(parseDiagnosticEntry(route.query), { pageType: 'SEARCH', tabId, fields: 'Название компании', accountId: 'account-one' })
  assert.doesNotMatch(JSON.stringify(route), /private|Зарплата|debugSelectors/)
})
test('unknown scenarios and malformed tab handles cannot trigger a targeted diagnostic', () => {
  assert.equal(parseDiagnosticEntry({ diagnostic: 'FULL' }), null)
  assert.equal(parseDiagnosticEntry({ diagnostic: ['SEARCH'] }), null)
  assert.equal(parseDiagnosticEntry({ diagnostic: 'VACANCY', diagnosticTab: 'https://example.test' }).tabId, null)
})
test('repair requires confirmed generation readiness, not just a response or an old READY during refresh', () => {
  for (const state of ['AUTH_REQUIRED', 'UNAVAILABLE', 'CHECK_FAILED', 'AGENT_OFFLINE', 'UNKNOWN', 'STALE'])
    assert.equal(selectorRepairReady({ state, refreshing: false }), false)
  assert.equal(selectorRepairReady(null), false)
  assert.equal(selectorRepairReady({ state: 'READY', refreshing: true }), false)
  assert.equal(selectorRepairReady({ state: 'READY', refreshing: false }), true)
})
