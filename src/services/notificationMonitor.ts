import { apiRequest } from '../api/client'
import { isMockMode } from '../app/runtime'
import { collectNotificationEvents, rememberRuns, type NotificationState, type SeenRuns } from './notificationEvents'
import { deliverNotification, disposeNotificationSound, notificationIssue, prepareNotificationSound, refreshNotificationPermission } from './browserNotifications'

const storageKey = 'hh-clicker.notifications.seen.v2'
const lockName = 'hh-clicker.notifications.poll.v1'

function readSeen(): SeenRuns | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    for (const entry of Object.values(value)) {
      if (!entry || typeof entry.status !== 'string' || typeof entry.revision !== 'string'
        || !Array.isArray(entry.attentionIds) || !entry.attentionIds.every((id: unknown) => typeof id === 'string')) return null
    }
    return value as SeenRuns
  } catch { return null }
}

export function startNotificationMonitor(): () => void {
  refreshNotificationPermission()
  if (isMockMode) return () => {}
  let stopped = false
  let pending = false
  let soundEnabled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let request: AbortController | null = null

  async function poll(): Promise<void> {
    const previous = readSeen()
    request = new AbortController()
    const timeout = setTimeout(() => request?.abort(), 12000)
    let state: NotificationState
    try { state = await apiRequest<NotificationState>('/api/v1/settings/notification-state', { signal: request.signal, cache: 'no-store' }) }
    finally { clearTimeout(timeout); request = null }
    if (stopped) return
    soundEnabled = state.settings.soundEnabled
    const events = collectNotificationEvents(previous, state)
    // Claim before delivery: a notification failure must never create an alert loop.
    // This also remembers events disabled by preferences, so enabling them does not replay history.
    localStorage.setItem(storageKey, JSON.stringify(rememberRuns(state)))
    const event = events.at(-1)
    if (event) {
      // After a long network outage, summarize the batch rather than producing a burst of sounds.
      const title = events.length === 1 ? event.title : `Обновления запусков: ${events.length}`
      const body = events.length === 1 ? event.body : events.slice(-3).map(item => `${item.title}: ${item.body}`).join('\n')
      deliverNotification(title, body, state.settings, event.key, () => {
        // A notification can belong to a different account/resume than the currently selected one.
        localStorage.setItem('hh-clicker.account-id', event.accountId)
        localStorage.setItem('hh-clicker.resume-id', event.resumeId)
        window.location.assign(event.url)
      })
    }
  }

  async function tick(): Promise<void> {
    if (stopped || pending) return
    clearTimeout(timer)
    pending = true
    try {
      if (navigator.locks) {
        await navigator.locks.request(lockName, { ifAvailable: true }, async lock => { if (lock && !stopped) await poll() })
      } else if (document.hasFocus()) {
        // Older/insecure browsers: only the focused window polls; no competing background delivery.
        await poll()
      }
    } catch (cause) {
      // Transient backend errors are retried without overwriting the last successful baseline.
      if (cause instanceof DOMException && ['SecurityError', 'QuotaExceededError'].includes(cause.name)) {
        notificationIssue.value = 'Разрешите локальное хранилище сайта для уведомлений без повторов.'
      }
    } finally {
      pending = false
      if (!stopped) timer = setTimeout(() => void tick(), 5000)
    }
  }

  function gesture(): void { if (soundEnabled) void prepareNotificationSound() }
  function focus(): void { refreshNotificationPermission(); void tick() }
  document.addEventListener('pointerdown', gesture)
  document.addEventListener('keydown', gesture)
  window.addEventListener('focus', focus)
  void tick()
  return () => {
    stopped = true
    clearTimeout(timer)
    request?.abort()
    document.removeEventListener('pointerdown', gesture)
    document.removeEventListener('keydown', gesture)
    window.removeEventListener('focus', focus)
    disposeNotificationSound()
  }
}
