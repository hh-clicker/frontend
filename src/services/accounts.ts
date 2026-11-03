import { apiRequest } from '../api/client'
import type { CreateAccountRequest, HhAccount } from '../api/contracts/accounts'
import { getMockScenario, isMockMode } from '../app/runtime'
import { createAccountMock } from '../mocks/accounts'

export async function createAccount(request: CreateAccountRequest): Promise<HhAccount> {
  if (isMockMode) return structuredClone(createAccountMock(getMockScenario(), request.name))
  return apiRequest<HhAccount>('/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

