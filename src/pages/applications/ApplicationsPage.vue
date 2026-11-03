<script setup lang="ts">
import PreparedLetterDetails from '../../components/applications/PreparedLetterDetails.vue'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { IconAlertTriangle, IconCheck, IconFileCv, IconPlayerPause, IconPlayerPlay, IconSearch, IconTrash, IconX } from '@tabler/icons-vue'
import type { ApplicationItem, ApplicationRun, ApplicationRunStatus, ApplicationStatus } from '../../api/contracts/applications'
import type { AttentionTask, AttentionTaskKind } from '../../api/contracts/attention'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { usePageData } from '../../composables/usePageData'
import { loadAttentionTasks, setAttentionTaskStatus } from '../../services/attention'
import { loadApplicationRun, loadApplicationRuns, setApplicationRunStatus } from '../../services/applications'
import { applicationContextStore } from '../../services/applicationContext'
import { formatApproximateDuration, formatDateTime } from '../../utils/dateTime'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'

type ApplicationFilter = 'ALL' | 'QUEUED' | 'SUCCEEDED' | 'ATTENTION_REQUIRED' | 'FAILED'

const route = useRoute()
const selectedRunId = ref<string | null>(null)
const activeFilter = ref<ApplicationFilter>('ALL')
const query = ref('')
const actionError = ref<string | null>(null)
const busy = ref(false)
const busyAttentionTaskId = ref<string | null>(null)
const attentionTasks = ref<AttentionTask[]>([])
const runCache = ref<Record<string, { run: ApplicationRun; revision: string }>>({})
const detailErrors = ref<Record<string, string>>({})
const pendingDetails = ref(new Set<string>())
const detailVersions = new Map<string, number>()
let contextVersion = 0
const { data: runs, loading, error, refresh } = usePageData(() => loadApplicationRuns(applicationContextStore.state.overview?.selectedResumeId))
watch(() => applicationContextStore.state.overview?.selectedResumeId, () => {
  contextVersion++
  selectedRunId.value = null
  runs.value = null
  runCache.value = {}
  detailErrors.value = {}
  pendingDetails.value = new Set()
  detailVersions.clear()
  attentionTasks.value = []
  actionError.value = null
  void refreshRuns()
})
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void refreshAttentionTasks()
  poll = setInterval(() => { if (!loading.value && !busy.value && !busyAttentionTaskId.value) void refreshRuns() }, 3000)
})
onUnmounted(() => { clearInterval(poll); contextVersion++ })
watch(() => (runs.value ?? []).map(run => `${run.id}:${run.revision}`).join('|'),
  () => { if (runs.value) void applicationContextStore.load(true) })

const filters: Array<{ value: ApplicationFilter; label: string }> = [
  { value: 'ALL', label: 'Все' }, { value: 'QUEUED', label: 'В очереди' }, { value: 'SUCCEEDED', label: 'Успешные' },
  { value: 'ATTENTION_REQUIRED', label: 'Требуют внимания' }, { value: 'FAILED', label: 'Ошибки' },
]
const selectedSummary = computed(() => runs.value?.find(run => run.id === selectedRunId.value) ?? null)
const selectedRun = computed(() => selectedRunId.value ? runCache.value[selectedRunId.value]?.run ?? null : null)
const dryRun = computed(() => selectedRun.value?.mode === 'DRY_RUN')
const detailError = computed(() => selectedRunId.value ? detailErrors.value[selectedRunId.value] ?? null : null)
const detailLoading = computed(() => selectedRunId.value ? pendingDetails.value.has(selectedRunId.value) : false)
const runCounts = computed(() => countApplications(selectedRun.value?.applications ?? []))
const processedCount = computed(() => runCounts.value.total - runCounts.value.queued - runCounts.value.inProgress)
const progress = computed(() => runCounts.value.total ? Math.round(processedCount.value / runCounts.value.total * 100) : 0)
const estimatedRemainingLabel = computed(() => {
  const seconds = selectedSummary.value?.estimatedRemainingSeconds
  const status = selectedRun.value?.status
  if (seconds == null || !status || (!status.startsWith('PAUSED_') && status !== 'RUNNING')) return null
  const duration = formatApproximateDuration(seconds)
  return status === 'RUNNING' ? `Примерно осталось: ${duration}` : `После продолжения: примерно ${duration}`
})
const selectedRunAttentionTasks = computed(() => attentionTasks.value.filter((task) => task.status === 'OPEN' && task.runId === selectedRunId.value))
const filteredApplications = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return (selectedRun.value?.applications ?? []).filter((item) => {
    const filterMatches = activeFilter.value === 'ALL'
      || (activeFilter.value === 'ATTENTION_REQUIRED' ? needsAttention(item)
        : activeFilter.value === 'QUEUED' ? ['QUEUED', 'IN_PROGRESS'].includes(item.status) : item.status === activeFilter.value)
    return filterMatches && (!needle || item.vacancyTitle.toLocaleLowerCase('ru').includes(needle) || item.companyName.toLocaleLowerCase('ru').includes(needle))
  })
})

