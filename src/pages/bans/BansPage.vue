<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconBan, IconBuilding, IconEdit, IconSearch, IconTrash, IconX } from '@tabler/icons-vue'
import type { CompanyBan, SaveCompanyBanRequest } from '../../api/contracts/bans'
import type { CompanyBanScope } from '../../api/contracts/vacancies'
import BanEditorDialog from '../../components/bans/BanEditorDialog.vue'
import HhExternalLink from '../../components/browser/HhExternalLink.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { usePageData } from '../../composables/usePageData'
import { applicationContextStore } from '../../services/applicationContext'
import { createCompanyBan, loadCompanyBans, removeCompanyBan, updateCompanyBanScope } from '../../services/bans'
import { confirmRemoveCompanyBan } from '../../services/dialogs'

type BanFilter = 'ALL' | CompanyBanScope

const activeFilter = ref<BanFilter>('ALL')
const query = ref('')
const selectedBanId = ref<string | null>(null)
let pressedOnBackdrop = false
let releasedOnBackdrop = false
function onBackdropPointerDown(event: PointerEvent): void {
  pressedOnBackdrop = event.target === event.currentTarget
  releasedOnBackdrop = false
}
function onBackdropPointerUp(event: PointerEvent): void {
  releasedOnBackdrop = event.target === event.currentTarget
}
function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget && pressedOnBackdrop && releasedOnBackdrop) selectedBanId.value = null
  pressedOnBackdrop = false
  releasedOnBackdrop = false
}
const editorOpen = ref(false)
const editingBan = ref<CompanyBan | null>(null)
const busyBanId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const currentResumeId = computed(() => applicationContextStore.state.overview?.selectedResumeId ?? '')
const currentResumeName = computed(() => applicationContextStore.state.overview?.resumes.find((item) => item.id === currentResumeId.value)?.name ?? 'Резюме не выбрано')
const { data: bans, loading, error, refresh } = usePageData(() => loadCompanyBans(currentResumeId.value))
watch(currentResumeId, () => { selectedBanId.value = null; activeFilter.value = 'ALL'; void refresh() })
const selectedBan = computed(() => (bans.value ?? []).find((ban) => ban.id === selectedBanId.value) ?? null)
const counts = computed(() => ({
  ALL: (bans.value ?? []).length,
  RESUME: (bans.value ?? []).filter((ban) => ban.scope === 'RESUME' && ban.resumeId === currentResumeId.value).length,
  GLOBAL: (bans.value ?? []).filter((ban) => ban.scope === 'GLOBAL').length,
}))
const hiddenTotal = computed(() => (bans.value ?? []).reduce((sum, ban) => sum + ban.hiddenVacanciesCount, 0))
const filteredBans = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('ru')
  return (bans.value ?? []).filter((ban) => {
    const scopeMatches = activeFilter.value === 'ALL' || (activeFilter.value === 'RESUME' ? ban.scope === 'RESUME' && ban.resumeId === currentResumeId.value : ban.scope === 'GLOBAL')
    return scopeMatches && (!needle || ban.companyName.toLocaleLowerCase('ru').includes(needle) || ban.employerId.includes(needle))
  }).sort((left, right) => left.companyName.localeCompare(right.companyName, 'ru'))
})

function openCreate(): void { editingBan.value = null; editorOpen.value = true }
function openEdit(ban: CompanyBan): void { editingBan.value = ban; editorOpen.value = true }

async function saveBan(request: SaveCompanyBanRequest): Promise<void> {
  actionError.value = null
  try {
    if (editingBan.value) replaceBan(await updateCompanyBanScope(editingBan.value.id, request.scope, request.resumeId, request.resumeName))
    else {
      const saved = await createCompanyBan(request)
      if ((bans.value ?? []).some((ban) => ban.id === saved.id)) replaceBan(saved)
      else bans.value = [saved, ...(bans.value ?? [])]
    }
    editorOpen.value = false
    editingBan.value = null
  } catch (cause) {
    setActionError(cause, 'Не удалось сохранить блокировку')
  }
}

async function unblock(ban: CompanyBan): Promise<void> {
  if (!await confirmRemoveCompanyBan(ban.companyName, ban.hiddenVacanciesCount)) return
  busyBanId.value = ban.id
  actionError.value = null
  try {
    await removeCompanyBan(ban.id)
    bans.value = (bans.value ?? []).filter((item) => item.id !== ban.id)
    if (selectedBanId.value === ban.id) selectedBanId.value = null
  } catch (cause) {
    setActionError(cause, 'Не удалось снять блокировку')
  } finally {
    busyBanId.value = null
  }
}

function replaceBan(updated: CompanyBan): void {
  bans.value = (bans.value ?? []).map((ban) => ban.id === updated.id ? updated : ban)
}

function setActionError(cause: unknown, fallback: string): void {
  actionError.value = cause instanceof Error ? cause.message : fallback
}
</script>

