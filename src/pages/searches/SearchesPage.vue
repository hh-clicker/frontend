<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconAlertTriangle, IconArchive, IconBriefcase, IconCheck, IconExternalLink, IconPencil, IconPlus, IconRefresh, IconSearch } from '@tabler/icons-vue'
import { isMockMode } from '../../app/runtime'
import AppAlert from '../../components/ui/AppAlert.vue'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'
import AppButton from '../../components/ui/AppButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { usePageData } from '../../composables/usePageData'
import type { SearchDefinition, SearchStatus } from '../../api/contracts/searches'
import { archiveSearch, loadSearches, scanSearch } from '../../services/searches'
import { confirmArchiveSearch } from '../../services/dialogs'
import { applicationContextStore } from '../../services/applicationContext'
import { formatDateTime } from '../../utils/dateTime'

const route = useRoute()
const router = useRouter()
const selectedSearchId = ref<string | null>(null)
const busyIds = ref<string[]>([])
const createdNoticeVisible = ref(route.query.created === '1')
const actionError = ref<string | null>(null)
const mockProgress = ref<Record<string, number>>({})
const mockElapsedSeconds = ref<Record<string, number>>({})
const { data: searches, loading, error, refresh } = usePageData(async () => {
  const accountId = applicationContextStore.state.overview?.selectedAccountId
  const resumeId = applicationContextStore.state.overview?.selectedResumeId ?? null
  const result = await loadSearches(resumeId)
  return accountId === applicationContextStore.state.overview?.selectedAccountId
    && resumeId === applicationContextStore.state.overview?.selectedResumeId ? result : []
})

watch(() => applicationContextStore.state.overview?.selectedResumeId, () => { selectedSearchId.value = null; void refresh() })
watch(() => applicationContextStore.state.overview?.selectedAccountId, () => { selectedSearchId.value = null; searches.value = null })
watch(searches, (value) => {
  if (!value?.length) { selectedSearchId.value = null; return }
  if (!value.some((search) => search.id === selectedSearchId.value)) selectedSearchId.value = value[0]!.id
}, { immediate: true })

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let mockTimer: ReturnType<typeof setInterval> | undefined
let disposed = false
async function pollScans(): Promise<void> {
  if (disposed) return
  try {
    if (searches.value?.some((search) => search.status === 'SCANNING')) {
      await refresh()
      if (!disposed && !error.value && !searches.value?.some((search) => search.status === 'SCANNING')) await applicationContextStore.load(true)
    }
  } catch (cause) {
    if (!disposed) actionError.value = cause instanceof Error ? cause.message : 'Не удалось обновить состояние поиска'
  } finally {
    if (!disposed) refreshTimer = setTimeout(() => void pollScans(), 2500)
  }
}
onMounted(() => {
  refreshTimer = setTimeout(() => void pollScans(), 2500)
  if (isMockMode) mockTimer = setInterval(() => {
    const ids = new Set([...busyIds.value, ...(searches.value ?? []).filter((search) => search.status === 'SCANNING').map((search) => search.id)])
    ids.forEach((id) => {
      const search = searches.value?.find((item) => item.id === id)
      const limit = Math.max(1, search?.pagesLimit ?? 1)
      mockElapsedSeconds.value[id] = (mockElapsedSeconds.value[id] ?? 18) + 1
      mockProgress.value[id] = Math.min(limit, (mockProgress.value[id] ?? 1) + (mockElapsedSeconds.value[id]! % 3 === 0 ? 1 : 0))
    })
  }, 1000)
})
onUnmounted(() => { disposed = true; clearTimeout(refreshTimer); clearInterval(mockTimer) })

const selectedSearch = computed(() => searches.value?.find((search) => search.id === selectedSearchId.value) ?? null)
const isSelectedBusy = computed(() => !!selectedSearch.value && (selectedSearch.value.status === 'SCANNING' || busyIds.value.includes(selectedSearch.value.id)))
const statusPresentation: Partial<Record<SearchStatus, { label: string; tone: 'orange' | 'red' }>> = {
  SCANNING: { label: 'Сканируется', tone: 'orange' }, ERROR: { label: 'Ошибка', tone: 'red' },
}