const runPresentation: Record<ApplicationRunStatus, { label: string; tone: 'green' | 'blue' | 'orange' | 'purple' | 'neutral' }> = {
  RUNNING: { label: 'Работает', tone: 'green' }, PAUSED_USER: { label: 'Пауза', tone: 'blue' },
  PAUSED_CAPTCHA: { label: 'Капча', tone: 'orange' }, PAUSED_AUTH: { label: 'Авторизация', tone: 'purple' },
  PAUSED_ERROR: { label: 'Нужна проверка', tone: 'orange' },
  PAUSED_LIMIT: { label: 'Дневной лимит', tone: 'blue' },
  PAUSED_AI_LIMIT: { label: 'Лимит Codex', tone: 'orange' },
  COMPLETED: { label: 'Завершён', tone: 'green' }, CANCELLED: { label: 'Отменён', tone: 'neutral' },
}
const applicationPresentation: Record<ApplicationStatus, { label: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'neutral' }> = {
  QUEUED: { label: 'В очереди', tone: 'neutral' }, IN_PROGRESS: { label: 'В процессе', tone: 'blue' },
  SUCCEEDED: { label: 'Успешно', tone: 'green' }, ATTENTION_REQUIRED: { label: 'Требует внимания', tone: 'orange' },
  FAILED: { label: 'Ошибка', tone: 'red' }, SKIPPED: { label: 'Пропущена', tone: 'neutral' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
}
const attentionKindPresentation: Record<AttentionTaskKind, { label: string; tone: 'orange' | 'purple' | 'blue' | 'red' }> = {
  QUESTIONNAIRE: { label: 'Анкета', tone: 'orange' }, CAPTCHA: { label: 'Капча', tone: 'purple' },
  AUTH: { label: 'Авторизация', tone: 'blue' }, ERROR: { label: 'Ошибка', tone: 'red' },
}

function needsAttention(item: ApplicationItem): boolean {
  return !!attentionTaskFor(item) || (item.status === 'ATTENTION_REQUIRED' && (!item.attentionStatus || item.attentionStatus === 'OPEN'))
}
function isReviewed(item: ApplicationItem): boolean {
  return item.status === 'ATTENTION_REQUIRED' && !needsAttention(item)
}
function itemPresentation(item: ApplicationItem) {
  if (item.outcome === 'VACANCY_ARCHIVED') return { label: 'В архиве', tone: 'neutral' as const }
  if (dryRun.value && item.outcome === 'TEXT_LOADED') return { label: 'Текст загружен', tone: 'green' as const }
  if (dryRun.value && item.outcome === 'TEXT_UNAVAILABLE') return { label: 'Текст не получен', tone: 'red' as const }
  if (isReviewed(item)) return { label: item.attentionStatus === 'SKIPPED' ? 'Пропущена' : 'Проверена', tone: 'neutral' as const }
  const task = attentionTaskFor(item)
  if (task) return attentionKindPresentation[task.kind]
  return applicationPresentation[item.status]
}

function attentionTaskFor(item: ApplicationItem): AttentionTask | undefined {
  return selectedRunAttentionTasks.value.find((task) => task.applicationId === item.id)
}

function employerIdFor(item: ApplicationItem): string | null {
  return attentionTaskFor(item)?.employerId ?? null
}

async function changeItemAttentionStatus(item: ApplicationItem, status: 'RESOLVED' | 'SKIPPED'): Promise<void> {
  const task = attentionTaskFor(item)
  if (task) await changeAttentionStatus(task, status)
}

watch(runs, (value) => {
  if (!value?.length) { selectedRunId.value = null; return }
  if (value.some(run => run.id === selectedRunId.value)) return
  const requestedId = typeof route.query.runId === 'string' ? route.query.runId : null
  selectedRunId.value = value.find((run) => run.id === requestedId)?.id ?? value.find((run) => run.status === 'RUNNING')?.id ?? value[0]!.id
}, { immediate: true })
watch(selectedRunId, () => { activeFilter.value = 'ALL'; query.value = '' })
watch(() => [selectedRunId.value, selectedSummary.value?.revision], () => { void ensureSelectedDetails() })
watch(() => route.query.runId, (id) => {
  if (typeof id === 'string' && runs.value?.some(run => run.id === id)) selectedRunId.value = id
})

async function ensureSelectedDetails(force = false): Promise<void> {
  const summary = selectedSummary.value
  if (!summary || pendingDetails.value.has(summary.id)) return
  if (!force && runCache.value[summary.id]?.revision === summary.revision) return
  const id = summary.id
  const context = contextVersion
  const version = (detailVersions.get(id) ?? 0) + 1
  detailVersions.set(id, version)
  pendingDetails.value.add(id)
  delete detailErrors.value[id]
  try {
    const run = await loadApplicationRun(id)
    if (context === contextVersion && version === detailVersions.get(id)) {
      runCache.value[id] = { run, revision: summary.revision }
    }
  } catch (cause) {
    if (context === contextVersion && version === detailVersions.get(id)) {
      detailErrors.value[id] = cause instanceof Error ? cause.message : 'Не удалось загрузить запуск'
    }
  } finally {
    if (context === contextVersion) pendingDetails.value.delete(id)
  }
}

async function refreshRuns(): Promise<void> {
  const context = contextVersion
  await Promise.all([refresh(), refreshAttentionTasks()])
  if (context === contextVersion) await ensureSelectedDetails()
}

async function refreshAttentionTasks(): Promise<void> {
  try {
    attentionTasks.value = await loadAttentionTasks()
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить ситуации, требующие внимания'
  }
}

function countApplications(items: ApplicationItem[]) {
  return {
    total: items.length,
    queued: items.filter((item) => item.status === 'QUEUED').length,
    inProgress: items.filter((item) => item.status === 'IN_PROGRESS').length,
    succeeded: items.filter((item) => item.status === 'SUCCEEDED').length,
    attention: items.filter(needsAttention).length,
    failed: items.filter((item) => item.status === 'FAILED').length,
  }
}

function filterLabel(filter: ApplicationFilter): string {
  const counts: Record<ApplicationFilter, number> = {
    ALL: runCounts.value.total, QUEUED: runCounts.value.queued + runCounts.value.inProgress,
    SUCCEEDED: runCounts.value.succeeded, ATTENTION_REQUIRED: runCounts.value.attention, FAILED: runCounts.value.failed,
  }
  const label = dryRun.value && filter === 'SUCCEEDED' ? 'Текст загружен' : filters.find((item) => item.value === filter)?.label
  return `${label} · ${counts[filter]}`
}

async function changeAttentionStatus(task: AttentionTask, status: 'RESOLVED' | 'SKIPPED'): Promise<void> {
  busyAttentionTaskId.value = task.id
  actionError.value = null
  try {
    const updated = await setAttentionTaskStatus(task.id, status)
    attentionTasks.value = attentionTasks.value.map((item) => item.id === updated.id ? updated : item)
    const application = selectedRun.value?.applications.find((item) => item.id === task.applicationId)
    if (application) application.attentionStatus = status
    void applicationContextStore.load(true)
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Не удалось закрыть ситуацию'
  } finally {
    busyAttentionTaskId.value = null
  }
}

async function changeRunStatus(status: ApplicationRunStatus, confirmFallback = false): Promise<void> {
  if (!selectedRun.value) return
  busy.value = true
  actionError.value = null
  const context = contextVersion
  const runId = selectedRun.value.id
  // A detail request started before this action must not restore the old status.
  detailVersions.set(runId, (detailVersions.get(runId) ?? 0) + 1)
  try {
    const updated = await setApplicationRunStatus(runId, status, confirmFallback)
    if (context !== contextVersion) return
    detailVersions.set(runId, (detailVersions.get(runId) ?? 0) + 1)
    replaceRun(updated)
    void applicationContextStore.load(true)
    await refreshRuns()
  } catch (cause) {
    if (context === contextVersion) actionError.value = cause instanceof Error ? cause.message : 'Не удалось изменить состояние запуска'
  } finally {
    busy.value = false
  }
}

function replaceRun(updated: ApplicationRun): void {
  runCache.value[updated.id] = { run: updated, revision: '' }
}
</script>

<template>
  <PageSkeleton v-if="loading && !runs" />
  <section v-else-if="error && !runs" class="page-error"><IconFileCv :size="36" /><h1>Не удалось загрузить отклики</h1><p>{{ error }}</p><AppButton variant="primary" @click="refresh">Повторить</AppButton></section>
  <div v-else class="applications-page">
    <header class="page-header"><div><h1>Отклики</h1><p>Запуски Browser Agent: отправка откликов и загрузка текстов вакансий.</p></div><RouterLink class="app-button app-button--primary app-button--medium" to="/vacancies">Выбрать вакансии</RouterLink></header>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null"><strong>Операция не выполнена.</strong> {{ actionError }}</AppAlert>
    <AppAlert v-if="error && runs" tone="warning">Не удалось обновить результаты. Не запускайте отклик повторно: дождитесь связи или проверьте HH.</AppAlert>
    <AppAlert v-if="selectedRun && !dryRun && !['COMPLETED', 'CANCELLED'].includes(selectedRun.status)" tone="info">Пауза и отмена не отменяют уже отправленный запрос. «Продолжить» обработает оставшуюся очередь этого запуска. Неподтверждённые вакансии «К отклику» можно включить в новый запуск после завершения или отмены текущего — сначала проверим их статус на HH.</AppAlert>

    <div v-if="runs?.length" class="applications-layout">
      <aside class="run-history-card">
        <header><h2>Запуски</h2><span>{{ runs.length }}</span></header>
        <button v-for="run in runs" :key="run.id" class="run-history-item" :class="{ 'run-history-item--active': run.id === selectedRunId }" type="button" @click="selectedRunId = run.id">
          <span class="run-history-item__top"><strong>{{ run.mode === 'DRY_RUN' ? 'Холостой запуск' : 'Запуск' }} #{{ run.sequence }}</strong><StatusBadge :label="runPresentation[run.status].label" :tone="runPresentation[run.status].tone" /></span>
          <span>{{ run.resumeName }}</span><small>{{ formatDateTime(run.createdAt) }} · {{ run.total }} вакансий</small>
          <small v-if="run.attention">Требуют внимания: {{ run.attention }}</small>
        </button>
      </aside>

      <main v-if="selectedRun" class="application-run-content">
        <AppAlert v-if="detailError" tone="warning">Не удалось обновить выбранный запуск. {{ detailError }} <AppButton size="small" :disabled="detailLoading" @click="ensureSelectedDetails(true)">Повторить</AppButton></AppAlert>
        <AppAlert v-if="selectedRun?.status === 'PAUSED_AI_LIMIT'" tone="warning">
          <strong>Лимит Codex исчерпан. Очередь на паузе, текущий отклик не отправлен.</strong>
          {{ selectedRun.aiLimitResetsAt ? `Сброс ожидается ${new Date(selectedRun.aiLimitResetsAt).toLocaleString('ru-RU')}.` : 'Время сброса получить не удалось.' }}
          Резервное письмо не используется без вашего разрешения. Разрешение действует только на оставшуюся очередь этого запуска.
        </AppAlert>
        <section class="active-run-card">
          <header class="active-run-card__header">
            <div><span class="active-run-card__eyebrow">{{ dryRun ? 'Холостой запуск' : 'Запуск' }} #{{ selectedRun.sequence }}</span><h2>{{ selectedRun.resumeName }}</h2><p>Создан {{ formatDateTime(selectedRun.createdAt) }} · пауза {{ selectedRun.pauseFromSeconds }}–{{ selectedRun.pauseToSeconds }} сек.{{ dryRun ? ' · без отправки откликов' : '' }}</p></div>
            <div class="active-run-card__actions">
              <StatusBadge :label="runPresentation[selectedRun.status].label" :tone="runPresentation[selectedRun.status].tone" />
              <StatusBadge v-if="runCounts.attention" :label="`Требуют внимания: ${runCounts.attention}`" tone="orange" />
              <AppButton v-if="selectedRun.status === 'RUNNING'" size="small" :disabled="busy" @click="changeRunStatus('PAUSED_USER')"><IconPlayerPause :size="16" /> Пауза</AppButton>
              <AppButton v-if="selectedRun.status.startsWith('PAUSED_') && runCounts.queued > 0" size="small" variant="primary" :disabled="busy || runCounts.inProgress > 0" @click="changeRunStatus('RUNNING')"><IconPlayerPlay :size="16" /> {{ selectedRun.status === 'PAUSED_AI_LIMIT' ? 'Повторить генерацию' : 'Продолжить оставшиеся' }}</AppButton>
              <AppButton v-if="selectedRun.status === 'PAUSED_AI_LIMIT'" size="small" :disabled="busy || runCounts.inProgress > 0 || !selectedRun.coverLetter.trim()" @click="changeRunStatus('RUNNING', true)">Продолжить с резервным письмом</AppButton>
              <small v-if="selectedRun.aiFallbackConfirmed">Резервное письмо разрешено для остатка этого запуска.</small>
              <AppButton v-if="!['COMPLETED', 'CANCELLED'].includes(selectedRun.status)" size="small" variant="danger" :disabled="busy" @click="changeRunStatus('CANCELLED')"><IconX :size="16" /> Отменить</AppButton>
            </div>
          </header>
          <div class="application-run-progress"><div><span>{{ dryRun ? 'Обработано' : 'Выполнено' }} {{ processedCount }} из {{ runCounts.total }}</span><strong>{{ progress }}%</strong></div><div class="application-run-progress__track"><span :style="{ width: `${progress}%` }" /></div><small v-if="estimatedRemainingLabel" class="application-run-progress__estimate">{{ estimatedRemainingLabel }}</small></div>
          <div class="run-kpis"><div><IconCheck :size="20" /><span>{{ dryRun ? 'Текст загружен' : 'Успешно' }}<strong>{{ runCounts.succeeded }}</strong></span></div><div><IconAlertTriangle :size="20" /><span>Внимание<strong>{{ runCounts.attention }}</strong></span></div><div><IconX :size="20" /><span>Ошибки<strong>{{ runCounts.failed }}</strong></span></div><div><IconPlayerPlay :size="20" /><span>Осталось<strong>{{ runCounts.queued + runCounts.inProgress }}</strong></span></div></div>
          <details v-if="selectedRun.coverLetter" class="run-cover-letter"><summary>{{ selectedRun.aiLetter?.enabled ? 'Резервное письмо запуска' : 'Общее письмо запуска' }}</summary><p>{{ selectedRun.coverLetter }}</p></details>
          <details v-if="selectedRun.aiLetter?.enabled" class="run-cover-letter"><summary>Шаблон AI-письма · до {{ selectedRun.aiLetter.maxLength }} символов</summary><p>{{ selectedRun.aiLetter.template }}</p></details>
          <small v-if="selectedRun.aiLetter?.enabled && !selectedRun.coverLetter.trim()">Резервное письмо не задано: без AI-письма отклик не отправляется.</small>
          <details v-if="selectedRun.applications.some(item => item.letter)" class="run-cover-letter">
            <summary>Подготовленные письма по вакансиям</summary>
            <PreparedLetterDetails v-for="item in selectedRun.applications.filter(item => item.letter)" :key="item.id" :item="item" />
          </details>
        </section>

        <section class="applications-table-card">
          <header class="applications-toolbar"><div class="filter-tabs application-filter-tabs"><button v-for="filter in filters" :key="filter.value" type="button" :class="{ 'filter-tab--active': activeFilter === filter.value }" @click="activeFilter = filter.value">{{ filterLabel(filter.value) }}</button></div><label class="search-input"><IconSearch :size="18" /><input v-model="query" type="search" placeholder="Вакансия или компания" /></label></header>
          <div v-if="filteredApplications.length" class="applications-table-wrap"><table class="applications-table"><thead><tr><th>Вакансия</th><th>Компания</th><th>Время</th><th>Результат</th><th>Комментарий</th></tr></thead><tbody><tr v-for="item in filteredApplications" :key="item.id" :class="{ 'application-row--attention': needsAttention(item) }"><td><HhExternalLink v-if="item.hhVacancyId" :href="`https://hh.ru/vacancy/${item.hhVacancyId}`"><strong>{{ item.vacancyTitle }}</strong></HhExternalLink><strong v-else>{{ item.vacancyTitle }}</strong></td><td><HhExternalLink v-if="employerIdFor(item)" :href="`https://hh.ru/employer/${employerIdFor(item)}`">{{ item.companyName }}</HhExternalLink><template v-else>{{ item.companyName }}</template></td><td>{{ formatDateTime(item.attemptedAt) ?? '—' }}</td><td><StatusBadge :label="itemPresentation(item).label" :tone="itemPresentation(item).tone" /></td><td :class="{ 'application-message--attention': needsAttention(item) }"><small v-if="isReviewed(item)">Исходный результат: </small>{{ item.message ?? '—' }}<div v-if="attentionTaskFor(item)" class="application-attention-actions"><AppButton v-if="attentionTaskFor(item)?.canSkipVacancy" size="small" variant="ghost" class="application-discard-button" :disabled="busyAttentionTaskId === attentionTaskFor(item)?.id" @click="changeItemAttentionStatus(item, 'SKIPPED')"><IconTrash :size="15" /> В пропущенные</AppButton><AppButton size="small" variant="primary" :disabled="busyAttentionTaskId === attentionTaskFor(item)?.id" @click="changeItemAttentionStatus(item, 'RESOLVED')"><IconCheck :size="15" /> Готово</AppButton></div></td></tr></tbody></table></div>
          <EmptyState v-else title="Здесь пока ничего нет" :description="dryRun ? 'Для выбранного фильтра нет вакансий.' : 'Для выбранного фильтра нет откликов.'" />
        </section>
      </main>
      <section v-else-if="detailError" class="page-error"><IconFileCv :size="36" /><h2>Не удалось загрузить запуск</h2><p>{{ detailError }}</p><AppButton variant="primary" :disabled="detailLoading" @click="ensureSelectedDetails(true)">Повторить</AppButton></section>
      <PageSkeleton v-else />
    </div>
    <EmptyState v-else title="Запусков пока нет" description="Сформируйте очередь вакансий и запустите первые отклики."><RouterLink class="app-button app-button--primary app-button--medium" to="/vacancies">Перейти к вакансиям</RouterLink></EmptyState>
  </div>
</template>
