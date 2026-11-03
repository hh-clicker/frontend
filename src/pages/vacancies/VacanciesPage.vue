<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconStar, IconExternalLink, IconBan, IconBookmark, IconCheck, IconChevronLeft, IconChevronRight, IconInfoCircle, IconPlayerPlay, IconSearch, IconSparkles, IconX } from '@tabler/icons-vue'
import type { CompanyBanScope, Vacancy, VacancyEnrichment, VacancyRelevanceCategory, VacancyStatus } from '../../api/contracts/vacancies'
import type { ApplicationRunSettings } from '../../api/contracts/applications'
import type { ResumeAutomationSettings } from '../../api/contracts/resumes'
import ApplicationLaunchDialog from '../../components/applications/ApplicationLaunchDialog.vue'
import VacancyDescription from '../../components/vacancies/VacancyDescription.vue'
import VacancyEnrichmentPreview from '../../components/vacancies/VacancyEnrichmentPreview.vue'
import type { VacancyEnrichmentPreviewData } from '../../components/vacancies/vacancyEnrichmentPreview'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'
import { loadSearches } from '../../services/searches'
import { loadVacancyFavorites, setVacancyFavorite } from '../../services/vacancyFavorites'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppCheckbox from '../../components/ui/AppCheckbox.vue'
import AppMultiSelect from '../../components/ui/AppMultiSelect.vue'
import AppSelect, { type AppSelectOption, type AppSelectValue } from '../../components/ui/AppSelect.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { usePageData } from '../../composables/usePageData'
import { chooseCompanyBanScope } from '../../services/dialogs'
import { startApplicationRun } from '../../services/applications'
import { applicationContextStore } from '../../services/applicationContext'
import { analyzeVacancyRelevance, banVacancyCompany, followActiveVacancyRelevance, isSelectable, loadVacancies, restoreVacancy, setManyVacanciesQueued, setVacancyQueued, skipVacancy, verifyQuestionnaireVacancyApplied, type VacancyRelevanceProgress } from '../../services/vacancies'
import { loadResumes } from '../../services/resumes'

type VacancyFilter = 'FAVORITES' | 'ALL' | 'NEW' | 'QUEUED' | 'USER_SKIPPED' | 'COMPANY_BANNED' | 'ALREADY_APPLIED'
type SortOrder = 'RELEVANCE' | 'HH' | 'NEWEST' | 'OLDEST' | 'SALARY_DESC' | 'SALARY_ASC' | 'COMPANY'
type RelevanceFilter = VacancyRelevanceCategory | 'UNRATED'
type TraitFilterKey = 'questionnaire' | 'letter' | 'internship' | 'itEmployer'
type TraitFilterState = 'ANY' | 'YES' | 'NO'

const formatLabels: Record<string, string> = { REMOTE: 'Удалённо', ON_SITE: 'Офис', HYBRID: 'Гибрид', FIELD_WORK: 'Разъездная работа' }
const employmentLabels: Record<string, string> = { FULL: 'Полная занятость', PART: 'Частичная занятость', PROJECT: 'Проектная работа', FLY_IN_FLY_OUT: 'Вахта' }
const scheduleLabels: Record<string, string> = { FIVE_ON_TWO_OFF: '5/2', SIX_ON_ONE_OFF: '6/1', TWO_ON_TWO_OFF: '2/2', THREE_ON_THREE_OFF: '3/3', FOUR_ON_THREE_OFF: '4/3', FLEXIBLE: 'Гибкий график', WEEKEND: 'По выходным', OTHER: 'Другой' }
const hourLabels: Record<string, string> = { FLEXIBLE: 'Гибко', OTHER: 'Другое' }
const contractLabels: Record<string, string> = { SELF_EMPLOYED: 'Самозанятый', INDIVIDUAL_ENTREPRENEUR: 'ИП', INDIVIDUAL_PERSON: 'Физлицо' }
const inclusivenessLabels: Record<string, string> = { MOBILITY: 'Нарушения опорно-двигательного аппарата', CHRONIC_DISEASES: 'Хронические заболевания' }
const languageLabels: Record<string, string> = { rus: 'Русский', eng: 'Английский' }
const salaryModeLabels: Record<string, string> = { MONTH: 'за месяц', HOUR: 'за час', SHIFT: 'за смену', FLY_IN_FLY_OUT: 'за вахту', SERVICE: 'за услугу' }
const salaryFrequencyLabels: Record<string, string> = { DAILY: 'Ежедневно', WEEKLY: 'Еженедельно', TWICE_PER_MONTH: 'Дважды в месяц', MONTHLY: 'Ежемесячно', PER_PROJECT: 'За проект' }
const yesNo = (value: boolean | null): string => value === null ? 'Не указано' : value ? 'Да' : 'Нет'
const values = (items: string[], labels: Record<string, string> = {}): string => items.length ? items.map((item) => labels[item] ?? item).join(' · ') : 'Не указано'
const hours = (items: string[]): string => values(items.map((item) => item.startsWith('HOURS_') ? `${item.slice(6)} ч.` : hourLabels[item] ?? item))
function externalHttpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}

