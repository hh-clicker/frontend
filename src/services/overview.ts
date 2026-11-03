import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import type { OverviewResponse } from '../api/contracts/overview'
import { createOverviewMock } from '../mocks/overview'

export async function loadOverview(accountId?: string | null, resumeId?: string | null): Promise<OverviewResponse> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить данные обзора')
    return createOverviewMock(getMockScenario())
  }

  const params = new URLSearchParams()
  if (accountId) params.set('accountId', accountId)
  if (resumeId) params.set('resumeId', resumeId)
  const query = params.size ? `?${params.toString()}` : ''
  return apiRequest<OverviewResponse>(`/api/v1/overview${query}`)
}
