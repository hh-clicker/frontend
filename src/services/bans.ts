import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import type { CompanyBan, SaveCompanyBanRequest } from '../api/contracts/bans'
import type { CompanyBanScope } from '../api/contracts/vacancies'
import { getCompanyBansMock, removeCompanyBanMock, upsertCompanyBanMock } from '../mocks/bans'
import { getMockSelection } from '../mocks/state'

export async function loadCompanyBans(resumeId?: string | null): Promise<CompanyBan[]> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить стоп-лист')
    const selectedResumeId = resumeId || getMockSelection().resumeId
    return structuredClone(getCompanyBansMock(getMockScenario()).filter((ban) => ban.scope === 'GLOBAL' || ban.resumeId === selectedResumeId))
  }
  if (!resumeId) return []
  return apiRequest<CompanyBan[]>(`/api/v1/company-bans?resumeId=${encodeURIComponent(resumeId)}`)
}

export async function createCompanyBan(request: SaveCompanyBanRequest): Promise<CompanyBan> {
  if (isMockMode) return structuredClone(upsertCompanyBanMock(getMockScenario(), request))
  return apiRequest<CompanyBan>('/api/v1/company-bans', { method: 'POST', body: JSON.stringify(request) })
}

export async function updateCompanyBanScope(banId: string, scope: CompanyBanScope, resumeId: string | null, resumeName: string | null): Promise<CompanyBan> {
  if (isMockMode) {
    const ban = getCompanyBansMock(getMockScenario()).find((item) => item.id === banId)
    if (!ban) throw new Error('Блокировка не найдена')
    return structuredClone(upsertCompanyBanMock(getMockScenario(), { ...ban, scope, resumeId, resumeName }))
  }
  return apiRequest<CompanyBan>(`/api/v1/company-bans/${encodeURIComponent(banId)}/scope`, { method: 'PUT', body: JSON.stringify({ scope, resumeId }) })
}

export async function removeCompanyBan(banId: string): Promise<void> {
  if (isMockMode) return removeCompanyBanMock(getMockScenario(), banId)
  await apiRequest<void>(`/api/v1/company-bans/${encodeURIComponent(banId)}`, { method: 'DELETE' })
}
