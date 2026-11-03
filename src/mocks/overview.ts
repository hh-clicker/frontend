import type { MockScenario } from '../app/runtime'
import type { AttentionKind, OverviewMetric, OverviewResponse } from '../api/contracts/overview'
import type { ApplicationRun } from '../api/contracts/applications'
import { getApplicationRunsMock } from './applications'
import { getAttentionTasksMock } from './attention'
import { getBrowserPageMock } from './browser'
import { getSearchesMock } from './searches'
import { getMockSelection } from './state'
import { getVacanciesMock } from './vacancies'
import { getAccountsMock } from './accounts'
import { getResumesMock } from './resumes'

export function createOverviewMock(scenario: MockScenario): OverviewResponse {
  const selection = getMockSelection()
  const accounts = getAccountsMock(scenario).map(({ id, name }) => ({ id, name }))
  const selectedAccountId = accounts.some((account) => account.id === selection.accountId)
    ? selection.accountId
    : accounts[0]?.id ?? null
  const accountResumes = getResumesMock(scenario).items
    .filter((resume) => resume.accountId === selectedAccountId)
  const resumes = accountResumes
    .map(({ id, name }) => ({ id, name }))
  const selectedResumeId = resumes.some((item) => item.id === selection.resumeId) ? selection.resumeId : resumes[0]?.id ?? null
  const selectedResumeName = resumes.find((item) => item.id === selectedResumeId)?.name ?? 'Резюме'
  const searches = getSearchesMock(scenario).filter((search) => search.resumeId === selectedResumeId)
  const vacancies = getVacanciesMock(scenario).filter((vacancy) => vacancy.resumeId === selectedResumeId)
  const runs = getApplicationRunsMock(scenario).filter((run) => run.resumeId === selectedResumeId)
  const tasks = getAttentionTasksMock(scenario).filter((task) => task.resumeName === selectedResumeName)
  const browser = getBrowserPageMock(scenario)
  const dailyLimit = accountResumes.find((resume) => resume.id === selectedResumeId)?.settings.dailyLimit ?? 0
  const applications = runs.flatMap((run) => run.applications)
  const activeRun = runs.find((run) => ['RUNNING', 'PAUSED_USER', 'PAUSED_CAPTCHA', 'PAUSED_AUTH'].includes(run.status)) ?? null
  const attemptedToday = applications.filter((item) => !['QUEUED', 'CANCELLED'].includes(item.status)).length
  const metrics: OverviewMetric[] = [
    { id: 'new', label: 'Новые вакансии', value: vacancies.filter((item) => item.status === 'NEW').length, hint: `${searches.length} сохранённых поиска`, tone: 'purple' },
    { id: 'selected', label: 'Выбраны к отклику', value: vacancies.filter((item) => item.queuedForApplication).length, hint: 'Текущая очередь', tone: 'blue' },
    { id: 'succeeded', label: 'Успешно сегодня', value: applications.filter((item) => item.status === 'SUCCEEDED').length, hint: 'По выбранному резюме', tone: 'green' },
    { id: 'attention', label: 'Требуют внимания', value: tasks.filter((item) => item.status === 'OPEN').length, hint: 'Ожидают решения', tone: 'orange' },
    { id: 'limit', label: 'Остаток лимита', value: Math.max(0, dailyLimit - attemptedToday), hint: `из ${dailyLimit} в день`, tone: 'blue' },
  ]
  return {
    accounts, selectedAccountId, resumes, selectedResumeId,
    agentStatus: browser.agent.status, authorizationStatus: browser.agent.authorizationStatus,
    activeRun: activeRun ? summarizeRun(activeRun) : null, metrics,
    recentSearches: searches.slice(0, 3).map((search) => ({ id: search.id, name: search.name, createdAt: search.createdAt, newVacancies: search.newVacancies, status: search.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE' })),
    attentionItems: tasks.filter((task) => task.status === 'OPEN').slice(0, 3).map((task) => ({ id: task.id, vacancy: task.vacancyTitle ?? task.title, company: task.companyName ?? selectedResumeName, kind: task.kind as AttentionKind, occurredAt: task.occurredAt })),
  }
}

function summarizeRun(run: ApplicationRun) {
  return {
    id: run.id, sequence: run.sequence, status: run.status as 'RUNNING' | 'PAUSED_USER' | 'PAUSED_CAPTCHA' | 'PAUSED_AUTH',
    processed: run.applications.filter((item) => !['QUEUED', 'IN_PROGRESS'].includes(item.status)).length,
    total: run.applications.length,
    succeeded: run.applications.filter((item) => item.status === 'SUCCEEDED').length,
    attention: run.applications.filter((item) => item.status === 'ATTENTION_REQUIRED').length,
    failed: run.applications.filter((item) => item.status === 'FAILED').length,
  }
}