function scanTotalPages(search: SearchDefinition): number {
  if (search.scanProgress?.totalPages) return search.scanProgress.totalPages
  const totalResults = search.totalVacancies || 421
  return Math.min(search.pagesLimit, Math.max(1, Math.ceil(totalResults / 100)))
}
function scanPage(search: SearchDefinition): number { return search.scanProgress?.currentPage || Math.min(scanTotalPages(search), mockProgress.value[search.id] ?? 2) }
function scanCollected(search: SearchDefinition): number { return search.scanProgress?.collected ?? Math.min(search.totalVacancies || 421, scanPage(search) * 100) }
function scanApproximateTotal(search: SearchDefinition): number | null { return search.scanProgress?.totalResults ?? (isMockMode ? search.totalVacancies || 421 : null) }
function scanProgress(search: SearchDefinition): number { return Math.round(scanPage(search) / scanTotalPages(search) * 100) }
function hasDetailedProgress(search: SearchDefinition): boolean { return isMockMode || (!!search.scanProgress?.currentPage && !!search.scanProgress?.totalPages) }
function elapsedLabel(search: SearchDefinition): string {
  const startedAt = search.scanProgress?.startedAt ? new Date(search.scanProgress.startedAt).getTime() : Number.NaN
  const seconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : mockElapsedSeconds.value[search.id] ?? 48
  return seconds < 60 ? `${seconds} сек.` : `${Math.floor(seconds / 60)} мин ${seconds % 60} сек.`
}

async function runScan(search: SearchDefinition): Promise<void> {
  if (busyIds.value.includes(search.id) || search.status === 'SCANNING') return
  actionError.value = null
  selectedSearchId.value = search.id
  busyIds.value = [...busyIds.value, search.id]
  mockProgress.value[search.id] = 1
  mockElapsedSeconds.value[search.id] = 18
  try {
    const request = scanSearch(search.id)
    const updated = isMockMode ? (await Promise.all([request, new Promise((resolve) => window.setTimeout(resolve, 6500))]))[0] : await request
    replaceSearch(updated)
    await applicationContextStore.load(true)
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Не удалось запустить сканирование'
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== search.id)
  }
}
function editSearch(search: SearchDefinition): void {
  if (search.status === 'SCANNING' || busyIds.value.includes(search.id)) return
  void router.push({ name: 'search-edit', params: { searchId: search.id } })
}
async function archive(search: SearchDefinition): Promise<void> {
  if (!await confirmArchiveSearch(search.name)) return
  actionError.value = null
  try {
    await archiveSearch(search.id)
    searches.value = (searches.value ?? []).filter((item) => item.id !== search.id)
    await applicationContextStore.load(true)
  } catch (cause) { actionError.value = cause instanceof Error ? cause.message : 'Не удалось архивировать поиск' }
}
function replaceSearch(updated: SearchDefinition): void { searches.value = (searches.value ?? []).map((item) => item.id === updated.id ? updated : item) }
</script>

