import type { MockScenario } from '../app/runtime'
import type { SearchDefinition } from '../api/contracts/searches'

const initialSearches: SearchDefinition[] = [
  {
    id: 'search-python',
    name: 'Python-разработчик',
    sourceUrl: 'https://hh.ru/search/vacancy?resume=11111111111111111111111111111111111111&area=1&search_field=name&search_field=description',
    resumeId: 'resume-marketing',
    resumeName: 'Маркетолог 2024',
    pagesLimit: 5,
    status: 'ACTIVE',
    newVacancies: 12,
    totalVacancies: 346,
    createdAt: '31.08.2026, 10:15',
    lastScannedAt: 'Сегодня, 10:15',
    lastError: null,
    scanProgress: null,
  },
  {
    id: 'search-django',
    name: 'Django Backend',
    sourceUrl: 'https://hh.ru/search/vacancy?resume=11111111111111111111111111111111111111&area=1&text=Django',
    resumeId: 'resume-marketing',
    resumeName: 'Маркетолог 2024',
    pagesLimit: 3,
    status: 'ACTIVE',
    newVacancies: 0,
    totalVacancies: 0,
    createdAt: '26.08.2026, 16:48',
    lastScannedAt: null,
    lastError: null,
    scanProgress: null,
  },
  {
    id: 'search-data',
    name: 'Data Engineer',
    sourceUrl: 'https://hh.ru/search/vacancy?resume=4a245a95285b42bc97ef2185cff16d3c&area=1&text=Data+Engineer',
    resumeId: 'resume-java',
    resumeName: 'Java-разработчик',
    pagesLimit: 4,
    status: 'PAUSED',
    newVacancies: 4,
    totalVacancies: 97,
    createdAt: '22.08.2026, 09:30',
    lastScannedAt: '29.08.2026, 18:24',
    lastError: null,
    scanProgress: null,
  },
  {
    id: 'search-java-error',
    name: 'Java Remote',
    sourceUrl: 'https://hh.ru/search/vacancy?resume=4a245a95285b42bc97ef2185cff16d3c&area=113&text=Java',
    resumeId: 'resume-java',
    resumeName: 'Java-разработчик',
    pagesLimit: 5,
    status: 'ERROR',
    newVacancies: 0,
    totalVacancies: 52,
    createdAt: '20.08.2026, 12:10',
    lastScannedAt: 'Сегодня, 08:51',
    lastError: 'HH потребовал повторную авторизацию.',
    scanProgress: null,
  },
]

const stateByScenario = new Map<MockScenario, SearchDefinition[]>()

export function getSearchesMock(scenario: MockScenario): SearchDefinition[] {
  const existing = stateByScenario.get(scenario)
  if (existing) return existing

  const initial = scenario === 'empty'
    ? []
    : scenario === 'partial'
      ? initialSearches.slice(0, 1)
      : initialSearches
  const state = structuredClone(initial)
  if (scenario === 'scanning' && state[0]) {
    state[0].status = 'SCANNING'
    state[0].scanProgress = {
      startedAt: new Date(Date.now() - 48_000).toISOString(),
      currentPage: 2,
      totalPages: 4,
      collected: 200,
      totalResults: 346,
    }
  }
  stateByScenario.set(scenario, state)
  return state
}

export function resetSearchesMock(scenario: MockScenario): void {
  stateByScenario.delete(scenario)
}
