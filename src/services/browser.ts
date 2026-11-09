import { ApiError, apiRequest } from '../api/client'
import { reactive } from 'vue'
import { applicationContextStore } from './applicationContext'
import type {
  BrowserAgentStatusResponse,
  BrowserAgentCommandResponse,
  BrowserCommandReceiptResponse,
  BrowserPageResponse,
  BrowserProfile,
  BrowserAuthorizationResult,
  DiagnosticMode,
  SelectorDiagnosticReport,
} from '../api/contracts/browser'
import { getMockScenario, isMockMode } from '../app/runtime'
import { createBrowserProfileMock, getBrowserPageMock, setBrowserRunningMock } from '../mocks/browser'
import { getResumesMock } from '../mocks/resumes'
import { createSelectorDiagnosticsMock } from '../mocks/selectorDiagnostics'
import type { ResumeProfile } from '../api/contracts/resumes'
import { BrowserPreparation } from './browserPreparation'

const COMMAND_POLLING_INTERVAL_MS = 500
const COMMAND_TIMEOUT_MS = 35_000
const AUTHORIZATION_COMMAND_TIMEOUT_MS = 75_000
// Backend allows 12 minutes for diagnostics/repair; leave a minute to receive its final result.
const SELECTOR_DIAGNOSTIC_COMMAND_TIMEOUT_MS = 13 * 60_000
const diagnoseSelectorsMock = createSelectorDiagnosticsMock()

export async function diagnoseSelectorsViaAgent(accountId: string, mode: DiagnosticMode, resumeId?: string | null, tabId?: string | null, repairGroup?: string | null): Promise<SelectorDiagnosticReport> {
  if (mode === 'FULL' || !tabId && !repairGroup) await ensureBrowserForAccount(accountId)
  if (isMockMode) {
    const page = getBrowserPageMock(getMockScenario())
    if (page.profile?.accountId !== accountId || page.profile.processStatus !== 'RUNNING' || page.agent.status !== 'READY')
      throw new Error('Откройте браузер выбранного аккаунта и дождитесь готовности агента.')
    await new Promise(resolve => setTimeout(resolve, repairGroup ? 1800 : 650))
    return diagnoseSelectorsMock(accountId, resumeId, getMockScenario(), mode, tabId, repairGroup)
  }
  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/selector-diagnostics', {
    method: 'POST', body: JSON.stringify({ accountId, mode, resumeId, tabId, repairGroup }),
  })
  const result = await waitForBrowserCommand(receipt.commandId, mode === 'FULL' || repairGroup ? SELECTOR_DIAGNOSTIC_COMMAND_TIMEOUT_MS : 105_000)
  if (!result.selectorDiagnostics) throw new Error('Агент не вернул диагностику. Обновите Browser Agent.')
  return result.selectorDiagnostics
}

export async function focusDiagnosticViaAgent(accountId: string, tabId: string): Promise<void> {
  if (isMockMode) return
  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/focus-diagnostic', {
    method: 'POST', body: JSON.stringify({ accountId, tabId }),
  })
  await waitForBrowserCommand(receipt.commandId, 10 * 60_000)
}

export const authorizationChecks = reactive<Record<string, { checking: boolean; result: BrowserAuthorizationResult | null }>>({})

async function withAuthorizationCheck(
  accountId: string,
  execute: () => Promise<BrowserAgentCommandResponse>,
): Promise<BrowserAgentCommandResponse> {
  if (authorizationChecks[accountId]?.checking) throw new Error('Проверка входа уже выполняется.')
  authorizationChecks[accountId] = { checking: true, result: null }
  applicationContextStore.setAuthorizationStatus(accountId, 'UNKNOWN')
  try {
    const command = await execute()
    const result: BrowserAuthorizationResult = command.authorization ?? { status: 'UNKNOWN', message: 'Агент не вернул результат проверки входа.' }
    authorizationChecks[accountId] = { checking: false, result }
    applicationContextStore.setAuthorizationStatus(accountId, result.status)
    return command
  } catch (cause) {
    authorizationChecks[accountId]!.result = { status: 'UNKNOWN', message: 'Проверка входа не завершена. Повторите её после восстановления связи с агентом.' }
    throw cause
  } finally {
    authorizationChecks[accountId]!.checking = false
  }
}

