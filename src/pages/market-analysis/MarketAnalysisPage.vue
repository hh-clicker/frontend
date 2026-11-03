<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { IconChartBar, IconCheck, IconCopy, IconDownload, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppDialog from '../../components/ui/AppDialog.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { applicationContextStore } from '../../services/applicationContext'
import { loadSearches } from '../../services/searches'
import type { SearchDefinition } from '../../api/contracts/searches'
import type { VacancyRelevanceCategory } from '../../api/contracts/vacancies'
import { cancelMarketAnalysis, loadMarketAnalyses, loadMarketAnalysisPreview, loadMarketAnalysisReport, resumeMarketAnalysis, startMarketAnalysis, stopMarketAnalysis, type MarketAnalysis, type MarketAnalysisPreview } from '../../services/marketAnalysis'
import { formatApproximateDuration, formatDateTime } from '../../utils/dateTime'

const context = applicationContextStore.state
const route = useRoute()
const debugReportEnabled = computed(() => route.query.debug === '1')
const selectedResumeId = computed(() => context.overview?.selectedResumeId ?? null)
const selectedResume = computed(() => context.overview?.resumes.find((resume) => resume.id === selectedResumeId.value) ?? null)
const reports = ref<MarketAnalysis[]>([])
const selectedReportId = ref<string | null>(null)
const selectedReport = computed(() => reports.value.find((report) => report.id === selectedReportId.value) ?? null)
const vacancyLimitInput = ref('')
const availableVacancies = ref<number | null>(null)
const maxVacancies = computed(() => Number(vacancyLimitInput.value))
const validVacancyLimit = computed(() => availableVacancies.value !== null
  && /^\d+$/.test(vacancyLimitInput.value)
  && Number.isSafeInteger(maxVacancies.value)
  && maxVacancies.value > 0
  && maxVacancies.value <= availableVacancies.value)
const preview = ref<MarketAnalysisPreview | null>(null)
const previewLoading = ref(false)
const showStartDialog = ref(false)
const dialogError = ref<string | null>(null)
const searches = ref<SearchDefinition[]>([])
const searchesLoading = ref(false)
const selectedSearchId = ref('')
const selectedRelevanceCategory = ref<VacancyRelevanceCategory | ''>('')
let searchLoadRevision = 0
let previewRevision = 0
let previewTimer: ReturnType<typeof setTimeout> | null = null
const hasOpenAnalysis = computed(() => reports.value.some((report) => ['RUNNING', 'STOPPING', 'PAUSED'].includes(report.status)))
const progressPercent = computed(() => {
  const report = selectedReport.value
  if (!report?.vacancyCount) return 0
  return Math.max(0, Math.min(100, Math.round(report.processed / report.vacancyCount * 100)))
})
const estimatedRemainingLabel = computed(() => {
  const report = selectedReport.value
  if (report?.status !== 'RUNNING' || report.estimatedRemainingSeconds == null) return null
  return `Примерно осталось: ${formatApproximateDuration(report.estimatedRemainingSeconds)}`
})
const loading = ref(false)
const starting = ref(false)
const continuing = ref(false)
const stopping = ref(false)
const cancelling = ref(false)
const cancelReportId = ref<string | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)
let loadRevision = 0
let refreshTimer: ReturnType<typeof setInterval> | null = null