const route = useRoute()
const router = useRouter()
const searchId = computed(() => typeof route.query.searchId === 'string' ? route.query.searchId : null)
const activeFilter = ref<VacancyFilter>('NEW')
const query = ref('')
const favoriteBusy = ref(false)
const verifyingQuestionnaireVacancyId = ref<string | null>(null)
const questionnaireVerificationError = ref<{ vacancyId: string; message: string } | null>(null)
const { data: favorites, error: favoritesError, refresh: refreshFavorites } = usePageData(
  () => loadVacancyFavorites(applicationContextStore.state.overview?.selectedAccountId),
)
const { data: sourceSearches, refresh: refreshSearches } = usePageData(
  () => loadSearches(applicationContextStore.state.overview?.selectedResumeId ?? null),
)
watch(() => applicationContextStore.state.overview?.selectedAccountId, () => {
  vacancies.value = null
  sourceSearches.value = null
  selectedVacancyId.value = null
  launchDialogOpen.value = false
  clearMarks()
  void refreshFavorites()
})
const currentFavorites = computed(() => favorites.value?.accountId === applicationContextStore.state.overview?.selectedAccountId ? favorites.value : null)
function isFavorite(vacancy: Vacancy, employer = false): boolean {
  return employer ? !!vacancy.company.id && !!currentFavorites.value?.employerIds.includes(vacancy.company.id)
    : !!currentFavorites.value?.vacancyIds.includes(vacancy.hhVacancyId)
}
async function toggleFavorite(vacancy: Vacancy, employer = false): Promise<void> {
  if (favoriteBusy.value || !currentFavorites.value || favoritesError.value) return
  if (vacancy.resumeId !== applicationContextStore.state.overview?.selectedResumeId) return
  const accountId = currentFavorites.value.accountId
  favoriteBusy.value = true
  actionError.value = null
  try {
    const result = await setVacancyFavorite(vacancy.id, employer, !isFavorite(vacancy, employer))
    if (accountId === applicationContextStore.state.overview?.selectedAccountId) favorites.value = result
  } catch (cause) { setActionError(cause, 'Не удалось изменить избранное') }
  finally { favoriteBusy.value = false }
}
const salaryFilter = ref<AppSelectValue | null>('ANY')
const companyFilter = ref<AppSelectValue | null>('ANY')
const relevanceFilter = ref<AppSelectValue[]>([])
const traitFilters = ref<Record<TraitFilterKey, TraitFilterState>>({ questionnaire: 'ANY', letter: 'ANY', internship: 'ANY', itEmployer: 'ANY' })
const sortOrder = ref<AppSelectValue | null>(searchId.value ? 'HH' : 'NEWEST')
const pageSize = ref<AppSelectValue | null>(10)
const currentPage = ref(1)
const markedIds = ref(new Set<string>())
const selectedVacancyId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const busy = ref(false)
const relevanceBusy = ref(false)
const relevanceProgress = ref<VacancyRelevanceProgress | null>(null)
const launchDialogOpen = ref(false)
const launchRequestId = ref(crypto.randomUUID())
watch(launchDialogOpen, (open) => {
  if (open) { launchRequestId.value = crypto.randomUUID(); void applicationContextStore.load(true) }
})
const launchSubmitting = ref(false)
const launchDefaults = ref<ResumeAutomationSettings | null>(null)
const { data: vacancies, loading, error, refresh } = usePageData(async () => {
  const accountId = applicationContextStore.state.overview?.selectedAccountId
  const resumeId = applicationContextStore.state.overview?.selectedResumeId
  if (!accountId || !resumeId) return []
  const result = await loadVacancies(searchId.value, resumeId)
  if (accountId !== applicationContextStore.state.overview?.selectedAccountId
      || resumeId !== applicationContextStore.state.overview?.selectedResumeId) return []
  return result.filter((vacancy) => vacancy.resumeId === resumeId)
})
function enrichmentFor(vacancy: Vacancy): VacancyEnrichment | null { return vacancy.enrichment ?? null }
watch(() => applicationContextStore.state.overview?.selectedResumeId, async (resumeId, previousResumeId) => {
  vacancies.value = null
  selectedVacancyId.value = null
  clearMarks()
  companyFilter.value = 'ANY'
  launchDialogOpen.value = false
  // Initial context hydration is not a resume switch: keep deep links on reload.
  if (previousResumeId !== undefined && searchId.value) {
    const scenario = typeof route.query.scenario === 'string' ? route.query.scenario : undefined
    await router.replace({ path: '/vacancies', query: { ...(scenario ? { scenario } : {}) } })
  }
  selectedVacancyId.value = null; clearMarks(); void refresh()
  void loadLaunchDefaults(); void refreshSearches()
  if (resumeId) void restoreRelevanceRun(resumeId)
})

async function loadLaunchDefaults(): Promise<void> {
  try {
    const resumeId = applicationContextStore.state.overview?.selectedResumeId
    const response = await loadResumes(applicationContextStore.state.overview?.selectedAccountId)
    launchDefaults.value = response.items.find((resume) => resume.id === resumeId)?.settings ?? null
  } catch { launchDefaults.value = null }
}
onMounted(() => {
  void loadLaunchDefaults()
  const resumeId = applicationContextStore.state.overview?.selectedResumeId
  if (resumeId) void restoreRelevanceRun(resumeId)
})

const filters: Array<{ value: VacancyFilter; label: string }> = [
  { value: 'ALL', label: 'Все' }, { value: 'NEW', label: 'Новые' }, { value: 'FAVORITES', label: 'Избранные' }, { value: 'QUEUED', label: 'К отклику' },
  { value: 'USER_SKIPPED', label: 'Пропущенные' }, { value: 'COMPANY_BANNED', label: 'Заблокированные' },
  { value: 'ALREADY_APPLIED', label: 'Откликнулись' },
]
const salaryOptions: AppSelectOption[] = [
  { value: 'ANY', label: 'Любая' }, { value: 100000, label: 'от 100 000 ₽' },
  { value: 150000, label: 'от 150 000 ₽' }, { value: 200000, label: 'от 200 000 ₽' }, { value: 250000, label: 'от 250 000 ₽' },
]
const sortOptions: AppSelectOption[] = [
  { value: 'RELEVANCE', label: 'По релевантности' }, { value: 'HH', label: 'Порядок HH' }, { value: 'NEWEST', label: 'Сначала новые' },
  { value: 'OLDEST', label: 'Сначала старые' }, { value: 'SALARY_DESC', label: 'ЗП: по убыванию' },
  { value: 'SALARY_ASC', label: 'ЗП: по возрастанию' }, { value: 'COMPANY', label: 'Компания: А–Я' },
]
const relevanceOptions: AppSelectOption[] = [
  { value: 'TARGET', label: 'Цель' }, { value: 'ADJACENT', label: 'Смежные' },
  { value: 'UNKNOWN', label: 'Проверить' }, { value: 'NOISE', label: 'Мимо' },
  { value: 'UNRATED', label: 'Без оценки' },
]
const traitFilterOptions: Array<{ key: TraitFilterKey; label: string }> = [
  { key: 'questionnaire', label: 'Анкета' }, { key: 'letter', label: 'Письмо' },
  { key: 'internship', label: 'Стажировка' }, { key: 'itEmployer', label: 'IT' },
]
const pageSizeOptions: AppSelectOption[] = [{ value: 10, label: '10' }, { value: 25, label: '25' }, { value: 50, label: '50' }, { value: 100, label: '100' }]
const companyOptions = computed<AppSelectOption[]>(() => [
  { value: 'ANY', label: 'Все компании' },
  ...[...new Map((vacancies.value ?? []).filter((vacancy) => vacancy.company.id !== null).map((vacancy) => [vacancy.company.id!, vacancy.company.name])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], 'ru')).map(([value, label]) => ({ value, label })),
])

