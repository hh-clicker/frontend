import { reactive } from 'vue'
import { applicationContextStore } from './applicationContext'
import { focusVacancyViaAgent, openUrlViaAgent } from './browser'

interface HhBrowserNavigationState {
  unavailableUrl: string | null
  message: string | null
}

export const hhBrowserNavigationState = reactive<HhBrowserNavigationState>({
  unavailableUrl: null,
  message: null,
})

export async function openHhUrl(url: string, focusExisting = false): Promise<void> {
  const accountId = applicationContextStore.state.overview?.selectedAccountId
  if (!accountId) {
    showBrowserReminder(url)
    return
  }

  if (applicationContextStore.state.overview?.activeRun && !focusExisting) {
    showBrowserReminder(url, 'Сейчас идёт запуск откликов. Чтобы не мешать его работе, ссылку можно скопировать.')
    return
  }

  try {
    if (focusExisting) {
      const target = new URL(url)
      const id = target.pathname.match(/^\/vacancy\/([0-9]{1,20})$/)?.[1]
      if (target.origin !== 'https://hh.ru' || !id) throw new Error('Некорректная ссылка вакансии.')
      await focusVacancyViaAgent(accountId, id)
    } else await openUrlViaAgent(accountId, url)
  } catch (cause) {
    showBrowserReminder(url, cause instanceof Error ? cause.message : 'Не удалось открыть ссылку в управляемом Chrome.')
  }
}

export function closeBrowserReminder(): void {
  hhBrowserNavigationState.unavailableUrl = null
  hhBrowserNavigationState.message = null
}

function showBrowserReminder(url: string, message = 'Выберите HH-аккаунт и запустите Browser Agent.'): void {
  hhBrowserNavigationState.unavailableUrl = url
  hhBrowserNavigationState.message = message
}