const analysisPrompt = `Я приложил два материала: MD-отчёт HH Clicker и актуальный текст моего резюме. Помоги понять, как резюме отражает формулировки вакансий, которые я отобрал, и что стоит уточнить в нём после проверки моего реального опыта.

Как читать отчёт: это срез сохранённых вакансий с полным текстом для моего резюме, а не весь рынок HH. В таблицах указаны дословные технологии, навыки, домены и названия должностей; для каждой строки приведены число вакансий, число компаний и вес. Вес уменьшает влияние повторных вакансий одной компании. Высокая частота или вес показывают распространённость в этом срезе, но не доказывают обязательность требования. Обычный отчёт не содержит полных текстов вакансий и цитат.

Сначала кратко опиши заметные направления этого среза. Затем разбери технологии, навыки и домены по отдельности. Сгруппируй очевидные варианты написания или склонения для обсуждения, но сохрани исходные формулировки из таблиц: неизвестно, объединяет ли их поиск HH. Не склеивай разные технологии только потому, что они относятся к одному семейству. Названия должностей используй как дополнительный контекст, а не как доказательство конкретных требований.

Для значимых пунктов покажи исходную формулировку, частоту, число компаний, вес и что именно есть в резюме: прямое упоминание, косвенное подтверждение с коротким фрагментом либо упоминание не найдено. Отсутствие слова в резюме не означает отсутствия опыта. Отдельно выдели формулировки, которые могут быть полезны для поиска HH, даже если человеку они кажутся синонимами. Приоритет предложений объясняй данными отчёта и содержанием резюме, а не придуманным «ATS-баллом».

В конце предложи конкретные, осторожные правки резюме и вопросы, которые нужно задать мне перед их внесением. Не добавляй инструменты, обязанности, достижения и опыт без моего подтверждения. Не вычисляй общий процент соответствия и не утверждай, что резюме стало лучше по одной цифре. Если для вывода нужен контекст конкретной вакансии, прямо скажи, что обычного отчёта недостаточно, и попроси подробный проверочный MD. Если данных для вывода мало — отметь неопределённость, не заполняй пробелы догадками.`

function statusLabel(status: MarketAnalysis['status']): string {
  return { RUNNING: 'В работе', STOPPING: 'Приостанавливается', PAUSED: 'Пауза',
    COMPLETED: 'Готов', FAILED: 'Ошибка', CANCELLED: 'Отменён' }[status]
}

const statusTones = { RUNNING: 'blue', STOPPING: 'orange', PAUSED: 'orange',
  COMPLETED: 'green', FAILED: 'red', CANCELLED: 'neutral' } as const

function statusTone(status: MarketAnalysis['status']): 'blue' | 'orange' | 'green' | 'red' | 'neutral' {
  return statusTones[status]
}

function historyDescription(report: MarketAnalysis): string {
  return { RUNNING: 'Разбор выполняется', STOPPING: 'Завершаются выданные партии',
    PAUSED: 'Приостановлен', COMPLETED: `${report.vacancyCount} вакансий · ${report.diagnosticCount} замечаний`,
    FAILED: 'Ошибка разбора', CANCELLED: 'Анализ отменён' }[report.status]
}

async function refresh(silent = false): Promise<void> {
  const resumeId = selectedResumeId.value
  const revision = ++loadRevision
  if (!silent) {
    reports.value = []
    selectedReportId.value = null
    error.value = null
  }
  if (!resumeId) return
  if (!silent) loading.value = true
  try {
    const loaded = await loadMarketAnalyses(resumeId)
    if (revision !== loadRevision) return
    reports.value = loaded
    if (!loaded.some((report) => report.id === selectedReportId.value)) selectedReportId.value = loaded[0]?.id ?? null
  } catch (cause) {
    if (revision === loadRevision && !silent) error.value = cause instanceof Error ? cause.message : 'Не удалось загрузить историю анализов'
  } finally {
    if (revision === loadRevision && !silent) loading.value = false
  }
}

async function start(): Promise<void> {
  const resume = selectedResume.value
  if (!resume || starting.value || !validVacancyLimit.value || previewLoading.value
    || preview.value?.selectedCount !== maxVacancies.value) return
  starting.value = true
  dialogError.value = null
  try {
    const search = searches.value.find((item) => item.id === selectedSearchId.value)
    const report = await startMarketAnalysis(resume.id, resume.name, maxVacancies.value,
      selectedSearchId.value || null, search?.name ?? null, selectedRelevanceCategory.value || null)
    if (selectedResumeId.value !== resume.id) return
    reports.value = [report, ...reports.value]
    selectedReportId.value = report.id
    closeStartDialog(true)
  } catch (cause) {
    dialogError.value = cause instanceof Error ? cause.message : 'Не удалось запустить анализ'
  } finally {
    starting.value = false
  }
}

function openStartDialog(): void {
  if (!selectedResume.value || loading.value || hasOpenAnalysis.value) return
  dialogError.value = null
  searches.value = []
  showStartDialog.value = true
  void loadSearchOptions()
  void refreshAvailableVacancies()
}

