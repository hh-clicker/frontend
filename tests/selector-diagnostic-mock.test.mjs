import test from 'node:test'
import assert from 'node:assert/strict'
import { createSelectorDiagnosticsMock } from '../src/mocks/selectorDiagnostics.ts'

test('mock full repair preserves independent failures and unblocks the dependent scenarios', () => {
  const diagnose = createSelectorDiagnosticsMock()
  let report = diagnose('account', 'resume', 'full', 'FULL')
  assert.equal(report.scenarios.find(step => step.pageType === 'RESUME').status, 'BLOCKED')
  assert.equal(report.scenarios.find(step => step.pageType === 'VACANCY').status, 'BLOCKED')
  for (const pageType of ['PROFILE', 'RESUME', 'SEARCH', 'VACANCY']) {
    const step = report.scenarios.find(step => step.pageType === pageType)
    assert.equal(step.status, 'CHECKED')
    report = diagnose('account', 'resume', 'full', 'CURRENT', step.tabId, step.repairableGroups[0])
    assert.equal(report.pageType, 'FULL')
    assert.equal(report.scenarios.find(step => step.pageType === pageType).summary, 'PASSED')
    if (pageType === 'PROFILE') assert.equal(report.scenarios.find(step => step.pageType === 'SEARCH').summary, 'FAILED')
  }
  assert.equal(report.summary, 'PASSED')
  assert.equal(diagnose('another-account', 'resume', 'full', 'FULL').summary, 'FAILED')
})

test('a mock failed repair does not silently change the report to success', () => {
  const diagnose = createSelectorDiagnosticsMock()
  const report = diagnose('account', null, 'error', 'FULL')
  const step = report.scenarios[0]
  assert.throws(() => diagnose('account', null, 'error', 'CURRENT', step.tabId, 'profile'), /не сохранено/)
  assert.equal(diagnose('account', null, 'error', 'FULL').scenarios[0].summary, 'FAILED')
})

test('mock current-tab repair stays a current-tab report and shares fixes with a later full check', () => {
  const diagnose = createSelectorDiagnosticsMock()
  const selection = diagnose('account', null, 'partial', 'CURRENT')
  assert.equal(selection.status, 'SELECT_TAB')
  assert.equal(selection.tabs.length, 4)
  const vacancy = diagnose('account', null, 'partial', 'CURRENT', selection.tabs[3].tabId)
  assert.equal(vacancy.pageType, 'VACANCY')
  const fixed = diagnose('account', null, 'partial', 'CURRENT', vacancy.tabId, 'vacancy')
  assert.equal(fixed.pageType, 'VACANCY')
  assert.equal(fixed.summary, 'PASSED')
  assert.ok(fixed.rows.some(row => row.status === 'STATE_NOT_CHECKED'))
  assert.equal(diagnose('account', null, 'partial', 'FULL').summary, 'PASSED')
})
