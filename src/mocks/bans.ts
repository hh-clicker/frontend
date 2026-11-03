import type { MockScenario } from '../app/runtime'
import type { CompanyBan, SaveCompanyBanRequest } from '../api/contracts/bans'
import type { CompanyBanScope } from '../api/contracts/vacancies'
import { parseHhEmployerUrl } from '../utils/hhEmployerUrl'
import { getVacanciesMock } from './vacancies'
import { touchMockState } from './state'

const stateByScenario = new Map<MockScenario, CompanyBan[]>()

export function getCompanyBansMock(scenario: MockScenario): CompanyBan[] {
  const existing = stateByScenario.get(scenario)
  if (existing) return existing
  if (scenario === 'empty') {
    const empty: CompanyBan[] = []
    stateByScenario.set(scenario, empty)
    return empty
  }
  const vacancies = getVacanciesMock(scenario)
  const blockedCompanies = [...new Map(vacancies.filter((item) => item.status === 'COMPANY_BANNED').map((item) => [item.company.id, item.company])).values()]
    .filter((company): company is { id: string; name: string } => company.id !== null)
  const initial = blockedCompanies.map((company, index): CompanyBan => {
    const source = vacancies.find((item) => item.company.id === company.id)
    const scope: CompanyBanScope = source?.banScope ?? (index % 3 === 2 ? 'GLOBAL' : 'RESUME')
    const sourceResumeId = source?.resumeId ?? 'resume-marketing'
    return {
      id: `ban-${company.id}`, employerId: company.id, employerUrl: `https://hh.ru/employer/${company.id}`, companyName: company.name, scope,
      resumeId: scope === 'RESUME' ? sourceResumeId : null,
      resumeName: scope === 'RESUME' ? (sourceResumeId === 'resume-java' ? 'Java-разработчик' : 'Маркетолог 2024') : null,
      sourceVacancyId: source?.id ?? null, sourceVacancyTitle: source?.title ?? null,
      createdAt: index === 0 ? '31.08.2026, 12:44' : `${28 - index}.08.2026, 16:20`,
      hiddenVacanciesCount: vacancies.filter((item) => item.company.id === company.id).length,
    }
  })
  const state = scenario === 'partial' ? initial.slice(0, 1) : initial
  stateByScenario.set(scenario, state)
  return state
}

export function upsertCompanyBanMock(scenario: MockScenario, request: SaveCompanyBanRequest): CompanyBan {
  const state = getCompanyBansMock(scenario)
  const parsed = parseHhEmployerUrl(request.employerUrl)
  if (!parsed) throw new Error('Некорректная ссылка на работодателя HH')
  const matchingVacancies = getVacanciesMock(scenario).filter((vacancy) => vacancy.company.id === parsed.employerId && (request.scope === 'GLOBAL' || vacancy.resumeId === request.resumeId))
  const existing = state.find((item) => item.employerId === parsed.employerId)
  const companyName = request.companyName ?? matchingVacancies[0]?.company.name ?? existing?.companyName ?? `Работодатель #${parsed.employerId}`
  if (existing) {
    getVacanciesMock(scenario).forEach((vacancy) => {
      if (vacancy.company.id === parsed.employerId && vacancy.status === 'COMPANY_BANNED' && (existing.scope === 'GLOBAL' || vacancy.resumeId === existing.resumeId)) {
        vacancy.status = 'NEW'
        vacancy.banScope = null
      }
    })
  }
  matchingVacancies.forEach((vacancy) => {
    vacancy.status = 'COMPANY_BANNED'
    vacancy.banScope = request.scope
    vacancy.queuedForApplication = false
  })
  if (existing) {
    existing.companyName = companyName
    existing.employerUrl = parsed.canonicalUrl
    existing.scope = request.scope
    existing.resumeId = request.scope === 'RESUME' ? request.resumeId : null
    existing.resumeName = request.scope === 'RESUME' ? request.resumeName : null
    existing.sourceVacancyId = request.sourceVacancyId ?? existing.sourceVacancyId
    existing.sourceVacancyTitle = request.sourceVacancyTitle ?? existing.sourceVacancyTitle
    existing.hiddenVacanciesCount = request.hiddenVacanciesCount ?? (matchingVacancies.length || existing.hiddenVacanciesCount)
    touchMockState()
    return existing
  }
  const created: CompanyBan = {
    id: `ban-${crypto.randomUUID()}`, employerId: parsed.employerId, employerUrl: parsed.canonicalUrl, companyName, scope: request.scope,
    resumeId: request.scope === 'RESUME' ? request.resumeId : null,
    resumeName: request.scope === 'RESUME' ? request.resumeName : null,
    sourceVacancyId: request.sourceVacancyId ?? null, sourceVacancyTitle: request.sourceVacancyTitle ?? null,
    createdAt: 'Только что', hiddenVacanciesCount: request.hiddenVacanciesCount ?? matchingVacancies.length,
  }
  state.unshift(created)
  touchMockState()
  return created
}

export function removeCompanyBanMock(scenario: MockScenario, banId: string): void {
  const state = getCompanyBansMock(scenario)
  const index = state.findIndex((item) => item.id === banId)
  if (index < 0) throw new Error('Блокировка не найдена')
  const ban = state[index]!
  getVacanciesMock(scenario).forEach((vacancy) => {
    if (vacancy.company.id === ban.employerId && vacancy.status === 'COMPANY_BANNED' && (ban.scope === 'GLOBAL' || vacancy.resumeId === ban.resumeId)) {
      vacancy.status = 'NEW'
      vacancy.banScope = null
      vacancy.queuedForApplication = false
    }
  })
  state.splice(index, 1)
  touchMockState()
}