async function loadSearchOptions(): Promise<void> {
  const resumeId = selectedResumeId.value
  if (!resumeId) return
  const revision = ++searchLoadRevision
  searchesLoading.value = true
  try {
    const loaded = await loadSearches(resumeId)
    if (revision === searchLoadRevision && showStartDialog.value && selectedResumeId.value === resumeId) searches.value = loaded
  } catch (cause) {
    if (revision === searchLoadRevision && showStartDialog.value && selectedResumeId.value === resumeId) {
      dialogError.value = cause instanceof Error ? cause.message : 'Не удалось загрузить поиски'
    }
  } finally {
    if (revision === searchLoadRevision) searchesLoading.value = false
  }
}

function closeStartDialog(force = false): void {
  if (starting.value && !force) return
  showStartDialog.value = false
  ++searchLoadRevision
  selectedSearchId.value = ''
  selectedRelevanceCategory.value = ''
  ++previewRevision
  if (previewTimer) clearTimeout(previewTimer)
}

async function resume(): Promise<void> {
  const report = selectedReport.value
  if (!report || !['FAILED', 'PAUSED'].includes(report.status) || report.phase !== 'EXTRACT' || continuing.value) return
  continuing.value = true
  error.value = null
  try {
    const resumed = await resumeMarketAnalysis(report.id)
    if (selectedResumeId.value !== report.resumeId) return
    reports.value = reports.value.map((item) => item.id === resumed.id ? resumed : item)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось продолжить анализ'
  } finally {
    continuing.value = false
  }
}

async function stop(): Promise<void> {
  const report = selectedReport.value
  if (report?.status !== 'RUNNING' || stopping.value) return
  stopping.value = true
  error.value = null
  try {
    const stopped = await stopMarketAnalysis(report.id)
    reports.value = reports.value.map((item) => item.id === stopped.id ? stopped : item)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось приостановить анализ'
  } finally {
    stopping.value = false
  }
}

function requestCancel(): void {
  const report = selectedReport.value
  if (report && ['RUNNING', 'STOPPING', 'PAUSED'].includes(report.status)) cancelReportId.value = report.id
}

function closeCancelDialog(): void {
  if (!cancelling.value) cancelReportId.value = null
}

async function cancel(): Promise<void> {
  const id = cancelReportId.value
  if (!id || cancelling.value) return
  cancelling.value = true
  error.value = null
  try {
    const cancelled = await cancelMarketAnalysis(id)
    reports.value = reports.value.map((item) => item.id === id ? cancelled : item)
    cancelReportId.value = null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось отменить анализ'
    cancelReportId.value = null
  } finally {
    cancelling.value = false
  }
}

async function refreshAvailableVacancies(): Promise<void> {
  const resumeId = selectedResumeId.value
  const revision = ++previewRevision
  if (previewTimer) clearTimeout(previewTimer)
  availableVacancies.value = null
  vacancyLimitInput.value = ''
  preview.value = null
  previewLoading.value = false
  if (!resumeId) return
  previewLoading.value = true
  try {
    const result = await loadMarketAnalysisPreview(resumeId, null, selectedSearchId.value || null,
      selectedRelevanceCategory.value || null)
    if (revision === previewRevision) {
      availableVacancies.value = result.availableCount
      vacancyLimitInput.value = String(result.availableCount)
      preview.value = result
    }
  } catch (cause) {
    if (revision === previewRevision) dialogError.value = cause instanceof Error ? cause.message : 'Не удалось рассчитать выборку'
  } finally {
    if (revision === previewRevision) previewLoading.value = false
  }
}

