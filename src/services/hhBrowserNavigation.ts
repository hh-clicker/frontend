import { reactive } from 'vue'
import { applicationContextStore } from './applicationContext'
import { loadBrowserAgentStatus, openUrlViaAgent } from './browser'

interface HhBrowserNavigationState {
  unavailableUrl: string | null
}

export const hhBrowserNavigationState = reactive<HhBrowserNavigationState>({
  unavailableUrl: null,
})

export async function openHhUrl(url: string): Promise<void> {
  const accountId = applicationContextStore.state.overview?.selectedAccountId
  if (!accountId) {
    showBrowserReminder(url)
    return
  }

  try {
    const agent = await loadBrowserAgentStatus()
    if (!agent.browserOpen) {
      showBrowserReminder(url)
      return
    }
    await openUrlViaAgent(accountId, url)
  } catch {
    showBrowserReminder(url)
  }
}

export function closeBrowserReminder(): void {
  hhBrowserNavigationState.unavailableUrl = null
}

function showBrowserReminder(url: string): void {
  hhBrowserNavigationState.unavailableUrl = url
}
