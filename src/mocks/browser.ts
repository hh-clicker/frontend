import type { MockScenario } from '../app/runtime'
import type { BrowserAgentDetails, BrowserPageResponse, BrowserProfile } from '../api/contracts/browser'
import { getMockSelection, touchMockState } from './state'

const agentsByScenario = new Map<MockScenario, BrowserAgentDetails>()
const profilesByScenario = new Map<MockScenario, Map<string, BrowserProfile>>()

function createProfile(accountId: string): BrowserProfile {
  return {
    id: accountId === 'account-1' ? '845657608' : String(Date.now()), tags: ['HH', 'Основной'], accountId,
    processStatus: 'STOPPED', createdAt: '18.08.2026, 12:40', lastStartedAt: 'Сегодня, 09:58',
    profileDirectory: `profiles/${accountId}/hh`,
  }
}

export function getBrowserPageMock(scenario: MockScenario): BrowserPageResponse {
  let agent = agentsByScenario.get(scenario)
  if (!agent) {
    const offline = scenario === 'agent-offline'
    agent = {
      status: offline ? 'OFFLINE' : scenario === 'scanning' ? 'BUSY' : 'READY', authorizationStatus: offline ? 'REQUIRED' : 'AUTHORIZED',
      version: '0.1.0', endpoint: 'ws://host.docker.internal:7331', host: 'Windows 11 · локальный компьютер', browserVersion: 'Chromium 151.0.0.0',
    }
    agentsByScenario.set(scenario, agent)
  }
  let profiles = profilesByScenario.get(scenario)
  if (!profiles) {
    profiles = new Map<string, BrowserProfile>()
    if (scenario !== 'empty') profiles.set('account-1', createProfile('account-1'))
    profilesByScenario.set(scenario, profiles)
  }
  const profile = profiles.get(getMockSelection().accountId) ?? null
  if (profile && scenario === 'scanning') profile.processStatus = 'RUNNING'
  return { agent, profile }
}

export function createBrowserProfileMock(scenario: MockScenario, accountId: string): BrowserProfile {
  const profiles = profilesByScenario.get(scenario) ?? new Map<string, BrowserProfile>()
  profilesByScenario.set(scenario, profiles)
  const existing = profiles.get(accountId)
  if (existing) return existing
  const created = { ...createProfile(accountId), createdAt: 'Только что', lastStartedAt: null }
  profiles.set(accountId, created)
  touchMockState()
  return created
}

export function setBrowserRunningMock(scenario: MockScenario, running: boolean): BrowserProfile {
  const state = getBrowserPageMock(scenario)
  if (state.agent.status === 'OFFLINE') throw new Error('Browser Agent не подключён')
  if (!state.profile) throw new Error('Сначала создайте профиль браузера')
  state.profile.processStatus = running ? 'RUNNING' : 'STOPPED'
  if (running) state.profile.lastStartedAt = 'Только что'
  touchMockState()
  return state.profile
}

export function setBrowserAgentEndpointMock(scenario: MockScenario, endpoint: string): void {
  getBrowserPageMock(scenario).agent.endpoint = endpoint
}
