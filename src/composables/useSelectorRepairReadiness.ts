import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadGenerationStatus, type GenerationStatus } from '../services/generationStatus'
import { selectorRepairReady } from '../services/selectorDiagnosticEntry'

/** GET reads the existing cached health result; it does not start a Codex login probe on every poll. */
export function useSelectorRepairReadiness() {
  const status = ref<GenerationStatus | null>(null)
  const loading = ref(false)
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | null = null
  let pending: Promise<boolean> | null = null
  function read(force = false): Promise<boolean> {
    if (pending) return pending
    pending = readOnce(force).finally(() => { pending = null })
    return pending
  }
  async function readOnce(force = false): Promise<boolean> {
    if (disposed) return false
    if (timer) clearTimeout(timer)
    loading.value = true
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), 8000)
    try { status.value = await loadGenerationStatus(force, controller.signal) }
    catch { status.value = null }
    finally {
      clearTimeout(timeout); controller = null; loading.value = false
      if (!disposed) timer = setTimeout(() => void read(), status.value?.refreshing ? 1500 : 10000)
    }
    return selectorRepairReady(status.value)
  }
  const ready = computed(() => selectorRepairReady(status.value))
  const label = computed(() => status.value?.refreshing || !status.value && loading.value ? 'Проверяем…'
    : ready.value ? 'Готов' : status.value?.state === 'AUTH_REQUIRED' ? 'Нужна авторизация'
      : status.value?.state === 'STALE' ? 'Статус устарел' : status.value?.state === 'UNKNOWN' ? 'Не проверен' : 'Недоступен')
  const explanation = computed(() => ready.value ? 'Generation Agent готов к ИИ-починке.'
    : status.value?.state === 'AUTH_REQUIRED' ? 'Для ИИ-починки войдите в Codex через лаунчер и обновите статус.'
      : status.value?.refreshing ? 'Проверяем готовность Generation Agent. Диагностика страницы доступна без ИИ.'
        : 'Для ИИ-починки подключите Generation Agent и проверьте вход в Codex. Диагностика страницы доступна без ИИ.')
  onMounted(() => void read())
  onUnmounted(() => { disposed = true; if (timer) clearTimeout(timer); controller?.abort() })
  return { ready, label, explanation, loading, read }
}
