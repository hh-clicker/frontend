import type { MockScenario } from '../app/runtime'
import type { AppSettings, SettingsPageResponse, TelegramConnection } from '../api/contracts/settings'

const stateByScenario = new Map<MockScenario, SettingsPageResponse>()
const telegramByScenario = new Map<MockScenario, TelegramConnection>()

export function getSettingsMock(scenario: MockScenario): SettingsPageResponse {
  const existing = stateByScenario.get(scenario)
  if (existing) return existing
  const result: SettingsPageResponse = {
    settings: {
      notifications: {
        desktopEnabled: true, soundEnabled: true, notifyRunCompleted: true,
        notifyRunPaused: true, notifyAttentionRequired: true,
        notifyRelevanceCompleted: true,
        notifyMarketCompleted: true,
      },
    },
  }
  if (scenario === 'partial') result.settings.notifications.soundEnabled = false
  if (scenario === 'empty') {
    result.settings.notifications.desktopEnabled = false
    result.settings.notifications.soundEnabled = false
  }
  stateByScenario.set(scenario, result)
  return result
}

export function saveSettingsMock(scenario: MockScenario, settings: AppSettings): SettingsPageResponse {
  const state = getSettingsMock(scenario)
  state.settings = structuredClone(settings)
  return state
}

export function getTelegramMock(scenario: MockScenario): TelegramConnection {
  const existing = telegramByScenario.get(scenario)
  if (existing) return existing
  const state: TelegramConnection = {
    status: 'DISCONNECTED', botUsername: null, pairingUrl: null, pairingExpiresAt: null, lastError: null,
  }
  telegramByScenario.set(scenario, state)
  return state
}

export function connectTelegramMock(scenario: MockScenario): TelegramConnection {
  const state = getTelegramMock(scenario)
  Object.assign(state, {
    status: 'WAITING_FOR_START', botUsername: 'hh_clicker_demo_bot',
    pairingUrl: 'https://t.me/hh_clicker_demo_bot?start=mock',
    pairingExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), lastError: null,
  })
  return state
}

export function testTelegramMock(scenario: MockScenario): TelegramConnection {
  return getTelegramMock(scenario)
}

export function disconnectTelegramMock(scenario: MockScenario): TelegramConnection {
  const state = getTelegramMock(scenario)
  Object.assign(state, {
    status: 'DISCONNECTED', botUsername: null, pairingUrl: null, pairingExpiresAt: null, lastError: null,
  })
  return state
}
