import test from 'node:test'
import assert from 'node:assert/strict'
import { collectNotificationEvents, rememberRuns } from '../src/services/notificationEvents.ts'

const settings = { desktopEnabled: true, soundEnabled: true, notifyRunCompleted: true, notifyRunPaused: true, notifyAttentionRequired: true, notifyRelevanceCompleted: true, notifyMarketCompleted: true }
const run = (overrides = {}) => ({ id: 'run-1', accountId: 'account-1', resumeId: 'resume-1', resumeName: 'PHP-разработчик', sequence: 1,
  status: 'RUNNING', mode: 'APPLY', revision: 'r1', total: 4, succeeded: 0, failed: 0, attentionIds: [], ...overrides })
const state = (runs, relevanceRuns = [], preferences = settings) => ({ runs, relevanceRuns, settings: preferences })
const remembered = (runs, relevanceRuns = []) => rememberRuns(state(runs, relevanceRuns))
const events = (before, after, preferences = settings) => collectNotificationEvents(before, state(after, [], preferences))

test('initial history is a silent baseline', () => {
  assert.deepEqual(events(null, [run({ status: 'COMPLETED', attentionIds: ['item'] })]), [])
})
test('completion produces one event including attention counts', () => {
  const result = events(remembered([run()]), [run({ status: 'COMPLETED', succeeded: 3, attentionIds: ['item'] })])
  assert.equal(result.length, 1)
  assert.equal(result[0].title, 'Запуск завершён')
  assert.match(result[0].body, /требуют внимания 1/)
})
test('dry run completion describes loaded texts instead of sent applications', () => {
  const before = remembered([run({ mode: 'DRY_RUN' })])
  const result = events(before, [run({ mode: 'DRY_RUN', status: 'COMPLETED', succeeded: 3, failed: 1 })])
  assert.equal(result[0].title, 'Загрузка текстов завершена')
  assert.match(result[0].body, /текст загружен для 3, не удалось загрузить 1/)
})
test('dry run automatic pause has its own title', () => {
  const before = remembered([run({ mode: 'DRY_RUN' })])
  const result = events(before, [run({ mode: 'DRY_RUN', status: 'PAUSED_ERROR', revision: 'r2' })])
  assert.equal(result[0].title, 'Загрузка текстов приостановлена')
})
for (const status of ['PAUSED_CAPTCHA', 'PAUSED_AUTH', 'PAUSED_ERROR', 'PAUSED_LIMIT']) {
  test(`${status} notifies once without a duplicate attention alert`, () => {
    const current = [run({ status, attentionIds: ['item'] })]
    assert.equal(events(remembered([run()]), current).length, 1)
    assert.equal(events(remembered(current), current).length, 0)
  })
}
test('manual pause, cancellation and running updates are silent', () => {
  for (const status of ['PAUSED_USER', 'CANCELLED', 'RUNNING']) {
    assert.equal(events(remembered([run()]), [run({ status, revision: 'r2' })]).length, 0)
  }
})
test('new attention while running is grouped per run', () => {
  const result = events(remembered([run()]), [run({ attentionIds: ['a', 'b'] })])
  assert.equal(result.length, 1)
  assert.match(result[0].body, /2 вакансий/)
})
test('acknowledgment does not replay or notify', () => {
  assert.deepEqual(events(remembered([run({ attentionIds: ['a'] })]), [run()]), [])
})
test('disabled completion still allows independent attention notification', () => {
  const result = events(remembered([run()]), [run({ status: 'COMPLETED', attentionIds: ['a'] })], { ...settings, notifyRunCompleted: false })
  assert.equal(result[0].title, 'Новые задачи внимания')
})
test('disabled events are remembered without replay after enabling', () => {
  const current = [run({ status: 'COMPLETED', attentionIds: ['a'] })]
  assert.deepEqual(events(remembered([run()]), current, { ...settings, notifyRunCompleted: false, notifyAttentionRequired: false }), [])
  assert.deepEqual(events(remembered(current), current), [])
})
test('resume followed by the same blocker has a new revision', () => {
  const previous = remembered([run({ status: 'PAUSED_CAPTCHA', revision: 'old' })])
  assert.equal(events(previous, [run({ status: 'PAUSED_CAPTCHA', revision: 'new' })]).length, 1)
})
test('reload with persisted state does not duplicate events', () => {
  const current = [run({ status: 'COMPLETED', attentionIds: ['a'] })]
  const persisted = JSON.parse(JSON.stringify(remembered(current)))
  assert.deepEqual(events(persisted, current), [])
})
test('new run completed between polls is detected and retains account context', () => {
  const current = run({ id: 'run-2', accountId: 'account-2', resumeId: 'resume-2', status: 'COMPLETED' })
  const result = events(remembered([run()]), [current])
  assert.equal(result.length, 1)
  assert.equal(result[0].accountId, 'account-2')
})