export async function openBrowserViaAgent(accountId: string): Promise<BrowserAgentCommandResponse> {
  return withAuthorizationCheck(accountId, () => openBrowserCommand(accountId))
}

async function openBrowserCommand(accountId: string): Promise<BrowserAgentCommandResponse> {
  if (isMockMode) {
    setBrowserRunningMock(getMockScenario(), true)
    const now = new Date().toISOString()
    return {
      id: `mock-open-browser-${Date.now()}`,
      type: 'OPEN_BROWSER',
      status: 'SUCCEEDED',
      agentId: 'mock-browser-agent',
      createdAt: now,
      startedAt: now,
      completedAt: now,
      errorMessage: null,
      authorization: { status: getBrowserPageMock(getMockScenario()).agent.authorizationStatus, message: 'Мок проверки авторизации.' },
    }
  }

  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/start', {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  })
  return waitForBrowserCommand(receipt.commandId, AUTHORIZATION_COMMAND_TIMEOUT_MS)
}

export async function checkAuthorizationViaAgent(accountId: string): Promise<BrowserAgentCommandResponse> {
  return withAuthorizationCheck(accountId, async () => {
    if (isMockMode) {
      const page = getBrowserPageMock(getMockScenario())
      if (page.agent.status === 'OFFLINE' || page.profile?.processStatus !== 'RUNNING') throw new Error('Сначала запустите браузер')
      const now = new Date().toISOString()
      return {
        id: `mock-check-authorization-${Date.now()}`, type: 'CHECK_AUTHORIZATION', status: 'SUCCEEDED',
        agentId: 'mock-browser-agent', createdAt: now, startedAt: now, completedAt: now, errorMessage: null,
        authorization: { status: page.agent.authorizationStatus, message: 'Мок проверки авторизации.' },
      }
    }
    const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/check-authorization', {
      method: 'POST', body: JSON.stringify({ accountId }),
    })
    return waitForBrowserCommand(receipt.commandId, AUTHORIZATION_COMMAND_TIMEOUT_MS)
  })
}

export async function closeBrowserViaAgent(): Promise<BrowserAgentCommandResponse> {
  if (isMockMode) {
    setBrowserRunningMock(getMockScenario(), false)
    const now = new Date().toISOString()
    return { id: `mock-close-browser-${Date.now()}`, type: 'CLOSE_BROWSER', status: 'SUCCEEDED', agentId: 'mock-browser-agent', createdAt: now, startedAt: now, completedAt: now, errorMessage: null }
  }

  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/stop', { method: 'POST' })
  return waitForBrowserCommand(receipt.commandId)
}

export async function discoverResumesViaAgent(accountId: string): Promise<BrowserAgentCommandResponse> {
  return withAuthorizationCheck(accountId, async () => {
    if (isMockMode) {
      const page = getBrowserPageMock(getMockScenario())
      if (page.agent.status === 'OFFLINE' || page.profile?.accountId !== accountId || page.profile.processStatus !== 'RUNNING') {
        throw new Error('Сначала запустите браузер выбранного аккаунта')
      }
      const now = new Date().toISOString()
      return {
        id: `mock-discover-resumes-${Date.now()}`, type: 'DISCOVER_RESUMES', status: 'SUCCEEDED',
        agentId: 'mock-browser-agent', createdAt: now, startedAt: now, completedAt: now, errorMessage: null,
        authorization: { status: page.agent.authorizationStatus, message: 'Мок проверки авторизации.' },
        resumes: page.agent.authorizationStatus === 'AUTHORIZED' ? [
          { hhResumeId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'Java-разработчик' },
          { hhResumeId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'Backend-разработчик' },
        ] : null,
      }
    }
    const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/discover-resumes', {
      method: 'POST', body: JSON.stringify({ accountId }),
    })
    return waitForBrowserCommand(receipt.commandId, AUTHORIZATION_COMMAND_TIMEOUT_MS)
  })
}

