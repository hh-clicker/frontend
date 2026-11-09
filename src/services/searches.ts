import { getMockScenario, isMockMode } from '../app/runtime'
import { normalizeHhSearchUrl } from '../utils/hhSearchUrl'
import { apiRequest } from '../api/client'
import type { CreateSearchRequest, SearchDefinition, UpdateSearchRequest } from '../api/contracts/searches'
import type { Vacancy } from '../api/contracts/vacancies'
import { getSearchesMock } from '../mocks/searches'
import { createVacancyEnrichmentMock, getVacanciesMock } from '../mocks/vacancies'
import { getResumesMock } from '../mocks/resumes'
import { getMockSelection, touchMockState } from '../mocks/state'
import { ensureBrowserForResume } from './browser'

export async function loadSearches(resumeId?: string | null): Promise<SearchDefinition[]> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить сохранённые поиски')
    const selectedResumeId = resumeId ?? getMockSelection().resumeId
    return structuredClone(getSearchesMock(getMockScenario()).filter((search) => search.resumeId === selectedResumeId))
  }
  if (resumeId === null) return []
  const query = resumeId ? `?resumeId=${encodeURIComponent(resumeId)}` : ''
  return apiRequest<SearchDefinition[]>(`/api/v1/searches${query}`)
}

export async function loadSearch(searchId: string): Promise<SearchDefinition> {
  if (isMockMode) return structuredClone(findMockSearch(searchId))
  return apiRequest<SearchDefinition>(`/api/v1/searches/${encodeURIComponent(searchId)}`)
}

export async function updateSearch(searchId: string, request: UpdateSearchRequest): Promise<SearchDefinition> {
  request = { ...request, sourceUrl: normalizeHhSearchUrl(request.sourceUrl) }
  if (isMockMode) {
    const search = findMockSearch(searchId)
    if (search.status === 'SCANNING') throw new Error('Дождитесь завершения сканирования')
    validateMockSearchResume(search.resumeId, request.sourceUrl)
    if (getSearchesMock(getMockScenario()).some((other) => other.id !== searchId && other.resumeId === search.resumeId
        && normalizeHhSearchUrl(other.sourceUrl) === request.sourceUrl)) throw new Error('Такой поиск уже сохранён')
    Object.assign(search, request, { status: 'ACTIVE', lastError: null })
    touchMockState()
    return structuredClone(search)
  }
  return apiRequest<SearchDefinition>(`/api/v1/searches/${encodeURIComponent(searchId)}`, {
    method: 'PUT', body: JSON.stringify(request),
  })
}

export async function createSearch(request: CreateSearchRequest): Promise<SearchDefinition> {
  request = { ...request, sourceUrl: normalizeHhSearchUrl(request.sourceUrl) }
  if (isMockMode) {
    validateMockSearchResume(request.resumeId, request.sourceUrl)
    const state = getSearchesMock(getMockScenario())
    const created: SearchDefinition = {
      id: `search-${crypto.randomUUID()}`,
      ...request,
      status: 'ACTIVE',
      newVacancies: 0,
      totalVacancies: 0,
      createdAt: new Date().toLocaleString('ru-RU'),
      lastScannedAt: null,
      lastError: null,
      scanProgress: null,
    }
    state.unshift(created)
    touchMockState()
    return structuredClone(created)
  }
  return apiRequest<SearchDefinition>('/api/v1/searches', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

function validateMockSearchResume(resumeId: string, sourceUrl: string): void {
  const resume = getResumesMock(getMockScenario()).items.find((item) => item.id === resumeId)
  if (!resume) throw new Error('Резюме не найдено')
  const urlResumeId = new URL(sourceUrl).searchParams.get('resume')?.trim()
  if (urlResumeId && urlResumeId !== resume.hhResumeId) throw new Error('Резюме в ссылке не совпадает с выбранным резюме')
}

export async function setSearchPaused(searchId: string, paused: boolean): Promise<SearchDefinition> {
  if (isMockMode) {
    const search = findMockSearch(searchId)
    search.status = paused ? 'PAUSED' : 'ACTIVE'
    search.lastError = null
    touchMockState()
    return structuredClone(search)
  }
  return apiRequest<SearchDefinition>(`/api/v1/searches/${encodeURIComponent(searchId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ paused }),
  })
}

export async function scanSearch(searchId: string): Promise<SearchDefinition> {
  const target = await loadSearch(searchId)
  await ensureBrowserForResume(target.resumeId)
  if (isMockMode) {
    const search = findMockSearch(searchId)
    search.status = 'SCANNING'
    search.scanProgress = { startedAt: new Date().toISOString(), currentPage: 0, totalPages: null, collected: 0, totalResults: null }
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    search.status = 'ACTIVE'
    search.newVacancies = 7
    search.totalVacancies += 7
    const vacancies = getVacanciesMock(getMockScenario())
    const stamp = Date.now()
    for (let index = 0; index < 7; index += 1) {
      const vacancy: Vacancy = {
        id: `vacancy-scan-${stamp}-${index}`, resumeId: search.resumeId, hhVacancyId: `scan-${stamp}-${index}`, searchId: search.id, title: `Новая вакансия по поиску «${search.name}»`,
        company: { id: `scan-company-${stamp}-${index}`, name: `Новая компания ${index + 1}` }, salary: null,
        location: 'Москва', workFormat: index % 2 ? 'Гибрид' : 'Удалённо', experience: '1–3 года',
        publishedAt: new Date().toISOString(), salaryText: '', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
        labels: [], status: 'NEW', queuedForApplication: false, banScope: null, hasQuestionnaire: false,
      }
      vacancy.enrichment = createVacancyEnrichmentMock(vacancy, vacancies.length)
      vacancies.push(vacancy)
    }
    search.lastScannedAt = 'Только что'
    search.lastError = null
    search.scanProgress = null
    touchMockState()
    return structuredClone(search)
  }
  return apiRequest<SearchDefinition>(`/api/v1/searches/${encodeURIComponent(searchId)}/scan`, { method: 'POST' })
}

export async function archiveSearch(searchId: string): Promise<void> {
  if (isMockMode) {
    const state = getSearchesMock(getMockScenario())
    const index = state.findIndex((item) => item.id === searchId)
    if (index >= 0) {
      getVacanciesMock(getMockScenario()).forEach((vacancy) => {
        if (vacancy.searchId === searchId) vacancy.searchId = null
      })
      state.splice(index, 1)
    }
    touchMockState()
    return
  }
  await apiRequest<void>(`/api/v1/searches/${encodeURIComponent(searchId)}`, { method: 'DELETE' })
}

function findMockSearch(searchId: string): SearchDefinition {
  const search = getSearchesMock(getMockScenario()).find((item) => item.id === searchId)
  if (!search) throw new Error('Поиск не найден')
  return search
}
