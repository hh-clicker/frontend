import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSelectorDiagnosticRepair } from '../src/services/selectorDiagnosticSummary.ts'

const step = (pageType, status, tabId) => ({ pageType, status, tabId, checkedAt: '2026-11-08T00:00:00Z', rows: [], message: status })
test('repairing a full diagnostic step preserves other failures, blocked steps and their repair handles', () => {
  const profile = step('PROFILE', 'CHECKED', 'profile-tab')
  const resume = step('RESUME', 'BLOCKED')
  const search = { ...step('SEARCH', 'CHECKED', 'search-tab'), repairableGroups: ['search'], rows: [{ status: 'FAIL' }] }
  const previous = { ...step('FULL', 'CHECKED'), scenarios: [profile, resume, search] }
  const fixed = { ...profile, repairNote: 'Saved', rows: [{ status: 'PASS' }] }
  const merged = mergeSelectorDiagnosticRepair(previous, profile, fixed)
  assert.equal(merged.pageType, 'FULL')
  assert.equal(merged.scenarios[0].repairNote, 'Saved')
  assert.equal(merged.scenarios[1], resume)
  assert.equal(merged.scenarios[2], search)
  assert.equal(merged.summary, 'FAILED')
  assert.equal(previous.scenarios[0], profile)
})
test('agent continuation updates dependent steps without merging back stale blocked results', () => {
  const previous = { ...step('FULL', 'CHECKED'), scenarios: [step('PROFILE', 'CHECKED', 'tab'), step('RESUME', 'BLOCKED')] }
  const result = { ...previous, scenarios: [step('PROFILE', 'CHECKED', 'tab'), step('RESUME', 'CHECKED', 'new-tab')] }
  assert.equal(mergeSelectorDiagnosticRepair(previous, previous.scenarios[0], result), result)
})
test('a single-tab repair remains a single-tab report', () => {
  const previous = step('PROFILE', 'CHECKED', 'tab')
  const result = { ...previous, repairNote: 'Saved' }
  assert.equal(mergeSelectorDiagnosticRepair(previous, previous, result), result)
})
