import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import type { CompanyBanScope, Vacancy, VacancyText, VacancyRelevanceRun } from '../api/contracts/vacancies'
import { analyzeVacanciesMock, getVacanciesMock, MOCK_SAVED_VACANCY_TEXT } from '../mocks/vacancies'
import { upsertCompanyBanMock } from '../mocks/bans'
import { getMockSelection, touchMockState } from '../mocks/state'
import type { BrowserCommandReceiptResponse } from '../api/contracts/browser'
import { waitForBrowserCommand } from './browser'
import { relevanceProgress } from './relevanceProgress'

export async function loadVacancies(searchId?: string | null, resumeId?: string | null): Promise<Vacancy[]> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить найденные вакансии')
    const state = getVacanciesMock(getMockScenario())
    const selectedResumeId = resumeId ?? getMockSelection().resumeId
    return structuredClone(searchId
      ? state.filter((vacancy) => vacancy.searchId === searchId)
      : state.filter((vacancy) => vacancy.resumeId === selectedResumeId))
  }
  if (!searchId && !resumeId) return []
  const params = new URLSearchParams()
  if (searchId) params.set('searchId', searchId)
  else if (resumeId) params.set('resumeId', resumeId)
  return apiRequest<Vacancy[]>(`/api/v1/vacancies?${params.toString()}`)
}

export async function setVacancyQueued(vacancyId: string, queuedForApplication: boolean): Promise<Vacancy> {
  if (isMockMode) {
    const vacancy = findMockVacancy(vacancyId)
    if (!isSelectable(vacancy)) return structuredClone(vacancy)
    vacancy.queuedForApplication = queuedForApplication
    touchMockState()
    return structuredClone(vacancy)
  }
  return apiRequest<Vacancy>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/application-queue`, {
    method: 'PUT', body: JSON.stringify({ queuedForApplication }),
  })
}

export async function loadVacancyText(vacancyId: string): Promise<VacancyText> {
  if (isMockMode) {
    const vacancy = findMockVacancy(vacancyId)
    return vacancy.status === 'ALREADY_APPLIED'
      ? { plainText: MOCK_SAVED_VACANCY_TEXT, textLoadedAt: vacancy.lastSeenAt }
      : { plainText: null, textLoadedAt: null }
  }
  return apiRequest<VacancyText>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/text`)
}

export interface VacancyRelevanceProgress {
  evaluated: number
  total: number
}

type RelevanceProgressListener = (progress: VacancyRelevanceProgress) => void
interface RelevanceTask {
  promise: Promise<void>
  progress: VacancyRelevanceProgress
  listeners: Set<RelevanceProgressListener>
}

const relevanceTasks = new Map<string, RelevanceTask>()

export function analyzeVacancyRelevance(
  resumeId: string,
  vacancies: Pick<Vacancy, 'id' | 'textLength'>[],
  initialProgress: VacancyRelevanceProgress,
  listener?: RelevanceProgressListener,
): Promise<void> {
  const current = relevanceTasks.get(resumeId)
  if (current) return attachToRelevanceTask(current, listener)
  const task: RelevanceTask = {
    promise: Promise.resolve(),
    progress: initialProgress,
    listeners: new Set(),
  }
  task.promise = runVacancyRelevance(vacancies, initialProgress, progress => updateRelevanceProgress(task, progress))
  relevanceTasks.set(resumeId, task)
  const cleanup = (): void => { if (relevanceTasks.get(resumeId) === task) relevanceTasks.delete(resumeId) }
  void task.promise.then(cleanup, cleanup)
  return attachToRelevanceTask(task, listener)
}

async function runVacancyRelevance(
  vacancies: Pick<Vacancy, 'id' | 'textLength'>[],
  initialProgress: VacancyRelevanceProgress,
  report: RelevanceProgressListener,
): Promise<void> {
  if (isMockMode) {
    await analyzeVacanciesMock(getMockScenario(), vacancies.map(vacancy => vacancy.id))
    report({ evaluated: initialProgress.evaluated + vacancies.length, total: initialProgress.total })
    return
  }
  const run = await apiRequest<VacancyRelevanceRun>('/api/v1/vacancies/relevance/parallel', {
    method: 'POST', body: JSON.stringify({
      vacancyIds: vacancies.map(vacancy => vacancy.id),
      totalCount: initialProgress.total,
      evaluatedBefore: initialProgress.evaluated,
    }),
  })
  await waitForRelevance(run, current => report(relevanceProgress(current, initialProgress)))
}

export async function followActiveVacancyRelevance(
  resumeId: string,
  initialProgress: VacancyRelevanceProgress,
  listener?: RelevanceProgressListener,
): Promise<boolean> {
  const local = relevanceTasks.get(resumeId)
  if (local) { await attachToRelevanceTask(local, listener); return true }
  if (isMockMode) return false
  const active = await apiRequest<VacancyRelevanceRun | undefined>(
    `/api/v1/vacancies/relevance/parallel/active?resumeId=${encodeURIComponent(resumeId)}`,
    { cache: 'no-store' },
  )
  if (!active) return false
  const task: RelevanceTask = {
    promise: Promise.resolve(),
    progress: initialProgress,
    listeners: new Set(),
  }
  task.promise = waitForRelevance(active, current => {
    updateRelevanceProgress(task, relevanceProgress(current, initialProgress))
  }).then(() => undefined)
  relevanceTasks.set(resumeId, task)
  try { await attachToRelevanceTask(task, listener) }
  finally { if (relevanceTasks.get(resumeId) === task) relevanceTasks.delete(resumeId) }
  return true
}