function updatePreview(): void {
  if (previewTimer) clearTimeout(previewTimer)
  const available = availableVacancies.value
  if (available === null) return
  if (preview.value?.selectedCount === maxVacancies.value && /^\d+$/.test(vacancyLimitInput.value)) return
  const revision = ++previewRevision
  preview.value = null
  if (!/^\d+$/.test(vacancyLimitInput.value) || maxVacancies.value > available
    || !Number.isSafeInteger(maxVacancies.value)) {
    previewLoading.value = false
    return
  }
  if (maxVacancies.value === 0) {
    preview.value = { availableCount: available, selectedCount: 0, earliestAttemptedAt: null }
    previewLoading.value = false
    return
  }
  const resumeId = selectedResumeId.value
  if (!resumeId) return
  previewLoading.value = true
  previewTimer = setTimeout(async () => {
    try {
      const result = await loadMarketAnalysisPreview(resumeId, maxVacancies.value, selectedSearchId.value || null,
        selectedRelevanceCategory.value || null)
      if (revision === previewRevision) preview.value = result
    } catch (cause) {
      if (revision === previewRevision) dialogError.value = cause instanceof Error ? cause.message : 'Не удалось рассчитать выборку'
    } finally {
      if (revision === previewRevision) previewLoading.value = false
    }
  }, 300)
}

function normalizeLimit(): void {
  if (availableVacancies.value === null) return
  const parsed = Number(vacancyLimitInput.value)
  vacancyLimitInput.value = String(Number.isFinite(parsed)
    ? Math.min(availableVacancies.value, Math.max(0, Math.floor(parsed))) : 0)
}