<template>
  <PageSkeleton v-if="loading && !bans" />
  <section v-else-if="error && !bans" class="page-error"><IconBan :size="36" /><h1>Не удалось загрузить стоп-лист</h1><p>{{ error }}</p><AppButton variant="primary" @click="refresh">Повторить</AppButton></section>
  <div v-else class="bans-page">
    <header class="page-header"><div><h1>Стоп-лист</h1><p>Компании, вакансии которых не предлагаются к отклику.</p></div><AppButton variant="primary" :disabled="!currentResumeId" @click="openCreate"><IconBan :size="18" /> Добавить компанию</AppButton></header>
    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null"><strong>Операция не выполнена.</strong> {{ actionError }}</AppAlert>

    <section class="ban-summary"><div><span>Всего компаний</span><strong>{{ counts.ALL }}</strong></div><div><span>Для резюме</span><strong>{{ counts.RESUME }}</strong><small>{{ currentResumeName }}</small></div><div><span>Глобально</span><strong>{{ counts.GLOBAL }}</strong><small>Все аккаунты и резюме</small></div><div><span>Скрыто вакансий</span><strong>{{ hiddenTotal }}</strong></div></section>

    <section class="bans-card">
      <header class="bans-toolbar"><div class="filter-tabs bans-filter-tabs"><button type="button" :class="{ 'filter-tab--active': activeFilter === 'ALL' }" @click="activeFilter = 'ALL'">Все · {{ counts.ALL }}</button><button type="button" :class="{ 'filter-tab--active': activeFilter === 'RESUME' }" @click="activeFilter = 'RESUME'">Для резюме · {{ counts.RESUME }}</button><button type="button" :class="{ 'filter-tab--active': activeFilter === 'GLOBAL' }" @click="activeFilter = 'GLOBAL'">Глобальные · {{ counts.GLOBAL }}</button></div><label class="search-input"><IconSearch :size="18" /><input v-model="query" type="search" placeholder="Название компании" /></label></header>
      <div v-if="filteredBans.length" class="bans-table-wrap"><table class="bans-table"><thead><tr><th>Компания</th><th>Область</th><th>Применяется к</th><th>Скрыто</th><th>Добавлена</th><th>Источник</th><th class="cell-actions">Действия</th></tr></thead><tbody><tr v-for="ban in filteredBans" :key="ban.id"><td><button class="ban-company-link" type="button" @click="selectedBanId = ban.id"><IconBuilding :size="17" /> {{ ban.companyName }}</button></td><td><StatusBadge :label="ban.scope === 'GLOBAL' ? 'Глобально' : 'Для резюме'" :tone="ban.scope === 'GLOBAL' ? 'purple' : 'blue'" /></td><td>{{ ban.resumeName ?? 'Все аккаунты и резюме' }}</td><td>{{ ban.hiddenVacanciesCount }}</td><td>{{ ban.createdAt }}</td><td>{{ ban.sourceVacancyTitle ?? 'Добавлена вручную' }}</td><td class="cell-actions"><button class="table-action" type="button" title="Изменить область" aria-label="Изменить область" @click="openEdit(ban)"><IconEdit :size="18" /></button><button class="table-action table-action--danger" type="button" title="Разблокировать" aria-label="Разблокировать" :disabled="busyBanId === ban.id" @click="unblock(ban)"><IconTrash :size="18" /></button></td></tr></tbody></table></div>
      <EmptyState v-else-if="!bans?.length" title="Стоп-лист пуст" description="Заблокированные компании появятся здесь." />
      <EmptyState v-else title="Компании не найдены" description="Измените область или поисковый запрос." />
    </section>
  </div>

  <div v-if="selectedBan" class="drawer-backdrop" @pointerdown="onBackdropPointerDown" @pointerup="onBackdropPointerUp" @pointercancel="pressedOnBackdrop = false" @click="onBackdropClick"><aside class="ban-details-drawer"><header><div><span>Компания</span><h2>{{ selectedBan.companyName }}</h2></div><button class="icon-action" type="button" aria-label="Закрыть" @click="selectedBanId = null"><IconX :size="20" /></button></header><div class="ban-details-drawer__body"><StatusBadge :label="selectedBan.scope === 'GLOBAL' ? 'Глобальная блокировка' : 'Для текущего резюме'" :tone="selectedBan.scope === 'GLOBAL' ? 'purple' : 'blue'" /><dl><div><dt>Employer ID</dt><dd><HhExternalLink :href="selectedBan.employerUrl">{{ selectedBan.employerId }}</HhExternalLink></dd></div><div><dt>{{ selectedBan.scope === 'GLOBAL' ? 'Область' : 'Резюме' }}</dt><dd>{{ selectedBan.resumeName ?? 'Все аккаунты и резюме' }}</dd></div><div><dt>Скрыто вакансий</dt><dd>{{ selectedBan.hiddenVacanciesCount }}</dd></div><div><dt>Добавлена</dt><dd>{{ selectedBan.createdAt }}</dd></div><div><dt>Источник</dt><dd>{{ selectedBan.sourceVacancyTitle ?? 'Добавлена вручную' }}</dd></div></dl><p>После разблокировки актуальные вакансии компании вернутся в «Новые», но не будут добавлены в очередь автоматически.</p></div><footer><AppButton @click="openEdit(selectedBan)"><IconEdit :size="17" /> Изменить область</AppButton><AppButton variant="danger" @click="unblock(selectedBan)"><IconTrash :size="17" /> Разблокировать</AppButton></footer></aside></div>
  <BanEditorDialog v-if="editorOpen" :ban="editingBan" :resume-id="currentResumeId" :resume-name="currentResumeName" @close="editorOpen = false" @save="saveBan" />
</template>