export async function readResumeTextViaAgent(accountId: string, hhResumeId: string): Promise<string> {
  if (isMockMode) return 'Разработчик\n\nОпыт работы\nРазработка и поддержка веб-приложений.\n\nНавыки\nJava, SQL, Git'
  const command = await withAuthorizationCheck(accountId, async () => {
    const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/resume-text', {
      method: 'POST', body: JSON.stringify({ accountId, hhResumeId }),
    })
    return waitForBrowserCommand(receipt.commandId, 105_000)
  })
  const result = command.resumes?.find(resume => resume.hhResumeId === hhResumeId)
  if (command.authorization?.status !== 'AUTHORIZED' || !result?.plainText?.trim()) {
    throw new Error(command.authorization?.status !== 'AUTHORIZED'
      ? 'Вход в HH не подтверждён. Войдите в аккаунт и повторите загрузку текста.'
      : 'Агент не вернул текст выбранного резюме. Обновите Browser Agent и повторите загрузку текста.')
  }
  return result.plainText
}

export async function ensureBrowserProfile(accountId: string): Promise<BrowserProfile> {
  const page = await loadBrowserPage(accountId)
  if (page.profile) return page.profile
  try {
    return await createBrowserProfile(accountId)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) {
      const refreshed = await loadBrowserPage(accountId)
      if (refreshed.profile) return refreshed.profile
    }
    throw cause
  }
}

const browserPreparation = new BrowserPreparation()

/** Preparation belongs to the requested action's account, not the current UI selection. */
export async function ensureBrowserForAccount(accountId: string): Promise<void> {
  await browserPreparation.ensure(accountId, {
    status: loadBrowserAgentStatus, profile: ensureBrowserProfile, open: openBrowserViaAgent,
    waitReady: async profileId => {
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        const current = await loadBrowserAgentStatus()
        if (current.status === 'READY' && current.browserOpen && current.activeProfileId === profileId) return
        if (current.status === 'OFFLINE') break
        await delay(500)
      }
      throw new Error('Браузер открыт, но агент ещё не подтвердил готовность. Повторите действие после завершения запуска.')
    },
  })
}

export async function ensureBrowserForResume(resumeId: string): Promise<void> {
  const resume = isMockMode ? getResumesMock(getMockScenario()).items.find(item => item.id === resumeId)
    : await apiRequest<ResumeProfile>(`/api/v1/resumes/${encodeURIComponent(resumeId)}`)
  if (!resume) throw new Error('Резюме не найдено.')
  await ensureBrowserForAccount(resume.accountId)
}

export async function focusVacancyViaAgent(accountId: string, hhVacancyId: string): Promise<BrowserAgentCommandResponse> {
  if (isMockMode) {
    const page = getBrowserPageMock(getMockScenario())
    if (page.profile?.accountId !== accountId || page.profile.processStatus !== 'RUNNING') throw new Error('Вкладка вакансии недоступна: браузер закрыт.')
    const now = new Date().toISOString()
    return { id: `mock-focus-${Date.now()}`, type: 'FOCUS_VACANCY', status: 'SUCCEEDED', agentId: 'mock-browser-agent',
      createdAt: now, startedAt: now, completedAt: now, errorMessage: null }
  }
  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/focus-vacancy', {
    method: 'POST', body: JSON.stringify({ accountId, hhVacancyId }),
  })
  return waitForBrowserCommand(receipt.commandId, 10 * 60_000)
}