async function downloadReport(debug = false): Promise<void> {
  const report = selectedReport.value
  if (!report?.reportAvailable) return
  try {
    const markdown = await loadMarketAnalysisReport(report, debug)
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hh-clicker-market-analysis-${report.id}${debug ? '-debug' : ''}.md`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось скачать отчёт'
  }
}

async function copyPrompt(): Promise<void> {
  try {
    await navigator.clipboard.writeText(analysisPrompt)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 2500)
  } catch {
    error.value = 'Не удалось скопировать промпт. Проверьте разрешение браузера на доступ к буферу обмена.'
  }
}

watch(selectedResumeId, () => { closeStartDialog(true); closeCancelDialog(); void refresh() }, { immediate: true })
watch(selectedSearchId, () => { if (showStartDialog.value) void refreshAvailableVacancies() })
watch(selectedRelevanceCategory, () => { if (showStartDialog.value) void refreshAvailableVacancies() })
watch(vacancyLimitInput, updatePreview)
onMounted(() => {
  void applicationContextStore.load()
  refreshTimer = setInterval(() => {
    if (reports.value.some((report) => ['RUNNING', 'STOPPING'].includes(report.status))) void refresh(true)
  }, 5000)
})
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); if (previewTimer) clearTimeout(previewTimer) })
</script>

<template>
  <div class="market-analysis-page">
    <header class="page-header">
      <div><h1>Аналитика рынка</h1><p>Срез вакансий с сохранённым текстом для выбранного резюме, включая холостые запуски. Анализ использует Generation Agent и может занять несколько минут.</p></div>
      <AppButton variant="primary" :disabled="!selectedResume || loading || hasOpenAnalysis" @click="openStartDialog"><IconPlayerPlay :size="18" /> Запустить анализ</AppButton>
    </header>

    <AppAlert v-if="error" tone="warning" dismissible @dismiss="error = null"><strong>Операция не выполнена.</strong> {{ error }}</AppAlert>

    <div class="market-analysis-layout">
      <aside class="market-analysis-history">
        <header><h2>Анализы</h2><span>{{ reports.length }}</span></header>
        <div v-if="loading" class="market-analysis-history__empty">Загрузка истории…</div>
        <template v-else>
          <button v-for="report in reports" :key="report.id" type="button" class="market-analysis-history__item" :class="{ 'market-analysis-history__item--active': selectedReportId === report.id }" @click="selectedReportId = report.id">
            <strong>{{ formatDateTime(report.createdAt) }}</strong>
            <span>{{ report.resumeName }}</span>
            <small v-if="report.searchName">Поиск: {{ report.searchName }}</small>
            <small>{{ historyDescription(report) }}</small>
            <StatusBadge :label="statusLabel(report.status)" :tone="statusTone(report.status)" />
          </button>
        </template>
        <div v-if="!loading && !reports.length" class="market-analysis-history__empty">Анализов пока нет.</div>
      </aside>

      <main class="market-analysis-content">
        <section v-if="!selectedResume" class="market-analysis-card market-analysis-empty"><IconChartBar :size="34" /><h2>Выберите резюме</h2><p>Анализ объединяет вакансии с сохранённым текстом для выбранного резюме.</p></section>
        <section v-else-if="!selectedReport" class="market-analysis-card market-analysis-empty"><IconChartBar :size="34" /><h2>Здесь будет результат анализа</h2><p>После расчёта появятся краткая сводка и Markdown-отчёт для подробного разбора с агентом.</p></section>
        <template v-else>
          <section class="market-analysis-card market-analysis-summary">
            <header><div><span class="market-analysis-eyebrow">Срез вакансий</span><h2>{{ selectedReport.resumeName }}</h2><p>Создан {{ formatDateTime(selectedReport.createdAt) }} · {{ selectedReport.searchName ? `Поиск: ${selectedReport.searchName}` : 'Все поиски' }}</p></div><StatusBadge :label="statusLabel(selectedReport.status)" :tone="statusTone(selectedReport.status)" /></header>
            <div v-if="selectedReport.status === 'COMPLETED'" class="market-analysis-summary__body">
              <p class="market-analysis-summary__pending">Собраны дословные технологии, навыки и домены. Замечаний при извлечении: {{ selectedReport.diagnosticCount }}. Частоты — в MD-отчёте; сравнение с резюме здесь не выполняется.</p>
              <dl class="market-analysis-facts"><div><dt>Вакансий с полным текстом</dt><dd>{{ selectedReport.vacancyCount }}</dd></div><div><dt>Компаний</dt><dd>{{ selectedReport.companyCount }}</dd></div><div><dt>Период источников</dt><dd>{{ selectedReport.periodFrom && selectedReport.periodTo ? `${formatDateTime(selectedReport.periodFrom)} — ${formatDateTime(selectedReport.periodTo)}` : '—' }}</dd></div></dl>
              <div class="market-analysis-summary__actions"><AppButton v-if="debugReportEnabled" :disabled="!selectedReport.reportAvailable" @click="downloadReport(true)"><IconDownload :size="18" /> Скачать отладочный MD</AppButton><AppButton variant="primary" :disabled="!selectedReport.reportAvailable" @click="downloadReport()"><IconDownload :size="18" /> Скачать MD-отчёт</AppButton></div>
            </div>
            <div v-else class="market-analysis-progress">
              <div class="market-analysis-progress__header"><span>Обработано {{ selectedReport.processed }} из {{ selectedReport.vacancyCount }}</span><strong>{{ progressPercent }}%</strong></div>
              <div class="market-analysis-progress__track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100" :aria-label="`Прогресс анализа: ${selectedReport.processed} из ${selectedReport.vacancyCount}`"><span :style="{ width: `${progressPercent}%` }" /></div>
              <div class="market-analysis-progress__footer">
                <template v-if="selectedReport.status === 'RUNNING'"><p>{{ estimatedRemainingLabel ?? 'Оценка времени появится после первой партии.' }} · Замечаний: {{ selectedReport.diagnosticCount }}. Можно уйти со страницы — разбор продолжится.</p><div class="market-analysis-progress__actions"><AppButton :loading="stopping" @click="stop"><IconPlayerStop :size="18" /> Приостановить</AppButton><AppButton variant="danger" @click="requestCancel">Отменить</AppButton></div></template>
                <template v-else-if="selectedReport.status === 'STOPPING'"><p>Ожидаем завершения уже выданных партий. Новые партии не запускаются, обработанные вакансии сохраняются.</p><AppButton variant="danger" @click="requestCancel">Отменить</AppButton></template>
                <template v-else-if="selectedReport.status === 'PAUSED'"><p>Анализ приостановлен. Уже обработанные вакансии сохранены.</p><div class="market-analysis-progress__actions"><AppButton variant="primary" :loading="continuing" @click="resume"><IconPlayerPlay :size="18" /> Продолжить</AppButton><AppButton variant="danger" @click="requestCancel">Отменить</AppButton></div></template>
                <p v-else-if="selectedReport.status === 'CANCELLED'">Анализ отменён. Можно запустить новый с другой выборкой.</p>
                <template v-else><p class="market-analysis-progress__error">{{ selectedReport.error ?? 'Разбор остановился.' }} Уже обработанные вакансии сохранены.</p><AppButton v-if="selectedReport.phase === 'EXTRACT'" variant="primary" :loading="continuing" :disabled="reports.some((report) => ['RUNNING', 'STOPPING', 'PAUSED'].includes(report.status))" @click="resume"><IconPlayerPlay :size="18" /> Продолжить</AppButton></template>
              </div>
            </div>
          </section>

          <section v-if="selectedReport.status === 'COMPLETED'" class="market-analysis-card market-analysis-guide">
            <h2>Разобрать отчёт с агентом</h2>
            <p>Скачайте MD-отчёт и передайте его своему агенту вместе с актуальным резюме. Отчёт содержит таблицы исходных формулировок, названий вакансий и их частот; выводы и сравнение с резюме сделает агент.</p>
            <div class="market-analysis-guide__prompt"><span>Промпт для анализа</span><p>{{ analysisPrompt }}</p></div>
            <div class="market-analysis-guide__actions"><AppButton @click="copyPrompt"><IconCheck v-if="copied" :size="18" /><IconCopy v-else :size="18" /> {{ copied ? 'Скопировано' : 'Скопировать промпт' }}</AppButton></div>
          </section>
        </template>
      </main>
    </div>
    <AppDialog v-if="showStartDialog" title="Запустить анализ рынка" :description="`Резюме: ${selectedResume?.name ?? '—'}`" size="small" @close="closeStartDialog">
      <div class="market-analysis-start-dialog">
        <label class="form-field" for="market-search"><span class="form-label">Поиск</span><select id="market-search" v-model="selectedSearchId" class="form-control" :disabled="starting || searchesLoading"><option value="">Все поиски</option><option v-for="search in searches" :key="search.id" :value="search.id">{{ search.name }}</option></select></label>
        <label class="form-field" for="market-relevance-category"><span class="form-label">Оценка вакансий</span><select id="market-relevance-category" v-model="selectedRelevanceCategory" class="form-control" :disabled="starting"><option value="">Все, включая без оценки</option><option value="TARGET">Цель</option><option value="ADJACENT">Смежная</option><option value="UNKNOWN">Проверить</option><option value="NOISE">Мимо</option></select></label>
        <label class="form-field" for="market-sample-size"><span class="form-label">Последние вакансии</span><input id="market-sample-size" v-model="vacancyLimitInput" class="form-control" type="text" inputmode="numeric" pattern="[0-9]*" :disabled="starting || availableVacancies === null" :aria-invalid="availableVacancies !== null && !validVacancyLimit" aria-describedby="market-sample-preview" @blur="normalizeLimit" /></label>
        <p id="market-sample-preview" aria-live="polite">{{ previewLoading ? 'Считаем выборку…' : preview ? `Будут обработаны ${preview.selectedCount} из ${preview.availableCount} вакансий${preview.earliestAttemptedAt ? `; тексты загружены с ${formatDateTime(preview.earliestAttemptedAt)}` : ''}.` : availableVacancies === null ? 'Выборка недоступна.' : `Введите число от 0 до ${availableVacancies}.` }}</p>
        <AppAlert v-if="dialogError" tone="warning" dismissible @dismiss="dialogError = null">{{ dialogError }}</AppAlert>
      </div>
      <template #footer><AppButton :disabled="starting" @click="closeStartDialog">Отмена</AppButton><AppButton variant="primary" :loading="starting" :disabled="previewLoading || !validVacancyLimit || preview?.selectedCount !== maxVacancies || hasOpenAnalysis" @click="start"><IconPlayerPlay :size="18" /> Запустить</AppButton></template>
    </AppDialog>
    <AppDialog v-if="cancelReportId" title="Отменить анализ?" description="Продолжить этот запуск после отмены будет нельзя. Уже собранный прогресс останется в истории, а новый анализ можно будет запустить сразу." size="small" tone="warning" @close="closeCancelDialog">
      <template #footer><AppButton :disabled="cancelling" @click="closeCancelDialog">Назад</AppButton><AppButton variant="danger" :loading="cancelling" @click="cancel">Отменить анализ</AppButton></template>
    </AppDialog>
  </div>
</template>
