<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconChevronRight, IconCopy, IconExternalLink, IconRefresh, IconSparkles, IconWand } from '@tabler/icons-vue'
import type { DiagnosticMode, DiagnosticPageType, SelectorDiagnosticReport } from '../../api/contracts/browser'
import { diagnoseSelectorsViaAgent, focusDiagnosticViaAgent } from '../../services/browser'
import { selectorDiagnosticSummary, mergeSelectorDiagnosticRepair } from '../../services/selectorDiagnosticSummary'
import AppButton from '../ui/AppButton.vue'
import AppAlert from '../ui/AppAlert.vue'
import AppSelect from '../ui/AppSelect.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import { isMockMode } from '../../app/runtime'
import { useSelectorRepairReadiness } from '../../composables/useSelectorRepairReadiness'

const props = defineProps<{ accountId: string; resumeId: string | null; available: boolean; fullAvailable: boolean;
  entry?: { pageType: DiagnosticPageType; fields: string; tabId: string | null; accountId: string | null } | null }>()
const { ready: generationReady, label: generationLabel, explanation: generationExplanation, loading: generationLoading, read: readGeneration } = useSelectorRepairReadiness()
const generationTone = computed<'green' | 'blue' | 'orange'>(() => generationReady.value ? 'green' : generationLoading.value ? 'blue' : 'orange')
const matchingEntry = computed(() => props.entry && (!props.entry.accountId || props.entry.accountId === props.accountId) ? props.entry : null)
const mode = ref<DiagnosticMode | null>(null)
const focusing = ref<string | null>(null)
const report = ref<SelectorDiagnosticReport | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const copied = ref(false)
const repairing = ref<string | null>(null)
const tabs = ref<{ tabId: string; label: string }[]>([])
const selectedTab = ref<string | number | null>(null)
const openStep = ref<string | null>(null)
const errorStep = ref<string | null>(null)
const tabOptions = computed(() => tabs.value.map(tab => ({ value: tab.tabId, label: tab.label })))
watch(() => [props.accountId, props.resumeId], () => { tabs.value = []; selectedTab.value = null; repairing.value = null })
let requestId = 0
watch(() => props.accountId, reset)
watch(() => props.resumeId, reset)
watch(() => props.entry, reset)
function reset(): void { requestId++; report.value = null; error.value = null; errorStep.value = null; openStep.value = null; copied.value = false; busy.value = false }
function firstProblem(result: SelectorDiagnosticReport): string | null {
  return (result.scenarios ?? [result]).find(step => step.status === 'CHECKED' && selectorDiagnosticSummary(step) !== 'PASSED')?.pageType ?? null
}
async function check(selectedMode: DiagnosticMode, tabId: string | null = null): Promise<void> {
  if (busy.value || !(selectedMode === 'FULL' ? props.fullAvailable : props.available)) return
  if (selectedMode === 'FULL') { tabs.value = []; selectedTab.value = null }
  mode.value = selectedMode
  repairing.value = null
  const current = ++requestId
  busy.value = true; report.value = null; error.value = null; errorStep.value = null; openStep.value = null; copied.value = false
  try {
    const result = await diagnoseSelectorsViaAgent(props.accountId, selectedMode, props.resumeId, tabId)
    if (current === requestId) {
      report.value = result
      openStep.value = firstProblem(result)
      if (result.status === 'SELECT_TAB') { tabs.value = result.tabs ?? []; selectedTab.value = null }
    }
  } catch (cause) {
    if (current === requestId) error.value = cause instanceof Error ? cause.message : 'Диагностика не выполнена.'
  } finally { if (current === requestId) busy.value = false }
}
async function copy(): Promise<void> {
  if (!report.value) return
  try { await navigator.clipboard.writeText(JSON.stringify(report.value, null, 2)); copied.value = true }
  catch { error.value = 'Браузер не разрешил копирование диагностики.'; errorStep.value = null }
}
const repairLabels: Record<string, string> = { profile: 'профиль', search: 'поиск', vacancy: 'вакансию', resumeText: 'печатное резюме' }
async function repair(step: SelectorDiagnosticReport, group: string): Promise<void> {
  if (busy.value || !props.available || !step.tabId || !step.repairableGroups?.includes(group)) return
  if (!generationReady.value) return
  const current = ++requestId
  busy.value = true; repairing.value = group; error.value = null; errorStep.value = null; openStep.value = step.pageType; copied.value = false; mode.value = 'CURRENT'
  try {
    if (!await readGeneration()) throw new Error('Generation Agent сейчас не готов к ИИ-починке. Проверьте подключение и вход в Codex, затем обновите статус.')
    const result = await diagnoseSelectorsViaAgent(props.accountId, 'CURRENT', props.resumeId, step.tabId, group)
    if (current === requestId) {
      report.value = mergeSelectorDiagnosticRepair(report.value, step, result); tabs.value = []; selectedTab.value = null
      openStep.value = firstProblem(report.value)
    }
  } catch (cause) {
    if (current === requestId) { error.value = cause instanceof Error ? cause.message : 'Исправление не сохранено.'; errorStep.value = step.pageType }
  } finally {
    if (current === requestId) { busy.value = false; repairing.value = null }
  }
}
const labels = { PASS: 'Пройдено', FAIL: 'Поломка', NOT_CHECKED: 'Не проверено', NOT_APPLICABLE: 'Не применимо', STATE_NOT_CHECKED: 'Состояние не проверено' }
const steps = computed(() => report.value ? report.value.scenarios ?? [report.value] : [])
const entryPassed = computed(() => !!matchingEntry.value && !busy.value && !error.value && steps.value.some(step =>
  step.pageType === matchingEntry.value?.pageType && step.status === 'CHECKED' && selectorDiagnosticSummary(step) === 'PASSED'))
