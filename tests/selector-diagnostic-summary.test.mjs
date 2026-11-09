import test from 'node:test'
import assert from 'node:assert/strict'
import { selectorDiagnosticSummary } from '../src/services/selectorDiagnosticSummary.ts'

const report = rows => ({ pageType: 'PROFILE', status: 'CHECKED', rows })
test('closed forms and optional absent fields do not make successful checks incomplete', () => {
  assert.equal(selectorDiagnosticSummary(report([{ status: 'PASS' }, { status: 'NOT_APPLICABLE' }])), 'PASSED')
  assert.equal(selectorDiagnosticSummary(report([{ status: 'PASS' }, { status: 'STATE_NOT_CHECKED' }])), 'PASSED')
})
test('a genuine failed field takes priority over skipped dependent scenarios', () => {
  assert.equal(selectorDiagnosticSummary({ ...report([]), pageType: 'FULL', scenarios: [
    report([{ status: 'FAIL' }]), { ...report([]), status: 'SKIPPED' },
  ] }), 'FAILED')
})
test('unverified fields, login and unavailable dependencies are incomplete, not passed', () => {
  assert.equal(selectorDiagnosticSummary(report([{ status: 'NOT_CHECKED' }])), 'INCOMPLETE')
  assert.equal(selectorDiagnosticSummary({ ...report([]), status: 'LOGIN' }), 'INCOMPLETE')
  assert.equal(selectorDiagnosticSummary({ ...report([]), scenarios: [{ ...report([]), status: 'SKIPPED' }] }), 'INCOMPLETE')
})

test('a dependent step blocked by a previous error is explicitly failed', () => {
  assert.equal(selectorDiagnosticSummary({ ...report([]), status: 'BLOCKED' }), 'FAILED')
})
