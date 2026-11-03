import { ref } from 'vue'
import type { NotificationSettings } from '../api/contracts/settings'

export const notificationPermission = ref<NotificationPermission | 'unsupported'>('default')
export const soundReady = ref(false)
export const notificationIssue = ref<string | null>(null)
let audio: AudioContext | null = null

export function refreshNotificationPermission(): void {
  notificationPermission.value = window.isSecureContext && 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<void> {
  refreshNotificationPermission()
  if (notificationPermission.value !== 'default') return
  try { await Notification.requestPermission() }
  catch { notificationIssue.value = 'Браузер не разрешил запрос уведомлений. Проверьте настройки сайта.' }
  refreshNotificationPermission()
}

// Called from a user gesture; resuming audio outside a gesture may wait indefinitely.
export async function prepareNotificationSound(): Promise<boolean> {
  if (!('AudioContext' in window)) return false
  try {
    audio ??= new AudioContext()
    audio.onstatechange = () => { soundReady.value = audio?.state === 'running' }
    if (audio.state !== 'running') await Promise.race([
      audio.resume().catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 500)),
    ])
    soundReady.value = audio?.state === 'running'
  } catch { soundReady.value = false }
  return soundReady.value
}

function playSound(): boolean {
  if (!audio || audio.state !== 'running') return false
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  const now = audio.currentTime
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(740, now)
  oscillator.frequency.setValueAtTime(880, now + .13)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(.1, now + .02)
  gain.gain.exponentialRampToValueAtTime(.001, now + .35)
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  oscillator.start(now)
  oscillator.stop(now + .36)
  return true
}

export function deliverNotification(title: string, body: string, settings: NotificationSettings, tag: string, onClick?: () => void): void {
  const issues: string[] = []
  refreshNotificationPermission()
  if (settings.desktopEnabled) {
    if (notificationPermission.value === 'granted') {
      try {
        const notification = new Notification(`HH Clicker · ${title}`, { body, tag, silent: true })
        notification.onclick = () => { window.focus(); notification.close(); onClick?.() }
        notification.onerror = () => { notificationIssue.value = 'Не удалось показать системное уведомление. Проверьте разрешения браузера и ОС.' }
      } catch { issues.push('Не удалось показать системное уведомление в этом браузере.') }
    } else issues.push('Системные уведомления не разрешены в этом браузере.')
  }
  if (settings.soundEnabled) {
    try { if (!playSound()) issues.push('Звук заблокирован браузером. Нажмите «Проверить уведомление» ещё раз для проверки звука.') }
    catch { issues.push('Не удалось воспроизвести звуковой сигнал.') }
  }
  notificationIssue.value = issues.join(' ') || null
}

export function disposeNotificationSound(): void {
  if (audio) void audio.close().catch(() => {})
  audio = null
  soundReady.value = false
}
