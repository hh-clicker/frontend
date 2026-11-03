import type { AppSettings, SettingsPageResponse, TelegramConnection } from '../api/contracts/settings'
import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import { connectTelegramMock, disconnectTelegramMock, getSettingsMock, getTelegramMock, saveSettingsMock, testTelegramMock } from '../mocks/settings'

export async function loadSettings(): Promise<SettingsPageResponse> {
  if (!isMockMode) return apiRequest<SettingsPageResponse>('/api/v1/settings')
  if (getMockScenario() === 'error') throw new Error('Не удалось загрузить настройки уведомлений')
  return structuredClone(getSettingsMock(getMockScenario()))
}

export async function saveSettings(settings: AppSettings): Promise<SettingsPageResponse> {
  if (!isMockMode) return apiRequest<SettingsPageResponse>('/api/v1/settings', { method: 'PUT', body: JSON.stringify(settings) })
  if (getMockScenario() === 'error') throw new Error('Не удалось сохранить настройки уведомлений')
  return structuredClone(saveSettingsMock(getMockScenario(), settings))
}

export async function loadTelegramConnection(): Promise<TelegramConnection> {
  if (!isMockMode) return apiRequest<TelegramConnection>('/api/v1/settings/telegram')
  if (getMockScenario() === 'error') throw new Error('Не удалось загрузить подключение Telegram')
  return structuredClone(getTelegramMock(getMockScenario()))
}

export async function connectTelegram(token: string): Promise<TelegramConnection> {
  if (!isMockMode) return apiRequest<TelegramConnection>('/api/v1/settings/telegram/connect', {
    method: 'POST', body: JSON.stringify({ token }),
  })
  return structuredClone(connectTelegramMock(getMockScenario()))
}

export async function testTelegramConnection(): Promise<TelegramConnection> {
  if (!isMockMode) return apiRequest<TelegramConnection>('/api/v1/settings/telegram/test', { method: 'POST' })
  return structuredClone(testTelegramMock(getMockScenario()))
}

export async function disconnectTelegram(): Promise<TelegramConnection> {
  if (!isMockMode) return apiRequest<TelegramConnection>('/api/v1/settings/telegram', { method: 'DELETE' })
  return structuredClone(disconnectTelegramMock(getMockScenario()))
}