const outcome = computed(() => report.value ? selectorDiagnosticSummary(report.value) : 'INCOMPLETE')
const summaryLabels = { PASSED: 'Доступные проверки пройдены', FAILED: 'Обнаружена поломка', INCOMPLETE: 'Проверка неполная' }
const summaryTones = { PASSED: 'green', FAILED: 'red', INCOMPLETE: 'orange' } as const
const pageLabels = { PROFILE: 'Профиль', RESUME: 'Печатное резюме', SEARCH: 'Поиск', VACANCY: 'Вакансия и формы', UNKNOWN: 'Неизвестная страница', FULL: 'Полная диагностика' }
async function focus(tabId?: string | null): Promise<void> {
  if (!tabId || focusing.value) return
  const current = requestId
  focusing.value = tabId
  try { await focusDiagnosticViaAgent(props.accountId, tabId) }
  catch (cause) { if (current === requestId) error.value = cause instanceof Error ? cause.message : 'Не удалось показать вкладку.' }
  finally { focusing.value = null }
}
const tones = { PASS: 'green', FAIL: 'red', NOT_CHECKED: 'orange', NOT_APPLICABLE: 'neutral', STATE_NOT_CHECKED: 'neutral' } as const
const stepViews = computed(() => steps.value.map(step => {
  const summary = selectorDiagnosticSummary(step)
  const issues = step.rows.filter(row => row.status === 'FAIL' || row.status === 'NOT_CHECKED')
  const passed = step.rows.filter(row => row.status === 'PASS').length
  const hidden = step.rows.filter(row => row.status === 'STATE_NOT_CHECKED').length
  const active = !!repairing.value && step.repairableGroups?.includes(repairing.value) === true
  const tone: 'blue' | 'neutral' | typeof summaryTones[keyof typeof summaryTones] = active ? 'blue' : step.status === 'BLOCKED' ? 'neutral' : summaryTones[summary]
  return { step, summary, issues, passed, hidden, active, tone,
    label: active ? 'Исправление…' : step.status === 'BLOCKED' ? 'Ожидает предыдущий шаг' : summary === 'PASSED' ? 'Пройдено' : summary === 'FAILED' ? 'Поломка' : 'Не завершено',
    caption: step.status === 'BLOCKED' ? 'Зависит от другого сценария' : issues.length ? `${issues.length} проблемных проверок` : `${passed} проверок пройдено`,
  }
}))
const passedSteps = computed(() => stepViews.value.filter(view => view.summary === 'PASSED').length)
const hasRepair = computed(() => steps.value.some(step => step.repairableGroups?.length))
const statusTitle = computed(() => busy.value
  ? repairing.value ? `Исправляем ${repairLabels[repairing.value] ?? repairing.value}…` : mode.value === 'FULL' ? 'Проверяем страницы HH…' : 'Получаем данные вкладок…'
  : report.value ? summaryLabels[outcome.value] : 'Выберите полную диагностику или открытую вкладку')