<template>
  <PageSkeleton v-if="loading && !searches" />
  <section v-else-if="error && !searches" class="page-error">
    <IconSearch :size="34" /><h1>Не удалось загрузить поиски</h1><p>{{ error }}</p><AppButton variant="primary" @click="refresh">Повторить</AppButton>
  </section>
  <div v-else class="searches-page">
    <header class="page-header">
      <div><h1>Поиски</h1><p>Сохранённые ссылки HH и результаты их сканирования.</p></div>
      <RouterLink to="/searches/new"><AppButton variant="primary"><IconPlus :size="18" /> Добавить поиск</AppButton></RouterLink>
    </header>
    <AppAlert v-if="createdNoticeVisible" tone="info" dismissible @dismiss="createdNoticeVisible = false"><strong>Поиск сохранён.</strong> Запустите первое сканирование, чтобы собрать вакансии.</AppAlert>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null"><strong>Операция не выполнена.</strong> {{ actionError }}</AppAlert>

    <div v-if="searches?.length" class="searches-layout">
      <aside class="search-history-card">
        <header><h2>Поиски</h2><span>{{ searches.length }}</span></header>
        <button v-for="search in searches" :key="search.id" class="search-history-item" :class="{ 'search-history-item--active': search.id === selectedSearchId }" type="button" @click="selectedSearchId = search.id">
          <span class="search-history-item__top">
            <strong>{{ search.name }}</strong>
          </span>
          <span>{{ search.resumeName }}</span>
          <small v-if="search.status === 'SCANNING' || busyIds.includes(search.id)">{{ hasDetailedProgress(search) ? `Страница ${scanPage(search)} из ${scanTotalPages(search)}` : 'Подготовка первой страницы' }}</small>
          <small v-else>{{ formatDateTime(search.lastScannedAt) ?? 'Ещё не сканировался' }}</small>
          <small v-if="search.lastScannedAt && search.status !== 'SCANNING'">Новых за последний скан: {{ search.newVacancies }}</small>
        </button>
      </aside>

      <main v-if="selectedSearch" class="search-detail-card">
        <header class="search-detail-header">
          <div><span class="search-detail-eyebrow">Сохранённый поиск</span><h2>{{ selectedSearch.name }}</h2><p>{{ selectedSearch.resumeName }} · до {{ selectedSearch.pagesLimit }} страниц</p></div>
          <StatusBadge v-if="statusPresentation[selectedSearch.status]" :label="statusPresentation[selectedSearch.status]!.label" :tone="statusPresentation[selectedSearch.status]!.tone" />
        </header>
        <div class="search-detail-actions">
          <AppButton variant="primary" :loading="isSelectedBusy" :disabled="isSelectedBusy" @click="runScan(selectedSearch)">
            <IconRefresh v-if="!isSelectedBusy" :size="18" />{{ isSelectedBusy ? 'Сканирование…' : selectedSearch.status === 'ERROR' ? 'Повторить сканирование' : 'Сканировать' }}
          </AppButton>
          <RouterLink class="app-button app-button--secondary app-button--medium" :to="{ name: 'vacancies', query: { searchId: selectedSearch.id } }"><IconBriefcase :size="18" /> Вакансии</RouterLink>
          <span class="search-detail-actions__spacer" />
          <HhExternalLink class="table-action" :href="selectedSearch.sourceUrl" title="Открыть поиск на HH" aria-label="Открыть поиск на HH"><IconExternalLink :size="18" /></HhExternalLink>
          <button class="table-action" type="button" :disabled="isSelectedBusy" title="Редактировать поиск" aria-label="Редактировать поиск" @click="editSearch(selectedSearch)"><IconPencil :size="18" /></button>
          <button class="table-action table-action--danger" type="button" :disabled="isSelectedBusy" title="Архивировать" aria-label="Архивировать" @click="archive(selectedSearch)"><IconArchive :size="18" /></button>
        </div>

        <section v-if="isSelectedBusy" class="search-scan-state search-scan-state--running">
          <div class="search-scan-state__heading"><div><strong>Сканирование выдачи HH</strong><span>Browser Agent загружает и разбирает текущую страницу.</span></div><StatusBadge label="В работе" tone="orange" /></div>
          <div class="search-scan-progress__labels">
            <span v-if="hasDetailedProgress(selectedSearch)">Страница {{ scanPage(selectedSearch) }} из {{ scanTotalPages(selectedSearch) }}</span>
            <span v-else>Подготовка первой страницы</span>
            <strong v-if="hasDetailedProgress(selectedSearch)">Собрано {{ scanCollected(selectedSearch) }}<template v-if="scanApproximateTotal(selectedSearch) !== null"> из примерно {{ scanApproximateTotal(selectedSearch) }}</template></strong>
          </div>
          <div class="search-scan-progress__track"><span :class="{ 'search-scan-progress__value--indeterminate': !hasDetailedProgress(selectedSearch) }" :style="hasDetailedProgress(selectedSearch) ? { width: `${scanProgress(selectedSearch)}%` } : undefined" /></div>
          <small>Прошло {{ elapsedLabel(selectedSearch) }} Можно уйти со страницы — сканирование продолжится.</small>
        </section>
        <AppAlert v-else-if="selectedSearch.status === 'ERROR'" tone="warning" class="search-scan-error">
          <div class="search-scan-error__content"><IconAlertTriangle :size="20" /><div><strong>Не удалось завершить сканирование</strong><span>{{ selectedSearch.lastError }}</span><small>Предыдущие результаты не изменены.</small></div></div>
        </AppAlert>
        <section v-else-if="selectedSearch.lastScannedAt" class="search-last-result"><IconCheck :size="20" /><div><strong>Последнее сканирование завершено</strong><span>{{ formatDateTime(selectedSearch.lastScannedAt) }}</span></div></section>
        <section v-else class="search-last-result search-last-result--empty"><IconSearch :size="20" /><div><strong>Поиск ещё не сканировался</strong><span>Запустите сбор, чтобы получить первые вакансии.</span></div></section>

        <section class="search-kpis" aria-label="Результаты поиска">
          <div><span>За последний скан</span><strong>{{ selectedSearch.lastScannedAt ? selectedSearch.newVacancies : '—' }}</strong></div>
          <div><span>Всего вакансий</span><strong>{{ selectedSearch.totalVacancies }}</strong></div>
          <div><span>Последнее сканирование</span><strong class="search-kpi-date">{{ formatDateTime(selectedSearch.lastScannedAt) ?? 'Не запускался' }}</strong></div>
        </section>
      </main>
    </div>
    <EmptyState v-else title="Сохранённых поисков пока нет" description="Добавьте ссылку поиска HH со всеми нужными фильтрами. Отклики автоматически не запускаются.">
      <RouterLink to="/searches/new"><AppButton variant="primary"><IconPlus :size="18" /> Добавить поиск</AppButton></RouterLink>
    </EmptyState>
  </div>
</template>
