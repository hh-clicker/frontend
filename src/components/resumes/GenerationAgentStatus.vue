<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { IconRefresh } from '@tabler/icons-vue'
import AppButton from '../ui/AppButton.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import { loadGenerationStatus, type GenerationState, type GenerationStatus } from '../../services/generationStatus'

const status = ref<GenerationStatus | null>(null)
const refreshing = ref(false)
const error = ref<string | null>(null)
const timedOut = ref(false)
const labels: Record<GenerationState, string> = { READY: 'Готов', AUTH_REQUIRED: 'Нужна авторизация', UNAVAILABLE: 'Недоступен',
  CHECK_FAILED: 'Проверка не удалась', AGENT_OFFLINE: 'Browser Agent отключён', UNKNOWN: 'Ещё не проверен', STALE: 'Данные устарели' }
const explanations: Record<GenerationState, string> = {
  READY: 'Сервис доступен, авторизация Codex проверена. Доступность выбранной модели проверится при генерации.',
  AUTH_REQUIRED: 'Выполните вход в Codex в контейнере generation-agent, затем обновите статус.',
  UNAVAILABLE: 'Проверьте запуск generation-agent и HH_CLICKER_GENERATION_URL у Browser Agent.',
  CHECK_FAILED: 'Сервис ответил, но готовность CLI или авторизацию подтвердить не удалось.',
  AGENT_OFFLINE: 'Запустите Browser Agent — он проверяет сервис с того же адреса, который использует для генерации.',
  UNKNOWN: 'Ожидаем проверку от Browser Agent. Если статус не меняется, обновите и перезапустите агент.',
  STALE: 'Свежего результата проверки нет. Нажмите «Обновить».',
}
const pending = computed(() => refreshing.value || (status.value?.refreshing === true && !timedOut.value))
const label = computed(() => error.value ? 'Статус неизвестен' : pending.value ? 'Проверяем…' : timedOut.value ? 'Проверка задерживается' : status.value ? labels[status.value.state] : 'Ещё не проверен')
const tone = computed(() => error.value || timedOut.value ? 'orange' : pending.value ? 'blue' : status.value?.state === 'READY' ? 'green' : status.value?.state === 'UNAVAILABLE' ? 'red' : 'orange')
const checkedTime = computed(() => {
  const checkedAt = status.value?.limits?.checkedAt ?? status.value?.checkedAt
  return checkedAt ? new Date(checkedAt).toLocaleString('ru-RU') : null
})
const limitWindows = computed(() => [status.value?.limits?.primary, status.value?.limits?.secondary].filter(v => v != null))
const windowLabel = (minutes: number) => minutes === 300 ? '5 часов' : minutes === 10080 ? 'Неделя' : `${minutes / 60} ч.`
let timer: ReturnType<typeof setTimeout> | undefined
let active: AbortController | null = null
let disposed = false
let automaticRefreshAt = 0

async function read(force = false): Promise<void> {
  if (disposed || active) return
  if (timer) clearTimeout(timer)
  const controller = new AbortController()
  active = controller
  const timeout = setTimeout(() => controller.abort(), 8000)
  refreshing.value = force
  if (force) { automaticRefreshAt = Date.now(); timedOut.value = false }
  try {
    status.value = await loadGenerationStatus(force, controller.signal)
    error.value = null
    timedOut.value = status.value.refreshing && Date.now() - automaticRefreshAt > 30000
  } catch {
    if (!disposed) { status.value = null; error.value = 'Не удалось получить статус через backend. Проверьте соединение и повторите.' }
  } finally {
    clearTimeout(timeout)
    active = null; refreshing.value = false
    if (!disposed) timer = setTimeout(() => void read(false), status.value?.refreshing ? 1500 : 5000)
  }
}
async function refresh(): Promise<void> { await read(true) }
onMounted(() => {
  automaticRefreshAt = Date.now()
  void read()
})
onUnmounted(() => { disposed = true; if (timer) clearTimeout(timer); active?.abort() })
</script>

<template>
  <div class="generation-agent-status">
    <div class="generation-agent-status__header">
      <div><strong>Generation Agent</strong><StatusBadge :label="label" :tone="tone" /></div>
      <AppButton size="small" :loading="refreshing" @click="refresh"><IconRefresh :size="16" /> Обновить</AppButton>
    </div>
    <p role="status" aria-live="polite">{{ error ?? (pending ? 'Проверяем доступность сервиса и авторизацию Codex через Browser Agent…' : timedOut ? 'Свежая проверка не получена. Убедитесь, что Browser Agent обновлён, и повторите.' : status ? explanations[status.state] : 'Ожидаем данные.') }}</p>
    <small v-if="!error && status?.model">{{ status.model }} · {{ status.reasoningEffort }}<template v-if="status.cliVersion"> · CLI {{ status.cliVersion }}</template></small>
    <small v-if="!error && status && (status.running || status.queued)">В работе: {{ status.running ?? '—' }} · в очереди: {{ status.queued ?? '—' }}</small>
    <small v-if="checkedTime">Последняя проверка: {{ checkedTime }}</small>
    <small v-if="!error && status?.state === 'READY' && !pending">
      <span v-for="(window, index) in limitWindows" :key="index" :title="`Сброс: ${new Date(window.resetsAt * 1000).toLocaleString('ru-RU')}`"><template v-if="index"> · </template>{{ windowLabel(window.windowDurationMins) }}: осталось {{ Math.round(100 - window.usedPercent) }}%</span>
    </small>
    <small v-if="(status && status.state !== 'READY') || error || timedOut">При неудачной генерации будет использовано резервное письмо.</small>
  </div>
</template>

<style scoped>
.generation-agent-status { padding: 14px; border: 1px solid var(--color-border-subtle); border-radius: 8px; margin-top: 14px; }
.generation-agent-status__header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.generation-agent-status__header > div { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.generation-agent-status strong { font-size: 14px; }
.generation-agent-status p { margin: 10px 0 6px; font-size: 13px; line-height: 1.5; }
.generation-agent-status small { display: block; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
</style>