test('completed relevance run notifies and opens vacancies for its resume', () => {
  const relevance = { id: 'relevance-1', accountId: 'account-2', resumeId: 'resume-2', resumeName: 'PHP',
    status: 'done', revision: 'r2', finalBatch: true, requestedCount: 344, evaluatedCount: 338, missingCount: 6, errorMessage: null }
  const result = collectNotificationEvents(remembered([], [{ ...relevance, status: 'running', revision: 'r1' }]), state([], [relevance]))
  assert.equal(result[0].title, 'Оценка вакансий завершена')
  assert.match(result[0].body, /338 из 344/)
  assert.equal(result[0].url, '/vacancies')
})

test('completed intermediate relevance batch is silent', () => {
  const relevance = { id: 'relevance-1', accountId: 'account-1', resumeId: 'resume-1', resumeName: 'PHP',
    status: 'done', revision: 'r2', finalBatch: false, requestedCount: 100, evaluatedCount: 100, missingCount: 0, errorMessage: null }
  const result = collectNotificationEvents(remembered([], [{ ...relevance, status: 'running', revision: 'r1' }]), state([], [relevance]))
  assert.deepEqual(result, [])
})

test('market analysis completion and failure notify after a known running state', () => {
  const market = { id: 'market-1', accountId: 'account-1', resumeId: 'resume-1', resumeName: 'Java',
    status: 'RUNNING', phase: 'EXTRACT', revision: 'r1', updatedAt: '2026-10-20T13:00:00Z', processed: 8, total: 20, error: null }
  const before = { ...state([], []), marketAnalyses: [market] }
  const complete = { ...market, status: 'COMPLETED', revision: 'r2', processed: 20 }
  const completedState = { ...state([], []), marketAnalyses: [complete] }
  assert.equal(collectNotificationEvents(rememberRuns(before), completedState)[0].title, 'Анализ рынка завершён')
  assert.equal(collectNotificationEvents(rememberRuns(completedState), completedState).length, 0)
  const failed = { ...market, status: 'FAILED', revision: 'r3', error: 'Сетевая ошибка' }
  const failure = collectNotificationEvents(rememberRuns(before), { ...state([], []), marketAnalyses: [failed] })
  assert.equal(failure[0].title, 'Не удалось завершить анализ рынка')
  assert.match(failure[0].body, /Сетевая ошибка/)
  assert.deepEqual(collectNotificationEvents(rememberRuns(before), {
    ...completedState, settings: { ...settings, notifyMarketCompleted: false },
  }), [])
})

test('existing market analysis is a silent baseline on upgrade', () => {
  const market = { id: 'market-1', accountId: 'account-1', resumeId: 'resume-1', resumeName: 'Java',
    status: 'COMPLETED', phase: 'DONE', revision: 'r1', updatedAt: '2026-10-20T13:00:00Z', processed: 20, total: 20, error: null }
  const snapshot = { ...state([], []), marketAnalyses: [market] }
  assert.deepEqual(collectNotificationEvents(remembered([]), snapshot), [])
})
