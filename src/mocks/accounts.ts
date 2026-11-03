import type { MockScenario } from '../app/runtime'
import type { HhAccount } from '../api/contracts/accounts'
import { registerMockAccount, touchMockState } from './state'

const initialAccounts: HhAccount[] = [
  {
    id: 'account-1', name: 'Аккаунт #1', hhUserId: null, authorizationStatus: 'AUTHORIZED',
    createdAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'account-2', name: 'Рабочий HH', hhUserId: null, authorizationStatus: 'REQUIRED',
    createdAt: '2026-08-25T10:00:00Z', updatedAt: '2026-08-25T10:00:00Z',
  },
]

const stateByScenario = new Map<MockScenario, HhAccount[]>()

export function getAccountsMock(scenario: MockScenario): HhAccount[] {
  let accounts = stateByScenario.get(scenario)
  if (!accounts) {
    accounts = structuredClone(initialAccounts)
    stateByScenario.set(scenario, accounts)
  }
  return accounts
}

export function createAccountMock(scenario: MockScenario, rawName: string): HhAccount {
  const now = new Date().toISOString()
  const account: HhAccount = {
    id: `account-${crypto.randomUUID()}`,
    name: rawName.trim(),
    hhUserId: null,
    authorizationStatus: 'UNKNOWN',
    createdAt: now,
    updatedAt: now,
  }
  getAccountsMock(scenario).push(account)
  registerMockAccount(account.id)
  touchMockState()
  return account
}