export async function openUrlViaAgent(accountId: string, url: string): Promise<BrowserAgentCommandResponse> {
  if (isMockMode) {
    const page = getBrowserPageMock(getMockScenario())
    if (page.agent.status !== 'READY') throw new Error('Browser Agent занят или недоступен.')
    await ensureBrowserProfile(accountId)
    setBrowserRunningMock(getMockScenario(), true)
    const now = new Date().toISOString()
    return { id: `mock-open-url-${Date.now()}`, type: 'OPEN_URL', status: 'SUCCEEDED', agentId: 'mock-browser-agent', createdAt: now, startedAt: now, completedAt: now, errorMessage: null }
  }

  await ensureBrowserProfile(accountId)
  const receipt = await apiRequest<BrowserCommandReceiptResponse>('/api/v1/browser/open-url', {
    method: 'POST',
    body: JSON.stringify({ accountId, url }),
  })
  return waitForBrowserCommand(receipt.commandId, 120_000)
}

export async function waitForBrowserCommand(commandId: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<BrowserAgentCommandResponse> {
  let command = await apiRequest<BrowserAgentCommandResponse>(
    `/api/v1/browser-agent/commands/${encodeURIComponent(commandId)}`,
  )
  const deadline = Date.now() + timeoutMs

  while (command.status === 'QUEUED' || command.status === 'IN_PROGRESS') {
    if (Date.now() >= deadline) {
      throw new Error('Browser Agent не успел выполнить команду.')
    }

    await delay(COMMAND_POLLING_INTERVAL_MS)
    command = await apiRequest<BrowserAgentCommandResponse>(
      `/api/v1/browser-agent/commands/${encodeURIComponent(command.id)}`,
    )
  }

  if (command.status === 'FAILED') {
    throw new Error(command.errorMessage || 'Browser Agent не смог выполнить команду.')
  }

  return command
}

export async function loadBrowserAgentStatus(): Promise<BrowserAgentStatusResponse> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось получить состояние Browser Agent')

    const agent = getBrowserPageMock(getMockScenario()).agent
    return {
      agentId: 'mock-browser-agent',
      version: agent.version,
      status: agent.status,
      lastHeartbeatAt: agent.status === 'OFFLINE' ? null : new Date().toISOString(),
      offlineAfterSeconds: 15,
      browserOpen: agent.status !== 'OFFLINE' && getBrowserPageMock(getMockScenario()).profile?.processStatus === 'RUNNING',
      activeProfileId: getBrowserPageMock(getMockScenario()).profile?.processStatus === 'RUNNING'
        ? getBrowserPageMock(getMockScenario()).profile?.id ?? null
        : null,
    }
  }

  return apiRequest<BrowserAgentStatusResponse>('/api/v1/browser-agent/status')
}

export async function loadBrowserPage(accountId?: string | null): Promise<BrowserPageResponse> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось получить состояние Browser Agent')
    return structuredClone(getBrowserPageMock(getMockScenario()))
  }
  if (!accountId) throw new Error('Сначала выберите HH-аккаунт')
  return apiRequest<BrowserPageResponse>(`/api/v1/browser?accountId=${encodeURIComponent(accountId)}`)
}

export async function createBrowserProfile(accountId: string): Promise<BrowserProfile> {
  if (isMockMode) return structuredClone(createBrowserProfileMock(getMockScenario(), accountId))
  return apiRequest<BrowserProfile>('/api/v1/browser/profile', { method: 'POST', body: JSON.stringify({ accountId }) })
}

export async function startBrowser(accountId: string): Promise<BrowserProfile> {
  await openBrowserViaAgent(accountId)
  const page = await loadBrowserPage(accountId)
  if (!page.profile) throw new Error('Профиль браузера не найден')
  return page.profile
}

export async function stopBrowser(accountId: string): Promise<BrowserProfile> {
  if (isMockMode) return structuredClone(setBrowserRunningMock(getMockScenario(), false))
  await closeBrowserViaAgent()
  const page = await loadBrowserPage(accountId)
  if (!page.profile) throw new Error('Профиль браузера не найден')
  return page.profile
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
