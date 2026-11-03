import type { MockScenario } from '../app/runtime'
import type { ApplicationItem, ApplicationRun, ApplicationStatus, StartApplicationRunRequest } from '../api/contracts/applications'
import { getVacanciesMock } from './vacancies'
import { getMockSelection, touchMockState } from './state'

const resultStatuses: ApplicationStatus[] = ['SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'ATTENTION_REQUIRED', 'FAILED', 'CANCELLED']

function makeItems(prefix: string, count: number, offset = 0): ApplicationItem[] {
  const vacancies = getVacanciesMock('full')
  return Array.from({ length: count }, (_, index) => {
    const vacancy = vacancies[(index + offset) % vacancies.length]!
    const status = resultStatuses[(index + offset) % resultStatuses.length]!
    const outcome = status === 'ATTENTION_REQUIRED'
      ? (index % 2 === 0 ? 'UNKNOWN' : 'QUESTIONNAIRE')
      : undefined
    return {
      id: `${prefix}-item-${index + 1}`,
      vacancyId: vacancy.id,
      hhVacancyId: vacancy.hhVacancyId,
      vacancyTitle: vacancy.title,
      companyName: vacancy.company.name,
      status,
      outcome,
      attemptedAt: `31.08.2026, ${String(9 + (index % 8)).padStart(2, '0')}:${String(10 + index * 3).slice(-2)}`,
      message: outcome === 'QUESTIONNAIRE' ? 'После отклика необходимо заполнить анкету.'
        : outcome === 'UNKNOWN' ? 'Не удалось надёжно подтвердить результат отклика.'
          : status === 'FAILED' ? 'HH временно отклонил запрос. Можно повторить позже.' : null,
      hasQuestionnaire: outcome === 'QUESTIONNAIRE',
    }
  })
}

const initialRuns: ApplicationRun[] = [
  {
    id: 'run-24', sequence: 24, resumeId: 'resume-marketing', resumeName: 'Маркетолог 2024', status: 'RUNNING',
    createdAt: '31.08.2026, 14:20', startedAt: '31.08.2026, 14:21', finishedAt: null,
    dailyLimit: 20, pauseFromSeconds: 30, pauseToSeconds: 90, coverLetter: 'Здравствуйте! Меня заинтересовала ваша вакансия. Буду рад обсудить опыт и задачи команды.',
    skipQuestionnaires: false,
    applications: [
      ...makeItems('run-24', 11),
      ...Array.from({ length: 9 }, (_, index) => {
        const vacancy = getVacanciesMock('full')[(index + 12) % getVacanciesMock('full').length]!
        return { id: `run-24-queued-${index}`, vacancyId: vacancy.id, hhVacancyId: vacancy.hhVacancyId, vacancyTitle: vacancy.title, companyName: vacancy.company.name, status: index === 0 ? 'IN_PROGRESS' : 'QUEUED', attemptedAt: null, message: null, hasQuestionnaire: false } as ApplicationItem
      }),
    ],
  },
  {
    id: 'run-23', sequence: 23, resumeId: 'resume-marketing', resumeName: 'Маркетолог 2024', status: 'COMPLETED',
    createdAt: '30.08.2026, 11:04', startedAt: '30.08.2026, 11:05', finishedAt: '30.08.2026, 12:18',
    dailyLimit: 15, pauseFromSeconds: 35, pauseToSeconds: 100, coverLetter: 'Здравствуйте! Буду рад подробнее рассказать о своём опыте.',
    skipQuestionnaires: true, applications: makeItems('run-23', 15, 4),
  },
  {
    id: 'run-22', sequence: 22, resumeId: 'resume-java', resumeName: 'Java-разработчик', status: 'PAUSED_CAPTCHA',
    createdAt: '29.08.2026, 16:30', startedAt: '29.08.2026, 16:31', finishedAt: null,
    dailyLimit: 10, pauseFromSeconds: 40, pauseToSeconds: 120, coverLetter: '',
    skipQuestionnaires: false, applications: withFirstAttentionOutcome(makeItems('run-22', 10, 8), 'CAPTCHA'),
  },
]

function withFirstAttentionOutcome(items: ApplicationItem[], outcome: 'CAPTCHA' | 'AUTH'): ApplicationItem[] {
  const item = items.find((candidate) => candidate.status === 'ATTENTION_REQUIRED')
  if (item) {
    item.outcome = outcome
    item.message = outcome === 'CAPTCHA'
      ? 'В браузере нужно пройти ручную проверку HH.'
      : 'Нужно заново войти в HH.'
    item.hasQuestionnaire = false
  }
  return items
}

const stateByScenario = new Map<MockScenario, ApplicationRun[]>()

export function getApplicationRunsMock(scenario: MockScenario): ApplicationRun[] {
  const existing = stateByScenario.get(scenario)
  if (existing) return existing
  const initial = scenario === 'empty' ? [] : scenario === 'partial' ? initialRuns.slice(0, 1) : initialRuns
  const state = structuredClone(initial)
  stateByScenario.set(scenario, state)
  return state
}

export function createApplicationRunMock(scenario: MockScenario, request: StartApplicationRunRequest): ApplicationRun {
  const state = getApplicationRunsMock(scenario)
  const vacancies = getVacanciesMock(scenario)
  const sequence = Math.max(24, ...state.map((run) => run.sequence)) + 1
  const resumeId = getMockSelection().resumeId
  const dryRun = request.mode === 'DRY_RUN'
  const applications = request.vacancyIds.map((vacancyId, index): ApplicationItem => {
    const vacancy = vacancies.find((item) => item.id === vacancyId)
    return {
      id: `run-${sequence}-item-${index + 1}`, vacancyId,
      hhVacancyId: vacancy?.hhVacancyId,
      vacancyTitle: vacancy?.title ?? `Вакансия ${vacancyId}`, companyName: vacancy?.company.name ?? 'Компания не указана',
      status: dryRun ? 'SUCCEEDED' : request.skipQuestionnaires && vacancy?.hasQuestionnaire ? 'ATTENTION_REQUIRED' : index === 0 ? 'IN_PROGRESS' : 'QUEUED',
      outcome: dryRun ? 'TEXT_LOADED' : undefined,
      attemptedAt: dryRun || request.skipQuestionnaires && vacancy?.hasQuestionnaire ? 'Только что' : null,
      message: dryRun ? 'Текст вакансии сохранён. Статус вакансии не изменён.' : request.skipQuestionnaires && vacancy?.hasQuestionnaire ? 'Для продолжения требуется заполнить анкету.' : null,
      hasQuestionnaire: vacancy?.hasQuestionnaire ?? false,
    }
  })
  const run: ApplicationRun = {
    id: `run-${sequence}`, sequence, resumeId, resumeName: resumeId === 'resume-java' ? 'Java-разработчик' : 'Маркетолог 2024',
    mode: dryRun ? 'DRY_RUN' : 'APPLY', status: dryRun ? 'COMPLETED' : 'RUNNING',
    createdAt: 'Только что', startedAt: 'Только что', finishedAt: dryRun ? 'Только что' : null,
    dailyLimit: request.dailyLimit, pauseFromSeconds: request.pauseFromSeconds, pauseToSeconds: request.pauseToSeconds,
    coverLetter: request.coverLetter, skipQuestionnaires: request.skipQuestionnaires, applications, aiLetter: request.aiLetter ? { ...request.aiLetter } : undefined,
  }
  state.unshift(run)
  if (!dryRun) request.vacancyIds.forEach((vacancyId) => {
    const vacancy = vacancies.find((item) => item.id === vacancyId)
    if (vacancy) { vacancy.status = 'ALREADY_APPLIED'; vacancy.queuedForApplication = false }
  })
  touchMockState()
  return structuredClone(run)
}