function attachToRelevanceTask(task: RelevanceTask, listener?: RelevanceProgressListener): Promise<void> {
  if (!listener) return task.promise
  listener(task.progress)
  task.listeners.add(listener)
  return task.promise.finally(() => task.listeners.delete(listener))
}

function updateRelevanceProgress(task: RelevanceTask, progress: VacancyRelevanceProgress): void {
  task.progress = progress
  task.listeners.forEach(listener => listener(progress))
}

async function waitForRelevance(initial: VacancyRelevanceRun, report?: (run: VacancyRelevanceRun) => void): Promise<VacancyRelevanceRun> {
  let run = initial
  report?.(run)
  while (run.status === 'queued' || run.status === 'running') {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    run = await apiRequest<VacancyRelevanceRun>(`/api/v1/vacancies/relevance/parallel/${encodeURIComponent(run.id)}`)
    report?.(run)
  }
  if (run.status === 'failed') throw new Error(run.errorMessage || 'Generation Agent не смог оценить вакансии')
  return run
}

export async function setManyVacanciesQueued(vacancyIds: string[], queuedForApplication: boolean): Promise<Vacancy[]> {
  if (isMockMode) {
    return Promise.all(vacancyIds.map((id) => setVacancyQueued(id, queuedForApplication)))
  }
  return apiRequest<Vacancy[]>('/api/v1/vacancies/application-queue', {
    method: 'PUT', body: JSON.stringify({ vacancyIds, queuedForApplication }),
  })
}

export async function skipVacancy(vacancyId: string): Promise<Vacancy> {
  if (isMockMode) {
    const vacancy = findMockVacancy(vacancyId)
    if (isSelectable(vacancy)) {
      vacancy.status = 'USER_SKIPPED'
      vacancy.queuedForApplication = false
      touchMockState()
    }
    return structuredClone(vacancy)
  }
  return apiRequest<Vacancy>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/skip`, { method: 'PUT' })
}

export async function restoreVacancy(vacancyId: string): Promise<Vacancy> {
  if (isMockMode) {
    const vacancy = findMockVacancy(vacancyId)
    if (vacancy.status === 'USER_SKIPPED') { vacancy.status = 'NEW'; touchMockState() }
    return structuredClone(vacancy)
  }
  return apiRequest<Vacancy>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/restore`, { method: 'PUT' })
}

export async function verifyQuestionnaireVacancyApplied(vacancyId: string): Promise<Vacancy> {
  if (isMockMode) {
    const vacancy = findMockVacancy(vacancyId)
    const questionnaire = vacancy.hasQuestionnaire === true || vacancy.enrichment?.userTestPresent === true
    if (vacancy.status === 'NEW' && questionnaire) {
      vacancy.status = 'ALREADY_APPLIED'
      vacancy.queuedForApplication = false
      touchMockState()
    }
    return structuredClone(vacancy)
  }
  const receipt = await apiRequest<BrowserCommandReceiptResponse>(
    `/api/v1/vacancies/${encodeURIComponent(vacancyId)}/questionnaire-application-check`, { method: 'POST' },
  )
  const command = await waitForBrowserCommand(receipt.commandId, 65_000)
  if (command.application === 'ALREADY_APPLIED' || command.application === 'VACANCY_ARCHIVED') {
    return apiRequest<Vacancy>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}`, { cache: 'no-store' })
  }
  const message = command.application === 'AUTH' ? 'Войдите в HH и повторите проверку.'
    : command.application === 'CAPTCHA' ? 'Пройдите проверку HH и попробуйте снова.'
      : command.application === 'VACANCY_UNAVAILABLE' ? 'Карточка вакансии больше недоступна на HH.'
        : command.application === 'BROWSER_UNAVAILABLE' ? 'Откройте браузер выбранного HH-аккаунта.'
          : 'Отклик на HH не найден. Сначала заполните и отправьте анкету.'
  throw new Error(message)
}

export async function banVacancyCompany(vacancyId: string, scope: CompanyBanScope): Promise<Vacancy[]> {
  if (isMockMode) {
    const state = getVacanciesMock(getMockScenario())
    const source = findMockVacancy(vacancyId)
    if (!source.company.id) throw new Error('HH не указал ID работодателя этой вакансии')
    const selection = getMockSelection()
    const affected = state.filter((vacancy) => vacancy.company.id === source.company.id && (scope === 'GLOBAL' || vacancy.resumeId === selection.resumeId))
    affected.forEach((vacancy) => {
      vacancy.status = 'COMPANY_BANNED'
      vacancy.queuedForApplication = false
      vacancy.banScope = scope
    })
    upsertCompanyBanMock(getMockScenario(), {
      employerUrl: `https://hh.ru/employer/${source.company.id}`,
      companyName: source.company.name,
      scope,
      resumeId: scope === 'RESUME' ? selection.resumeId : null,
      resumeName: scope === 'RESUME' ? (selection.resumeId === 'resume-java' ? 'Java-разработчик' : 'Маркетолог 2024') : null,
      sourceVacancyId: source.id,
      sourceVacancyTitle: source.title,
      hiddenVacanciesCount: affected.length,
    })
    return structuredClone(affected)
  }
  return apiRequest<Vacancy[]>(`/api/v1/vacancies/${encodeURIComponent(vacancyId)}/company-ban`, {
    method: 'POST', body: JSON.stringify({ scope }),
  })
}

function findMockVacancy(vacancyId: string): Vacancy {
  const vacancy = getVacanciesMock(getMockScenario()).find((item) => item.id === vacancyId)
  if (!vacancy) throw new Error('Вакансия не найдена')
  return vacancy
}

export function isSelectable(vacancy: Vacancy): boolean {
  return ['NEW', 'USER_SKIPPED'].includes(vacancy.status)
}