</script>

<template>
  <section class="content-card selector-diagnostics">
    <header class="diagnostic-header">
      <div class="diagnostic-header__title">
        <h2>Диагностика страниц HH</h2><StatusBadge v-if="isMockMode" label="Демо" tone="neutral" :dot="false" />
      </div>
      <div class="diagnostic-toolbar">
        <AppButton v-if="report && report.status !== 'SELECT_TAB'" variant="ghost" size="small" @click="copy"><IconCopy :size="16" />{{ copied ? 'Скопировано' : 'Скопировать отчёт' }}</AppButton>
        <AppButton :disabled="!available || busy" :loading="busy && mode === 'CURRENT' && !repairing" @click="check('CURRENT')">{{ tabs.length ? 'Обновить вкладки' : 'Выбрать вкладку' }}</AppButton>
        <AppButton variant="primary" :disabled="!fullAvailable || busy" :loading="busy && mode === 'FULL' && !repairing" @click="check('FULL')">Полная диагностика</AppButton>
      </div>
    </header>

    <AppAlert v-if="entry && !matchingEntry" tone="info">Выберите HH-аккаунт, из которого перешли к диагностике. Вкладка ошибки принадлежит другому аккаунту.</AppAlert>
    <AppAlert v-else-if="matchingEntry && entryPassed" tone="info">
      <strong>{{ pageLabels[matchingEntry.pageType] }}: проверка пройдена.</strong>
      <p>Можно вернуться к исходной операции и попробовать выполнить её снова.</p>
    </AppAlert>
    <AppAlert v-else-if="matchingEntry" tone="info">
      <strong>Проверка: {{ pageLabels[matchingEntry.pageType] }}.</strong>
      <p v-if="matchingEntry.fields">Не удалось прочитать: {{ matchingEntry.fields }}.</p>
      <p>Полная диагностика не нужна. Если запуск ещё выполняется, поставьте его на паузу и дождитесь завершения текущего действия.</p>
      <p v-if="matchingEntry.tabId">Проверьте сохранённую проблемную вкладку. Если она закрыта или браузер перезапущен, откройте нужную страницу заново и нажмите «Выбрать вкладку».</p>
      <p v-else>Откройте нужную страницу в управляемом Chrome, нажмите «Выбрать вкладку» и выберите её в списке.</p>
      <div v-if="matchingEntry.tabId" class="diagnostic-entry-actions"><AppButton :disabled="busy || !available" @click="check('CURRENT', matchingEntry.tabId)">Проверить проблемную вкладку</AppButton></div>
    </AppAlert>

    <div class="diagnostic-generation" :data-ready="generationReady">
      <span class="diagnostic-generation__icon" aria-hidden="true"><IconSparkles :size="22" /></span>
      <div class="diagnostic-generation__content">
        <div class="diagnostic-generation__heading"><strong>Generation Agent</strong><StatusBadge :label="generationLabel" :tone="generationTone" /></div>
        <p>{{ generationExplanation }}</p>
      </div>
      <AppButton size="small" :loading="generationLoading" :disabled="busy || generationLoading" @click="readGeneration(true)"><IconRefresh v-if="!generationLoading" :size="16" />Обновить статус</AppButton>
    </div>

    <details class="diagnostic-help">
      <summary>Как это работает</summary>
      <p>Полная диагностика проверяет профиль, печатное резюме, поиск и вакансию из выдачи в фоновых вкладках. Выбор вкладки позволяет проверить уже открытую страницу, включая форму письма.</p>
      <p>Проверяется только наблюдаемое состояние. Закрытые формы и другие состояния не подтверждаются. Отклики не отправляются, поля не заполняются.</p>
    </details>

    <div v-if="tabs.length" class="diagnostic-tab-picker">
      <label>Открытая вкладка<AppSelect v-model="selectedTab" :options="tabOptions" :disabled="busy || !available" aria-label="Вкладка для диагностики" /></label>
      <AppButton variant="primary" :disabled="!selectedTab || busy || !available" @click="check('CURRENT', String(selectedTab))">Проверить вкладку</AppButton>
    </div>
    <p v-else-if="report?.status === 'SELECT_TAB'" class="diagnostic-empty">Открытых вкладок нет. Откройте нужную страницу в управляемом Chrome и обновите список.</p>

    <div v-if="busy || report && report.status !== 'SELECT_TAB'" class="diagnostic-status" :data-state="busy ? 'running' : outcome.toLowerCase()" role="status" aria-live="polite">
      <span class="diagnostic-status__dot" :class="{ 'diagnostic-status__dot--busy': busy }" aria-hidden="true" />
      <div class="diagnostic-status__text"><strong>{{ statusTitle }}</strong><span v-if="busy">{{ repairing ? 'Кандидат → независимая проверка → сохранение. Это может занять несколько минут.' : 'Не закрывайте вкладки, задействованные в проверке.' }}</span><span v-else>Результат относится к текущему состоянию страниц; отправка не проверялась.</span></div>
      <span v-if="steps.length > 1" class="diagnostic-status__count">{{ passedSteps }} из {{ steps.length }} без ошибок</span>
    </div>
    <p v-if="!fullAvailable && !busy" class="diagnostic-empty">Дождитесь готовности агента. Если идут отклики, сначала поставьте запуск на паузу.</p>
    <AppAlert v-if="error && !errorStep" tone="warning">{{ error }}</AppAlert>

    <p v-if="hasRepair || repairing" class="diagnostic-explanation">Для ИИ-починки по умолчанию используется GPT-6 Sol · medium. Два запроса к модели расходуют токены и могут занять несколько минут.</p>

    <div v-if="stepViews.length && report?.status !== 'SELECT_TAB'" class="diagnostic-steps">
      <section v-for="(view, index) in stepViews" :key="view.step.pageType" class="diagnostic-step" :class="{ 'diagnostic-step--active': view.active, 'diagnostic-step--open': openStep === view.step.pageType }">
        <div class="diagnostic-step__header">
          <button type="button" class="diagnostic-step__toggle" :aria-expanded="openStep === view.step.pageType" :aria-controls="`diagnostic-${view.step.pageType}`" @click="openStep = openStep === view.step.pageType ? null : view.step.pageType">
            <span class="diagnostic-step__number">{{ index + 1 }}</span>
            <span class="diagnostic-step__name"><strong>{{ pageLabels[view.step.pageType] }}</strong><small>{{ view.caption }}</small></span>
            <StatusBadge :label="view.label" :tone="view.tone" />
            <IconChevronRight class="diagnostic-step__chevron" :size="18" aria-hidden="true" />
          </button>
          <div class="diagnostic-step__actions">
            <AppButton v-if="view.step.tabId" variant="ghost" size="small" :disabled="busy || !!focusing" :loading="focusing === view.step.tabId" @click="focus(view.step.tabId)"><IconExternalLink :size="16" />Показать вкладку</AppButton>
            <template v-if="generationReady || view.active"><AppButton v-for="group in view.step.repairableGroups ?? []" :key="group" size="small" variant="primary" :disabled="busy || !available" :loading="view.active && repairing === group" @click="repair(view.step, group)"><IconWand v-if="!view.active" :size="16" />{{ view.active ? 'Исправление…' : 'Исправить с ИИ' }}</AppButton></template>
          </div>
        </div>

        <div v-if="openStep === view.step.pageType" :id="`diagnostic-${view.step.pageType}`" class="diagnostic-step__body">
          <p v-if="view.step.contextLabel" class="diagnostic-context">{{ view.step.contextLabel }}</p>
          <AppAlert v-if="error && errorStep === view.step.pageType" tone="warning">{{ error }}</AppAlert>
          <p v-if="view.step.status !== 'CHECKED'" class="diagnostic-explanation">{{ view.step.message }}</p>
          <ul v-else-if="view.issues.length" class="diagnostic-issues">
            <li v-for="row in view.issues" :key="`${row.group}.${row.key}`">
              <div><strong>{{ row.purpose }}</strong><p>{{ row.message }}</p><small>Найдено {{ row.matched }} · видно {{ row.visible }}</small></div>
              <StatusBadge :label="labels[row.status]" :tone="tones[row.status]" />
            </li>
          </ul>
          <p v-else class="diagnostic-explanation">Проверки доступных элементов пройдены.</p>
          <p v-if="view.hidden" class="diagnostic-explanation">Ещё {{ view.hidden }} проверок относятся к другим состояниям страницы — они не выполнялись.</p>
          <p v-if="view.step.repairNote" class="diagnostic-explanation">{{ view.step.repairNote }}</p>

          <details v-if="view.step.rows.length" class="diagnostic-technical">
            <summary>Все проверки и селекторы <span>{{ view.step.rows.length }}</span></summary>
            <div class="diagnostic-table"><table>
              <thead><tr><th>Элемент / селектор</th><th>Источник</th><th>Найдено / видно</th><th>Результат</th></tr></thead>
              <tbody><tr v-for="row in view.step.rows" :key="`${row.group}.${row.key}`">
                <td><strong>{{ row.group }}.{{ row.key }}</strong><p>{{ row.purpose }} · {{ row.required ? 'Обязательная' : 'Необязательная' }}</p><code>{{ row.selector }}</code></td>
                <td>{{ row.source === 'LOCAL' ? 'Локальный' : 'Штатный' }}</td><td>{{ row.matched }} / {{ row.visible }}</td>
                <td><StatusBadge :label="labels[row.status]" :tone="tones[row.status]" /><p>{{ row.message }}</p></td>
              </tr></tbody>
            </table></div>
          </details>
        </div>
      </section>
    </div>

    <footer class="diagnostic-footer">
      <span v-if="report && report.status !== 'SELECT_TAB'">Снимок: {{ new Date(report.checkedAt).toLocaleString() }}</span>
      <span v-if="isMockMode">Демонстрация: HH, backend и ИИ не вызываются.</span>
      <span v-else-if="hasRepair">По кнопке ИИ получит HTML с текстами и атрибутами без скриптов и технических секретов. Исправляются только разрешённые поля чтения.</span>
    </footer>
  </section>