const filterCounts = computed<Record<VacancyFilter, number>>(() => {
  const items = vacancies.value ?? []
  return {
    FAVORITES: items.filter((item) => isFavorite(item)).length,
    ALL: items.length, NEW: items.filter((item) => item.status === 'NEW').length,
    QUEUED: items.filter((item) => item.queuedForApplication).length,
    USER_SKIPPED: items.filter((item) => item.status === 'USER_SKIPPED').length,
    COMPANY_BANNED: items.filter((item) => item.status === 'COMPANY_BANNED').length,
    ALREADY_APPLIED: items.filter((item) => item.status === 'ALREADY_APPLIED').length,
  }
})
const filteredVacancies = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  const minimumSalary = typeof salaryFilter.value === 'number' ? salaryFilter.value : null
  return (vacancies.value ?? []).filter((vacancy) => {
    const statusMatches = activeFilter.value === 'ALL' || (activeFilter.value === 'FAVORITES' ? isFavorite(vacancy) : activeFilter.value === 'QUEUED' ? vacancy.queuedForApplication : vacancy.status === activeFilter.value)
    const textMatches = !needle || vacancy.title.toLocaleLowerCase('ru').includes(needle) || vacancy.company.name.toLocaleLowerCase('ru').includes(needle) || vacancy.labels.some((skill) => skill.toLocaleLowerCase('ru').includes(needle))
    const selectedRelevance = relevanceFilter.value as RelevanceFilter[]
    const relevanceMatches = !selectedRelevance.length || selectedRelevance.some((filter) => (
      filter === 'UNRATED' ? !vacancy.relevance : vacancy.relevance?.category === filter
    ))
    const traitsMatch = matchesTraitFilter(questionnaireFor(vacancy), traitFilters.value.questionnaire)
      && matchesTraitFilter(enrichmentFor(vacancy)?.responseLetterRequired ?? null, traitFilters.value.letter)
      && matchesTraitFilter(enrichmentFor(vacancy)?.internship ?? null, traitFilters.value.internship)
      && matchesTraitFilter(enrichmentFor(vacancy)?.accreditedItEmployer ?? null, traitFilters.value.itEmployer)
    return statusMatches && textMatches
      && relevanceMatches
      && traitsMatch
      && (minimumSalary === null || (vacancy.salary?.currency === 'RUR' && (vacancy.salary.to ?? vacancy.salary.from ?? 0) >= minimumSalary))
      && (companyFilter.value === 'ANY' || vacancy.company.id === companyFilter.value)
  })
})
const sortedVacancies = computed(() => {
  const items = [...filteredVacancies.value]
  const order = sortOrder.value as SortOrder
  if (order === 'RELEVANCE') {
    const rank: Record<VacancyRelevanceCategory, number> = { TARGET: 0, ADJACENT: 1, UNKNOWN: 2, NOISE: 3 }
    return items.sort((a, b) => (a.relevance ? rank[a.relevance.category] : 4) - (b.relevance ? rank[b.relevance.category] : 4))
  }
  if (order === 'NEWEST' || order === 'OLDEST') {
    const direction = order === 'NEWEST' ? -1 : 1
    return items.sort((a, b) => {
      const left = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN
      const right = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN
      const leftMissing = !Number.isFinite(left)
      const rightMissing = !Number.isFinite(right)
      if (leftMissing && rightMissing) return 0
      if (leftMissing) return 1
      if (rightMissing) return -1
      return (left - right) * direction
    })
  }
  if (order === 'COMPANY') return items.sort((a, b) => a.company.name.localeCompare(b.company.name, 'ru'))
  if (order === 'SALARY_DESC' || order === 'SALARY_ASC') {
    const direction = order === 'SALARY_DESC' ? -1 : 1
    return items.sort((a, b) => {
      const left = a.salary?.currency === 'RUR' ? a.salary.to ?? a.salary.from : null
      const right = b.salary?.currency === 'RUR' ? b.salary.to ?? b.salary.from : null
      if (left == null && right == null) return 0
      if (left == null) return 1
      if (right == null) return -1
      return (left - right) * direction
    })
  }
  return items
})
watch(searchId, () => { selectedVacancyId.value = null; currentPage.value = 1; sortOrder.value = searchId.value ? 'HH' : 'NEWEST'; clearMarks(); void refresh() })
const numericPageSize = computed(() => typeof pageSize.value === 'number' ? pageSize.value : 10)
const totalPages = computed(() => Math.max(1, Math.ceil(sortedVacancies.value.length / numericPageSize.value)))
const paginationItems = computed<Array<number | 'gap-start' | 'gap-end'>>(() => {
  const total = totalPages.value
  const current = Math.min(currentPage.value, total)
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap-end', total]
  if (current >= total - 3) return [1, 'gap-start', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', total]
})
watch(() => sortedVacancies.value.length, () => { currentPage.value = Math.min(currentPage.value, totalPages.value) })
const paginatedVacancies = computed(() => sortedVacancies.value.slice((currentPage.value - 1) * numericPageSize.value, currentPage.value * numericPageSize.value))
const pageStart = computed(() => sortedVacancies.value.length ? (currentPage.value - 1) * numericPageSize.value + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * numericPageSize.value, sortedVacancies.value.length))
const queueCount = computed(() => filterCounts.value.QUEUED)
const dailyLimitRemaining = computed(() => applicationContextStore.state.overview?.metrics.find((metric) => metric.id === 'limit')?.value ?? 500)
const queuedVacancies = computed(() => (vacancies.value ?? []).filter((item) => item.queuedForApplication))
const queuedQuestionnaireCount = computed(() => queuedVacancies.value.filter((item) => item.hasQuestionnaire).length)
const queuedUnconfirmedCount = computed(() => queuedVacancies.value.filter((item) => item.hasUnconfirmedApplication).length)
const markedVacancies = computed(() => (vacancies.value ?? []).filter((item) => markedIds.value.has(item.id)))
const markablePageVacancies = computed(() => paginatedVacancies.value.filter(isMarkable))
const allPageMarked = computed(() => markablePageVacancies.value.length > 0 && markablePageVacancies.value.every((item) => markedIds.value.has(item.id)))
const statusPresentation: Record<VacancyStatus, { label: string; tone: 'purple' | 'blue' | 'neutral' | 'red' }> = {
  NEW: { label: 'Новая', tone: 'purple' }, USER_SKIPPED: { label: 'Пропущена', tone: 'neutral' },
  COMPANY_BANNED: { label: 'Компания заблокирована', tone: 'red' }, ALREADY_APPLIED: { label: 'Уже откликнулись', tone: 'blue' },
  CLOSED: { label: 'Закрыта', tone: 'neutral' },
}

