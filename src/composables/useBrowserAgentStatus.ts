import { onMounted, onUnmounted, readonly, ref } from 'vue'
import type { AgentStatus } from '../api/contracts/overview'
import { loadBrowserAgentStatus } from '../services/browser'

const POLLING_INTERVAL_MS = 5_000
const FAILURES_BEFORE_OFFLINE = 3
const status = ref<AgentStatus>('CONNECTING')
const browserOpen = ref(false)
const activeProfileId = ref<string | null>(null)

export const browserAgentStatus = readonly(status)
export const browserAgentOpen = readonly(browserOpen)
export const browserAgentActiveProfileId = readonly(activeProfileId)

export function useBrowserAgentStatus() {
  let timerId: number | null = null
  let active = false
  let loading = false
  let successfulResponseReceived = false
  let consecutiveFailures = 0

  async function refresh(): Promise<void> {
    if (!active || loading) {
      return
    }

    loading = true
    try {
      const response = await loadBrowserAgentStatus()
      if (active) {
        status.value = response.status
        browserOpen.value = response.browserOpen
        activeProfileId.value = response.activeProfileId
        successfulResponseReceived = true
        consecutiveFailures = 0
      }
    } catch {
      if (active) {
        consecutiveFailures += 1
        if (!successfulResponseReceived || consecutiveFailures >= FAILURES_BEFORE_OFFLINE) {
          status.value = 'OFFLINE'
          browserOpen.value = false
          activeProfileId.value = null
        }
      }
    } finally {
      loading = false
    }
  }

  onMounted(() => {
    active = true
    void refresh()
    timerId = window.setInterval(() => void refresh(), POLLING_INTERVAL_MS)
  })

  onUnmounted(() => {
    active = false
    if (timerId !== null) window.clearInterval(timerId)
  })

  return {
    status: browserAgentStatus,
    refresh,
  }
}