</template>

<style scoped>
.selector-diagnostics { margin-top: var(--space-5); padding: var(--space-6); overflow: visible; }
.diagnostic-entry-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.diagnostic-generation { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-4); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-muted); }
.diagnostic-generation__icon { display: flex; align-items: center; justify-content: center; flex: 0 0 40px; height: 40px; border-radius: var(--radius-md); color: var(--color-orange); background: var(--color-orange-soft); }
.diagnostic-generation[data-ready="true"] .diagnostic-generation__icon { color: var(--color-green); background: var(--color-green-soft); }
.diagnostic-generation__content { flex: 1 1 260px; min-width: 0; }
.diagnostic-generation__heading { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.diagnostic-generation__content p { margin-top: var(--space-2); color: var(--color-text-secondary); font-size: var(--font-size-caption); }
.selector-diagnostics:has(.multiselect--active) { position: relative; z-index: 2; }
.diagnostic-header, .diagnostic-header__title, .diagnostic-toolbar { display: flex; align-items: center; gap: var(--space-3); }
.diagnostic-header { justify-content: space-between; flex-wrap: wrap; }
.diagnostic-header h2 { font-size: var(--font-size-card-title); margin: 0; }
.diagnostic-toolbar { flex-wrap: wrap; }
.diagnostic-help { margin-top: var(--space-3); color: var(--color-text-secondary); font-size: var(--font-size-caption); }
.diagnostic-help summary, .diagnostic-technical summary { cursor: pointer; width: fit-content; }
.diagnostic-help p { margin-top: var(--space-2); max-width: 95ch; }
.diagnostic-tab-picker { display: flex; gap: var(--space-3); align-items: end; flex-wrap: wrap; padding: var(--space-4); margin-top: var(--space-4); border-radius: var(--radius-md); background: var(--color-surface-muted); }
.diagnostic-tab-picker label { display: grid; gap: var(--space-2); flex: 1 1 320px; min-width: 0; }
.diagnostic-tab-picker :deep(.app-select) { width: 100%; }
.diagnostic-empty { margin-top: var(--space-4); color: var(--color-muted); }
.selector-diagnostics > :deep(.app-alert) { margin-top: var(--space-4); }
.diagnostic-step__body > :deep(.app-alert) { margin-top: var(--space-3); }
.diagnostic-status { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); margin-top: var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-muted); }
.diagnostic-status__text { display: grid; gap: var(--space-1); flex: 1; min-width: 0; }
.diagnostic-status__text span, .diagnostic-status__count { color: var(--color-text-secondary); font-size: var(--font-size-caption); }
.diagnostic-status__count { white-space: nowrap; }
.diagnostic-status__dot { width: 8px; height: 8px; border-radius: var(--radius-pill); flex: 0 0 auto; background: var(--color-neutral); }
.diagnostic-status[data-state="failed"] .diagnostic-status__dot { background: var(--color-red); }
.diagnostic-status[data-state="passed"] .diagnostic-status__dot { background: var(--color-green); }
.diagnostic-status[data-state="incomplete"] .diagnostic-status__dot { background: var(--color-orange); }
.diagnostic-status__dot--busy { background: var(--color-blue); animation: diagnostic-pulse 1.2s ease-in-out infinite; }
.diagnostic-steps { margin-top: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.diagnostic-step + .diagnostic-step { border-top: 1px solid var(--color-border); }
.diagnostic-step__header { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4); }
.diagnostic-step__toggle { display: flex; align-items: center; flex: 1; gap: var(--space-3); min-width: 0; text-align: left; border: 0; padding: 0; background: transparent; color: var(--color-text); font: inherit; cursor: pointer; }
.diagnostic-step__toggle:focus-visible { outline: none; border-radius: var(--radius-sm); box-shadow: var(--focus-ring); }
.diagnostic-step__number { display: grid; place-items: center; flex: 0 0 30px; height: 30px; background: var(--color-neutral-soft); color: var(--color-muted); border-radius: var(--radius-md); font-size: var(--font-size-caption); }
.diagnostic-step__name { display: grid; gap: var(--space-1); flex: 1; min-width: 0; }
.diagnostic-step__name small { color: var(--color-muted); font-size: var(--font-size-caption); }
.diagnostic-step__actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }
.diagnostic-step__chevron { color: var(--color-muted); flex-shrink: 0; transition: transform 150ms ease; }
.diagnostic-step--open .diagnostic-step__chevron { transform: rotate(90deg); }
.diagnostic-step--active .diagnostic-step__number { color: var(--color-blue); background: var(--color-blue-soft); }
.diagnostic-step__body { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--color-border-subtle); }
.diagnostic-context, .diagnostic-explanation { margin-top: var(--space-3); color: var(--color-text-secondary); font-size: var(--font-size-caption); overflow-wrap: anywhere; }
.diagnostic-issues { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
.diagnostic-issues li { display: flex; gap: var(--space-4); justify-content: space-between; align-items: flex-start; padding: var(--space-3) 0; }
.diagnostic-issues li + li { border-top: 1px solid var(--color-border-subtle); }
.diagnostic-issues p { color: var(--color-text-secondary); margin-top: var(--space-1); }
.diagnostic-issues small { display: block; margin-top: var(--space-1); color: var(--color-muted); }
.diagnostic-technical { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border-subtle); color: var(--color-text-secondary); font-size: var(--font-size-caption); }
.diagnostic-technical summary span { margin-left: var(--space-2); color: var(--color-muted); }
.diagnostic-table { overflow-x: auto; margin-top: var(--space-3); }
table { width: 100%; border-collapse: collapse; font-size: var(--font-size-caption); }
th, td { text-align: left; vertical-align: top; padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
td:first-child { max-width: 450px; } td:last-child { min-width: 230px; }
td p { color: var(--color-text-secondary); margin-top: var(--space-1); }
code { overflow-wrap: anywhere; }
.diagnostic-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2) var(--space-5); margin-top: var(--space-4); color: var(--color-muted); font-size: var(--font-size-caption); }
@keyframes diagnostic-pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .diagnostic-status__dot--busy { animation: none; } .diagnostic-step__chevron { transition: none; } }
@media (max-width: 850px) {
  .selector-diagnostics { padding: var(--space-4); }
  .diagnostic-toolbar { width: 100%; }
  .diagnostic-step__header { align-items: flex-start; flex-wrap: wrap; gap: var(--space-3); }
  .diagnostic-step__toggle { flex-basis: 100%; }
  .diagnostic-step__actions { margin-left: 42px; justify-content: flex-start; }
  .diagnostic-status { flex-wrap: wrap; }
  .diagnostic-status__count { margin-left: var(--space-5); }
}
@media (max-width: 540px) {
  .diagnostic-step__toggle { flex-wrap: wrap; }
  .diagnostic-step__name { flex-basis: calc(100% - 86px); }
  .diagnostic-step__toggle :deep(.status-badge) { order: 3; margin-left: 42px; }
}
</style>