watch([activeFilter, query, salaryFilter, companyFilter, relevanceFilter, sortOrder, pageSize, () => Object.values(traitFilters.value)], () => { currentPage.value = 1; clearMarks() })
function isMarkable(vacancy: Vacancy): boolean { return !['COMPANY_BANNED', 'ALREADY_APPLIED', 'CLOSED'].includes(vacancy.status) }
function questionnaireFor(vacancy: Vacancy): boolean | null {
  const enriched = enrichmentFor(vacancy)?.userTestPresent
  if (vacancy.hasQuestionnaire === true || enriched === true) return true
  if (vacancy.hasQuestionnaire === false || enriched === false) return false
  return null
}
function matchesTraitFilter(value: boolean | null, state: TraitFilterState): boolean {
  return state === 'ANY' || (state === 'YES' ? value === true : value !== true)
}
function cycleTraitFilter(key: TraitFilterKey): void {
  const current = traitFilters.value[key]
  traitFilters.value[key] = current === 'ANY' ? 'YES' : current === 'YES' ? 'NO' : 'ANY'
}
function traitFilterTitle(key: TraitFilterKey, label: string): string {
  const state = traitFilters.value[key]
  return state === 'ANY' ? `${label}: не учитывать` : state === 'YES' ? `${label}: только вакансии с признаком` : `${label}: только вакансии без признака`
}
function queueBlockReason(vacancy: Vacancy): string | null {
  if (questionnaireFor(vacancy)) return 'Автоотклик недоступен: требуется анкета'
  if (enrichmentFor(vacancy)?.responseLetterRequired && !launchDefaults.value?.aiLetter?.enabled && !launchDefaults.value?.coverLetter.trim()) {
    return 'Автоотклик недоступен: настройте генерацию или резервное письмо'
  }
  return null
}
function canQueue(vacancy: Vacancy): boolean { return isSelectable(vacancy) && !queueBlockReason(vacancy) }
function filterLabel(filter: VacancyFilter): string { return `${filters.find((item) => item.value === filter)?.label ?? filter} · ${filterCounts.value[filter]}` }
function toggleMark(vacancy: Vacancy, marked: boolean): void { const next = new Set(markedIds.value); marked ? next.add(vacancy.id) : next.delete(vacancy.id); markedIds.value = next }
function togglePageMarks(marked: boolean): void { const next = new Set(markedIds.value); markablePageVacancies.value.forEach((item) => marked ? next.add(item.id) : next.delete(item.id)); markedIds.value = next }
function clearMarks(): void { markedIds.value = new Set() }
const relevanceSummary = computed(() => {
  const items = vacancies.value ?? []
  const count = (category: VacancyRelevanceCategory) => items.filter((item) => item.relevance?.category === category).length
  return {
    rated: items.filter((item) => item.relevance).length,
    total: items.length,
    target: count('TARGET'), adjacent: count('ADJACENT'), unknown: count('UNKNOWN'), noise: count('NOISE'),
  }
})
const relevancePresentation: Record<VacancyRelevanceCategory, { label: string; tone: 'green' | 'blue' | 'orange' | 'neutral' }> = {
  TARGET: { label: 'Цель', tone: 'green' }, ADJACENT: { label: 'Смежная', tone: 'blue' },
  UNKNOWN: { label: 'Проверить', tone: 'orange' }, NOISE: { label: 'Мимо', tone: 'neutral' },
}
async function analyzeRelevance(): Promise<void> {
  if (relevanceBusy.value || !vacancies.value?.length) return
  const resumeId = applicationContextStore.state.overview?.selectedResumeId
  if (!resumeId) return
  relevanceBusy.value = true
  const pendingVacancies = vacancies.value.filter((item) => !item.relevance)
  const initialProgress = { evaluated: relevanceSummary.value.rated, total: relevanceSummary.value.total }
  relevanceProgress.value = initialProgress
  actionError.value = null
  try {
    await analyzeVacancyRelevance(resumeId, pendingVacancies, initialProgress, reportRelevanceProgress)
    await refresh()
    sortOrder.value = 'RELEVANCE'
  } catch (cause) { setActionError(cause, 'Не удалось оценить релевантность') }
  finally { relevanceBusy.value = false; relevanceProgress.value = null }
}
async function restoreRelevanceRun(resumeId: string): Promise<void> {
  relevanceBusy.value = true
  try {
    await refresh()
    const initialProgress = { evaluated: relevanceSummary.value.rated, total: relevanceSummary.value.total }
    relevanceProgress.value = initialProgress
    const followed = await followActiveVacancyRelevance(resumeId, initialProgress, reportRelevanceProgress)
    if (applicationContextStore.state.overview?.selectedResumeId === resumeId) {
      // The status check itself may finalize and persist a job, so reload even when it answers with 204.
      await refresh()
      if (followed) sortOrder.value = 'RELEVANCE'
    }
  } catch (cause) {
    if (applicationContextStore.state.overview?.selectedResumeId === resumeId) setActionError(cause, 'Не удалось получить результат оценки')
  } finally {
    if (applicationContextStore.state.overview?.selectedResumeId === resumeId) {
      relevanceBusy.value = false
      relevanceProgress.value = null
    }
  }
}
function reportRelevanceProgress(progress: VacancyRelevanceProgress): void {
  relevanceProgress.value = progress
  void refresh()
}
function goToPage(page: number): void { currentPage.value = Math.min(Math.max(page, 1), totalPages.value); clearMarks() }
async function queue(vacancy: Vacancy, queued: boolean): Promise<void> { actionError.value = null; try { replaceVacancy(await setVacancyQueued(vacancy.id, queued)) } catch (cause) { setActionError(cause, 'Не удалось изменить очередь отклика') } }
const queueableMarkedVacancies = computed(() => markedVacancies.value.filter(canQueue))
async function queueMarked(queued: boolean): Promise<void> {
  const selected = queued ? queueableMarkedVacancies.value : markedVacancies.value.filter(isSelectable)
  if (!selected.length) return
  await runBulkAction(() => setManyVacanciesQueued(selected.map((item) => item.id), queued), 'Не удалось изменить очередь отклика')
}
async function skip(vacancy: Vacancy): Promise<void> { actionError.value = null; try { replaceVacancy(await skipVacancy(vacancy.id)) } catch (cause) { setActionError(cause, 'Не удалось пропустить вакансию') } }
async function skipMarked(): Promise<void> { await runBulkAction(() => Promise.all(markedVacancies.value.filter(isSelectable).map((item) => skipVacancy(item.id))), 'Не удалось пропустить отмеченные вакансии') }
async function restore(vacancy: Vacancy): Promise<void> { actionError.value = null; try { replaceVacancy(await restoreVacancy(vacancy.id)) } catch (cause) { setActionError(cause, 'Не удалось вернуть вакансию') } }
async function markQuestionnaireApplied(vacancy: Vacancy): Promise<void> {
  if (verifyingQuestionnaireVacancyId.value) return
  verifyingQuestionnaireVacancyId.value = vacancy.id
  questionnaireVerificationError.value = null
  try {
    replaceVacancy(await verifyQuestionnaireVacancyApplied(vacancy.id))
  } catch (cause) {
    questionnaireVerificationError.value = {
      vacancyId: vacancy.id,
      message: cause instanceof Error ? cause.message : 'Не удалось проверить отклик на HH.',
    }
  } finally {
    verifyingQuestionnaireVacancyId.value = null
  }
}
async function restoreMarked(): Promise<void> { await runBulkAction(() => Promise.all(markedVacancies.value.filter((item) => item.status === 'USER_SKIPPED').map((item) => restoreVacancy(item.id))), 'Не удалось вернуть отмеченные вакансии') }
async function runBulkAction(action: () => Promise<Vacancy[]>, fallback: string): Promise<void> { if (!markedVacancies.value.length) return; busy.value = true; actionError.value = null; try { replaceVacancies(await action()); clearMarks() } catch (cause) { setActionError(cause, fallback) } finally { busy.value = false } }
async function banCompany(vacancy: Vacancy): Promise<void> { if (!vacancy.company.id) return; const scope = await chooseCompanyBanScope(vacancy.company.name); if (!scope) return; actionError.value = null; try { replaceVacancies(await banVacancyCompany(vacancy.id, scope as CompanyBanScope)); clearMarks() } catch (cause) { setActionError(cause, 'Не удалось заблокировать компанию') } }
async function launchApplications(settings: ApplicationRunSettings): Promise<void> {
  if (launchSubmitting.value) return
  launchSubmitting.value = true
  actionError.value = null
  const vacancyIds = queuedVacancies.value.slice(0, settings.dailyLimit).map((item) => item.id)
  try {
    const resumeId = applicationContextStore.state.overview?.selectedResumeId
    if (!resumeId) throw new Error('Выберите резюме для запуска.')
    const run = await startApplicationRun({ ...settings, vacancyIds, resumeId, requestId: launchRequestId.value })
    if (applicationContextStore.state.overview?.selectedResumeId !== resumeId) {
      actionError.value = `Запуск для резюме «${run.resumeName}» создан. Чтобы видеть его результаты, выберите это резюме.`
      return
    }
    if (run.status === 'RUNNING') applicationContextStore.setActiveRun({ id: run.id, sequence: run.sequence, status: 'RUNNING', processed: 0, total: run.applications.length, succeeded: 0, attention: run.applications.filter((item) => item.status === 'ATTENTION_REQUIRED').length, failed: 0 })
    launchDialogOpen.value = false
    void applicationContextStore.load(true)
    const scenario = typeof route.query.scenario === 'string' ? route.query.scenario : undefined
    await router.push({ path: '/applications', query: { ...(scenario ? { scenario } : {}), runId: run.id } })
  } catch (cause) {
    setActionError(cause, settings.mode === 'DRY_RUN' ? 'Не удалось запустить загрузку текстов' : 'Не удалось запустить отклики')
  } finally {
    launchSubmitting.value = false
  }
}
function replaceVacancy(updated: Vacancy): void { vacancies.value = (vacancies.value ?? []).map((item) => item.id === updated.id ? updated : item) }
function replaceVacancies(updated: Vacancy[]): void { const byId = new Map(updated.map((item) => [item.id, item])); vacancies.value = (vacancies.value ?? []).map((item) => byId.get(item.id) ?? item) }
function setActionError(cause: unknown, fallback: string): void { actionError.value = cause instanceof Error ? cause.message : fallback }
function formatSalary(vacancy: Vacancy): string { if (vacancy.salaryText) return vacancy.salaryText; const salary = vacancy.salary; if (!salary) return 'Не указана'; const format = new Intl.NumberFormat('ru-RU'); const currency = salary.currency === 'RUR' ? '₽' : salary.currency; if (salary.from && salary.to) return `${format.format(salary.from)} – ${format.format(salary.to)} ${currency}`; if (salary.from) return `от ${format.format(salary.from)} ${currency}`; return `до ${format.format(salary.to ?? 0)} ${currency}` }
function formatPublishedAt(value: string | null | undefined): string { if (!value || !Number.isFinite(Date.parse(value))) return '—'; return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatEnrichedCompensation(enrichment: VacancyEnrichment): string {
  const salary = enrichment.compensation
  if (!salary) return 'Не указана'
  const format = new Intl.NumberFormat('ru-RU')
  const currency = salary.currency === 'RUR' ? '₽' : salary.currency ?? ''
  const range = salary.from !== null && salary.to !== null ? `${format.format(salary.from)}–${format.format(salary.to)}`
    : salary.from !== null ? `от ${format.format(salary.from)}` : salary.to !== null ? `до ${format.format(salary.to)}` : ''
  return [range, currency, salary.mode ? salaryModeLabels[salary.mode] ?? salary.mode : null, salary.gross === null ? null : salary.gross ? 'до налогов' : 'на руки'].filter(Boolean).join(' ')
}
function enrichmentDetails(vacancy: Vacancy): VacancyEnrichmentPreviewData {
  const enrichment = vacancy.enrichment!
  const companySite = externalHttpUrl(enrichment.companySiteUrl)
  const responses = enrichment.responsesCount === null ? 'Не указано' : enrichment.totalResponsesCount !== null && enrichment.totalResponsesCount !== enrichment.responsesCount
    ? `${enrichment.responsesCount} сейчас · ${enrichment.totalResponsesCount} всего` : String(enrichment.responsesCount)
  const extras = [enrichment.internship ? 'стажировка' : null, enrichment.temporary ? 'временная работа' : null,
    enrichment.sideJob ? 'подработка' : null, enrichment.civilLawContracts.length ? `ГПХ: ${values(enrichment.civilLawContracts, contractLabels)}` : null].filter(Boolean)
  return {
    conditions: [
      { label: 'Занятость', value: enrichment.employmentForm ? employmentLabels[enrichment.employmentForm] ?? enrichment.employmentForm : 'Не указано' },
      { label: 'Формат', value: values(enrichment.workFormats, formatLabels) },
      { label: 'График', value: values(enrichment.workScheduleByDays, scheduleLabels) },
      { label: 'Рабочий день', value: hours(enrichment.workingHours) },
      { label: 'Опыт', value: vacancy.experience || 'Не указано' },
      { label: 'Оплата', value: formatEnrichedCompensation(enrichment) },
      { label: 'Выплаты', value: enrichment.compensation?.frequency ? salaryFrequencyLabels[enrichment.compensation.frequency] ?? enrichment.compensation.frequency : 'Не указано' },
      { label: 'Дополнительно', value: extras.length ? extras.join(' · ') : 'Нет' },
      { label: 'Ночные смены', value: yesNo(enrichment.nightShifts) },
      { label: 'Вахта', value: enrichment.flyInFlyOutDurations.length ? values(enrichment.flyInFlyOutDurations) : 'Нет' },
    ],
    application: [
      { label: 'Отклики', value: responses },
      { label: 'Сопроводительное письмо', value: enrichment.responseLetterRequired === null ? 'Не указано' : enrichment.responseLetterRequired ? 'Обязательно' : 'Не требуется' },
      { label: 'Анкета', value: yesNo(enrichment.userTestPresent) },
      { label: 'Вопрос работодателю', value: enrichment.questionInputAvailable === null ? 'Не указано' : enrichment.questionInputAvailable ? 'Можно добавить' : 'Недоступен' },
      { label: 'Неполное резюме', value: enrichment.incompleteResumesAccepted === null ? 'Не указано' : enrichment.incompleteResumesAccepted ? 'Принимается' : 'Не принимается' },
      { label: 'Контакты', value: enrichment.showContact === null ? 'Не указано' : enrichment.showContact ? 'Доступны' : 'Скрыты' },
      { label: 'Сообщения', value: enrichment.inboxPossible === null ? 'Не указано' : enrichment.inboxPossible ? 'Доступны' : 'Недоступны' },
      { label: 'Чат', value: enrichment.chatWritePossibility === 'ENABLED_AFTER_INVITATION' ? 'После приглашения' : enrichment.chatWritePossibility ?? 'Не указано' },
    ],
    requirements: [
      { label: 'Профессиональная роль', value: values(enrichment.professionalRoles) },
      { label: 'Языки', value: enrichment.languages.length ? enrichment.languages.map((item) => `${languageLabels[item.code] ?? item.code.toUpperCase()} ${item.level.toUpperCase()}`).join(' · ') : 'Не указано' },
      { label: 'Доступная среда', value: values(enrichment.inclusivenessTypes, inclusivenessLabels) },
    ],
    company: [
      { label: 'Работодатель', value: enrichment.trustedEmployer === null ? 'Не указано' : enrichment.trustedEmployer ? 'Проверен HH' : 'Без отметки HH' },
      { label: 'Аккредитация', value: enrichment.accreditedItEmployer === null ? 'Не указано' : enrichment.accreditedItEmployer ? 'Аккредитованная IT-компания' : 'Нет' },
      { label: 'Подразделение', value: enrichment.companyDepartment ?? 'Не указано' },
      { label: 'Отзывы', value: enrichment.employerRating ? `${enrichment.employerRating}${enrichment.employerReviewsCount === null ? '' : ` · ${enrichment.employerReviewsCount} отзывов`}` : 'Нет данных' },
      { label: 'Сайт', value: enrichment.companySiteUrl ?? 'Не указан', ...(companySite ? { href: companySite } : {}) },
    ],
    location: [
      { label: 'Адрес', value: enrichment.address ?? (vacancy.location || 'Не указано') },
      { label: 'Метро', value: values(enrichment.metroStations) },
      { label: 'Район', value: enrichment.district ?? 'Не указано' },
    ],
    dates: [
      { label: 'Создана', value: formatPublishedAt(enrichment.sourceCreatedAt) },
      { label: 'Опубликована', value: formatPublishedAt(vacancy.publishedAt) },
      { label: 'Изменена', value: formatPublishedAt(enrichment.sourceUpdatedAt) },
      { label: 'Площадка', value: enrichment.creationSite ?? 'Не указана' },
    ],
  }
}
</script>

<template>
  <PageSkeleton v-if="loading && !vacancies" />
  <section v-else-if="error && !vacancies" class="page-error"><IconSearch :size="34" /><h1>Не удалось загрузить вакансии</h1><p>{{ error }}</p><AppButton variant="primary" @click="refresh">Повторить</AppButton></section>
  <div v-else class="vacancies-page">
    <header class="page-header"><div><h1>Вакансии</h1><p>Проверьте найденные вакансии и сформируйте очередь откликов.</p></div><div class="vacancy-header-actions"><AppButton v-if="relevanceSummary.rated < relevanceSummary.total" variant="secondary" :loading="relevanceBusy" :disabled="!vacancies?.length" @click="analyzeRelevance"><IconSparkles v-if="!relevanceBusy" :size="18" /> Оценить</AppButton><AppButton variant="primary" :disabled="queueCount === 0" @click="launchDialogOpen = true"><IconPlayerPlay :size="18" /> Запустить отклики · {{ queueCount }}</AppButton></div></header>
    <AppAlert v-if="searchId" tone="info">Показаны вакансии одного сохранённого поиска. <RouterLink class="text-link" to="/vacancies">Показать все вакансии</RouterLink></AppAlert>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null"><strong>Операция не выполнена.</strong> {{ actionError }}</AppAlert>
    <AppAlert v-if="favoritesError" tone="warning">Не удалось загрузить избранное. <button class="text-action" @click="refreshFavorites">Повторить</button></AppAlert>
    <AppAlert v-if="relevanceBusy" tone="info"><div class="vacancy-relevance-summary"><strong>Оценено {{ relevanceProgress?.evaluated ?? 0 }} из {{ relevanceProgress?.total ?? 0 }}</strong><span>Цель {{ relevanceSummary.target }}</span><span>Смежные {{ relevanceSummary.adjacent }}</span><span>Проверить {{ relevanceSummary.unknown }}</span><span>Мимо {{ relevanceSummary.noise }}</span></div></AppAlert>
    <AppAlert v-else-if="relevanceSummary.rated" tone="info"><div class="vacancy-relevance-summary"><strong>Оценено {{ relevanceSummary.rated }} из {{ relevanceSummary.total }}</strong><span>Цель {{ relevanceSummary.target }}</span><span>Смежные {{ relevanceSummary.adjacent }}</span><span>Проверить {{ relevanceSummary.unknown }}</span><span>Мимо {{ relevanceSummary.noise }}</span></div></AppAlert>
    <section class="vacancy-filters-card">
      <div class="filter-tabs vacancy-filter-tabs" role="tablist" aria-label="Фильтр вакансий"><button v-for="filter in filters" :key="filter.value" type="button" role="tab" :aria-selected="activeFilter === filter.value" :class="{ 'filter-tab--active': activeFilter === filter.value }" @click="activeFilter = filter.value">{{ filterLabel(filter.value) }}</button></div>
      <div class="vacancy-filter-controls vacancy-filter-controls--relevance">
        <label class="compact-filter"><span>Релевантность</span><AppMultiSelect v-model="relevanceFilter" :options="relevanceOptions" placeholder="Все" /></label>
        <label class="compact-filter"><span>Зарплата, ₽/мес.</span><AppSelect v-model="salaryFilter" :options="salaryOptions" /></label>
        <label class="compact-filter"><span>Компания</span><AppSelect v-model="companyFilter" :options="companyOptions" searchable /></label>
        <label class="compact-filter"><span>Сортировка</span><AppSelect v-model="sortOrder" :options="sortOptions" /></label>
        <label class="search-input vacancy-search-input"><IconSearch :size="18" /><input v-model="query" type="search" placeholder="Название, компания или метка" /></label>
      </div>
      <div class="vacancy-trait-filters" aria-label="Фильтры по признакам вакансии">
        <span class="vacancy-trait-filters__label">Признаки</span>
        <button v-for="filter in traitFilterOptions" :key="filter.key" type="button"
          class="vacancy-trait-filter" :class="`vacancy-trait-filter--${traitFilters[filter.key].toLowerCase()}`"
          :title="traitFilterTitle(filter.key, filter.label)" :aria-label="traitFilterTitle(filter.key, filter.label)"
          @click="cycleTraitFilter(filter.key)"><strong v-if="traitFilters[filter.key] !== 'ANY'">{{ traitFilters[filter.key] === 'YES' ? '+' : '−' }}</strong>{{ filter.label }}</button>
      </div>
    </section>
    <section class="vacancy-table-card">
      <header class="vacancy-bulk-toolbar">
        <div class="vacancy-bulk-selection"><AppCheckbox :model-value="allPageMarked" :disabled="markablePageVacancies.length === 0 || busy" label="Отметить все доступные вакансии на странице" @update:model-value="togglePageMarks" /><span>Показано {{ pageStart }}–{{ pageEnd }} из {{ sortedVacancies.length }}</span><strong v-if="markedIds.size">Отмечено: {{ markedIds.size }}</strong></div>
        <div v-if="markedIds.size" class="vacancy-bulk-actions">
          <AppButton v-if="['NEW', 'ALL', 'FAVORITES'].includes(activeFilter)" size="small" :disabled="busy || queueableMarkedVacancies.length === 0" :title="queueableMarkedVacancies.length ? undefined : 'Среди отмеченных нет вакансий, доступных для автоотклика'" @click="queueMarked(true)"><IconBookmark :size="16" /> Добавить к отклику · {{ queueableMarkedVacancies.length }}</AppButton>
          <AppButton v-if="activeFilter === 'QUEUED'" size="small" :disabled="busy" @click="queueMarked(false)">Убрать из очереди</AppButton>
          <AppButton v-if="activeFilter === 'USER_SKIPPED'" size="small" :disabled="busy" @click="restoreMarked">Вернуть в новые</AppButton>
          <AppButton v-if="['NEW', 'QUEUED', 'ALL', 'FAVORITES'].includes(activeFilter)" size="small" :disabled="busy" @click="skipMarked">Пропустить</AppButton>
          <button class="text-action" type="button" @click="clearMarks"><IconX :size="16" /> Снять отметки</button>
        </div>
      </header>
      <div v-if="paginatedVacancies.length" class="vacancy-table-wrap"><table class="vacancy-table">
        <thead><tr><th class="vacancy-check-cell" /><th>Вакансия</th><th>Компания</th><th>Зарплата</th><th>Отклики</th><th>Опубликована</th><th>Статус</th><th class="cell-actions">Действия</th></tr></thead>
        <tbody><template v-for="vacancy in paginatedVacancies" :key="vacancy.id"><tr :class="{ 'vacancy-row--selected': markedIds.has(vacancy.id), 'vacancy-row--favorite': isFavorite(vacancy) || isFavorite(vacancy, true) }">
          <td class="vacancy-check-cell"><AppCheckbox :model-value="markedIds.has(vacancy.id)" :disabled="!isMarkable(vacancy)" :label="`Отметить вакансию ${vacancy.title}`" @update:model-value="toggleMark(vacancy, $event)" /></td>
          <td>
            <div class="vacancy-title-cell">
              <div class="vacancy-title-line">
                <button class="table-action vacancy-favorite-button" type="button" :disabled="favoriteBusy || !currentFavorites || !!favoritesError"
                  :aria-pressed="isFavorite(vacancy)" :title="isFavorite(vacancy) ? 'Убрать вакансию из избранного' : 'В избранные вакансии'"
                  :aria-label="isFavorite(vacancy) ? 'Убрать вакансию из избранного' : 'В избранные вакансии'"
                  :class="{ 'favorite-active': isFavorite(vacancy) }" @click="toggleFavorite(vacancy)"><IconStar :size="18" /></button>
                <HhExternalLink :href="`https://hh.ru/vacancy/${vacancy.hhVacancyId}`" class="vacancy-name-link"><span>{{ vacancy.title }}</span><IconExternalLink :size="14" aria-hidden="true" /></HhExternalLink>
              </div>
              <span class="vacancy-summary">{{ [vacancy.location, enrichmentFor(vacancy)?.workFormats.map(item => formatLabels[item] ?? item).join(' / ') || vacancy.workFormat, vacancy.experience].filter(Boolean).join(' · ') }}</span>
              <div v-if="vacancy.relevance || vacancy.hasQuestionnaire || vacancy.queuedForApplication || vacancy.hasUnconfirmedApplication || enrichmentFor(vacancy)" class="vacancy-row-tags">
                <StatusBadge v-if="vacancy.relevance" :label="relevancePresentation[vacancy.relevance.category].label" :tone="relevancePresentation[vacancy.relevance.category].tone" :title="vacancy.relevance.reason" />
                <StatusBadge v-if="vacancy.hasQuestionnaire || enrichmentFor(vacancy)?.userTestPresent" label="Анкета" tone="orange" />
                <StatusBadge v-if="enrichmentFor(vacancy)?.responseLetterRequired" label="Письмо" tone="neutral" />
                <StatusBadge v-if="enrichmentFor(vacancy)?.internship" label="Стажировка" tone="blue" />
                <StatusBadge v-if="vacancy.queuedForApplication" label="К отклику" tone="blue" />
                <StatusBadge v-if="vacancy.hasUnconfirmedApplication" label="Предыдущий отклик не подтверждён" tone="orange" />
              </div>
              <small v-if="vacancy.hasUnconfirmedApplication" class="vacancy-recheck-note">При запуске сначала проверим HH. Если отклик уже есть, повторно не отправим.</small>
              <small v-if="questionnaireVerificationError?.vacancyId === vacancy.id" class="vacancy-recheck-note">{{ questionnaireVerificationError.message }}</small>
            </div>
          </td>
          <td>
            <div class="vacancy-company-line">
              <button type="button" class="table-action vacancy-favorite-button" :class="{ 'favorite-active': isFavorite(vacancy, true) }"
                :disabled="!vacancy.company.id || favoriteBusy || !currentFavorites || !!favoritesError" :aria-pressed="isFavorite(vacancy, true)"
                :title="!vacancy.company.id ? 'HH не указал ID работодателя' : isFavorite(vacancy, true) ? 'Убрать компанию из избранного' : 'В избранные компании'"
                :aria-label="isFavorite(vacancy, true) ? 'Убрать компанию из избранного' : 'В избранные компании'"
                @click="toggleFavorite(vacancy, true)"><IconStar :size="18" /></button>
              <div class="vacancy-company-content">
                <HhExternalLink v-if="vacancy.company.id" :href="`https://hh.ru/employer/${vacancy.company.id}`">{{ vacancy.company.name }}</HhExternalLink>
                <span v-else>{{ vacancy.company.name }}</span>
                <StatusBadge v-if="enrichmentFor(vacancy)?.accreditedItEmployer" label="IT" tone="blue" title="Аккредитованная IT-компания" />
              </div>
            </div>
          </td>
          <td><span class="vacancy-salary">{{ formatSalary(vacancy) }}</span></td>
          <td><span class="vacancy-response-count">{{ enrichmentFor(vacancy)?.responsesCount ?? '—' }}</span></td>
          <td>{{ formatPublishedAt(vacancy.publishedAt) }}</td>
          <td><StatusBadge :label="statusPresentation[vacancy.status].label" :tone="statusPresentation[vacancy.status].tone" /></td>
          <td class="cell-actions">
            <button class="table-action" :class="{ 'table-action--active': selectedVacancyId === vacancy.id }" type="button" :aria-expanded="selectedVacancyId === vacancy.id" :aria-controls="`vacancy-history-${vacancy.id}`" title="Информация о вакансии" aria-label="Информация о вакансии" @click="selectedVacancyId = selectedVacancyId === vacancy.id ? null : vacancy.id"><IconInfoCircle :size="18" aria-hidden="true" /></button>
            <button v-if="vacancy.status === 'NEW' && !questionnaireFor(vacancy)" class="table-action" :class="{ 'table-action--active': vacancy.queuedForApplication }" type="button"
              :disabled="!vacancy.queuedForApplication && !canQueue(vacancy)"
              :title="vacancy.queuedForApplication ? 'Убрать из очереди' : queueBlockReason(vacancy) ?? 'Добавить к отклику'"
              :aria-label="vacancy.queuedForApplication ? 'Убрать из очереди' : queueBlockReason(vacancy) ?? 'Добавить к отклику'"
              @click="queue(vacancy, !vacancy.queuedForApplication)"><IconBookmark :size="18" /></button>
            <button v-if="vacancy.status === 'NEW' && questionnaireFor(vacancy)" class="table-action" type="button"
              :disabled="verifyingQuestionnaireVacancyId !== null"
              :title="verifyingQuestionnaireVacancyId === vacancy.id ? 'Проверяем отклик на HH…' : 'Проверить отклик и переместить в «Откликнулись»'"
              :aria-label="verifyingQuestionnaireVacancyId === vacancy.id ? 'Проверяем отклик на HH' : 'Проверить отклик и переместить в «Откликнулись»'"
              @click="markQuestionnaireApplied(vacancy)"><IconCheck :size="18" /></button>
            <button v-if="vacancy.status === 'NEW'" class="table-action" type="button" title="Пропустить" aria-label="Пропустить" @click="skip(vacancy)"><IconX :size="18" /></button>
            <button v-if="vacancy.status === 'USER_SKIPPED'" class="table-action" type="button" title="Вернуть в новые" aria-label="Вернуть в новые" @click="restore(vacancy)"><IconChevronLeft :size="18" /></button>
            <button v-if="isSelectable(vacancy) && vacancy.company.id" class="table-action table-action--danger" type="button" title="Заблокировать компанию" aria-label="Заблокировать компанию" @click="banCompany(vacancy)"><IconBan :size="18" /></button>
          </td>
        </tr>
        <tr v-if="selectedVacancyId === vacancy.id" :id="`vacancy-history-${vacancy.id}`" class="vacancy-local-details"><td colspan="8">
          <dl><div><dt>Поиск</dt><dd><RouterLink v-if="vacancy.searchId" :to="{ name: 'vacancies', query: { searchId: vacancy.searchId } }">{{ sourceSearches?.find((search) => search.id === vacancy.searchId)?.name ?? 'Сохранённый поиск' }}</RouterLink><span v-else>Поиск удалён</span></dd></div>
          <div><dt>Впервые обнаружена</dt><dd>{{ formatPublishedAt(vacancy.firstSeenAt) }}</dd></div>
          <div><dt>Последний раз в выдаче</dt><dd>{{ formatPublishedAt(vacancy.lastSeenAt) }}</dd></div>
          <div v-if="vacancy.publishedAt"><dt>Дата публикации HH</dt><dd>{{ formatPublishedAt(vacancy.publishedAt) }}</dd></div>
          <div><dt>Локальный статус</dt><dd>{{ statusPresentation[vacancy.status].label }}{{ vacancy.queuedForApplication ? ' · В очереди откликов' : '' }}{{ vacancy.banScope ? (vacancy.banScope === 'GLOBAL' ? ' · Глобальный стоп-лист' : ' · Стоп-лист резюме') : '' }}</dd></div></dl>
          <VacancyEnrichmentPreview v-if="enrichmentFor(vacancy)" :data="enrichmentDetails(vacancy)" />
          <div v-if="vacancy.labels.length" class="vacancy-labels"><span v-for="label in vacancy.labels" :key="label">{{ label }}</span></div>
          <VacancyDescription :vacancy-id="vacancy.id" />
        </td></tr>
        </template></tbody>
      </table></div>
      <EmptyState v-else-if="!vacancies?.length" title="Вакансий пока нет" description="Сначала добавьте и просканируйте хотя бы один сохранённый поиск." />
      <EmptyState v-else title="По выбранным фильтрам ничего нет" description="Измените фильтры или поисковый запрос." />
      <footer v-if="sortedVacancies.length" class="vacancy-pagination">
        <label class="vacancy-page-size"><span>Показывать по</span><AppSelect v-model="pageSize" :options="pageSizeOptions" /></label>
        <nav class="vacancy-page-navigation" aria-label="Страницы вакансий">
          <button type="button" :disabled="currentPage === 1" aria-label="Предыдущая страница" @click="goToPage(currentPage - 1)"><IconChevronLeft :size="18" /></button>
          <template v-for="item in paginationItems" :key="item">
            <button v-if="typeof item === 'number'" type="button" :class="{ 'vacancy-page--active': item === currentPage }" :aria-current="item === currentPage ? 'page' : undefined" :aria-label="`Страница ${item}`" @click="goToPage(item)">{{ item }}</button>
            <span v-else class="vacancy-page-gap" aria-hidden="true">…</span>
          </template>
          <button type="button" :disabled="currentPage === totalPages" aria-label="Следующая страница" @click="goToPage(currentPage + 1)"><IconChevronRight :size="18" /></button>
        </nav>
      </footer>
    </section>
  </div>
  <ApplicationLaunchDialog v-if="launchDialogOpen" :vacancy-count="queueCount" :questionnaire-count="queuedQuestionnaireCount" :unconfirmed-count="queuedUnconfirmedCount" :daily-limit-remaining="dailyLimitRemaining" :defaults="launchDefaults" :submitting="launchSubmitting" :resume-name="applicationContextStore.state.overview?.resumes.find(item => item.id === applicationContextStore.state.overview?.selectedResumeId)?.name" @close="launchDialogOpen = false" @submit="launchApplications" />
</template>
