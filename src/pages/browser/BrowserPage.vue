<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { IconAlertTriangle, IconBrandChrome, IconInfoCircle, IconPlayerPlay, IconPlayerStop, IconRefresh, IconServer, IconShieldCheck } from '@tabler/icons-vue'
import type { BrowserProfile } from '../../api/contracts/browser'
import AccountSetupPanel from '../../components/browser/AccountSetupPanel.vue'
import SelectorDiagnosticsPanel from '../../components/browser/SelectorDiagnosticsPanel.vue'
import { parseDiagnosticEntry } from '../../services/selectorDiagnosticEntry'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import PageSkeleton from '../../components/ui/PageSkeleton.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { browserAgentStatus, browserAgentOpen, browserAgentActiveProfileId } from '../../composables/useBrowserAgentStatus'
import { usePageData } from '../../composables/usePageData'
import { applicationContextStore } from '../../services/applicationContext'
import { authorizationChecks, checkAuthorizationViaAgent, ensureBrowserProfile, loadBrowserPage, startBrowser, stopBrowser } from '../../services/browser'

const selectedAccountId = computed(() => applicationContextStore.state.overview?.selectedAccountId ?? null)
const route = useRoute()
const diagnosticEntry = computed(() => parseDiagnosticEntry(route.query))
const selectedAccount = computed(() => applicationContextStore.state.overview?.accounts.find((item) => item.id === selectedAccountId.value) ?? null)
const { data, loading, error, refresh } = usePageData(async () => selectedAccountId.value ? loadBrowserPage(selectedAccountId.value) : null)
const busy = ref(false)
const setupBusy = ref(false)
const actionError = ref<string | null>(null)
const profile = computed(() => {
  const loadedProfile = data.value?.profile
  return loadedProfile && loadedProfile.accountId === selectedAccountId.value ? loadedProfile : null
})
const agentReady = computed(() => browserAgentStatus.value === 'READY' || browserAgentStatus.value === 'BUSY')
const running = computed(() => !!profile.value && browserAgentOpen.value && browserAgentActiveProfileId.value === profile.value.id)
const authorizationCheck = computed(() => selectedAccountId.value ? authorizationChecks[selectedAccountId.value] : undefined)
const checking = computed(() => authorizationCheck.value?.checking ?? false)
const authorizationStatus = computed(() => checking.value ? 'CHECKING'
  : !running.value ? 'UNKNOWN'
    : authorizationCheck.value?.result?.status ?? applicationContextStore.state.overview?.authorizationStatus ?? 'UNKNOWN')
const authorizationTone = computed(() => ({ AUTHORIZED: 'green', REQUIRED: 'orange', UNKNOWN: 'neutral', CHECKING: 'blue' } as const)[authorizationStatus.value])
const authorizationNotice = computed(() => {
  switch (authorizationStatus.value) {
    case 'AUTHORIZED': return { title: 'Вход подтверждён', icon: IconShieldCheck }
    case 'REQUIRED': return { title: 'Требуется вход в HH', icon: IconAlertTriangle }
    case 'CHECKING': return { title: 'Проверяем вход', icon: IconRefresh }
    default: return { title: authorizationCheck.value?.result ? 'Не удалось определить статус входа' : 'Проверка входа в HH', icon: IconInfoCircle }
  }
})

watch(selectedAccountId, (accountId, previousAccountId) => {
  actionError.value = null
  setupBusy.value = false
  if (accountId !== previousAccountId && !busy.value) void refresh()
})

function replaceProfile(updated: BrowserProfile): void {
  if (data.value && updated.accountId === selectedAccountId.value) data.value = { ...data.value, profile: updated }
}

function profileReady(updated: BrowserProfile): void {
  if (updated.accountId !== selectedAccountId.value) return
  replaceProfile(updated)
  void refresh()
}

async function runAction(action: () => Promise<BrowserProfile>, fallback: string): Promise<void> {
  const accountId = selectedAccountId.value
  busy.value = true
  actionError.value = null
  try {
    const updated = await action()
    if (selectedAccountId.value === accountId) replaceProfile(updated)
  } catch (cause) {
    if (selectedAccountId.value === accountId) actionError.value = cause instanceof Error ? cause.message : fallback
  } finally {
    busy.value = false
    if (selectedAccountId.value !== accountId) void refresh()
  }
}

async function checkEntry(): Promise<void> {
  const accountId = selectedAccountId.value
  if (!accountId || checking.value || busy.value) return
  actionError.value = null
  try {
    await checkAuthorizationViaAgent(accountId)
  } catch (cause) {
    if (selectedAccountId.value === accountId) actionError.value = cause instanceof Error ? cause.message : 'Не удалось проверить вход'
  }
}

async function start(): Promise<void> {
  const accountId = selectedAccountId.value
  if (!accountId) {
    actionError.value = 'Сначала выберите HH-аккаунт'
    return
  }
  await runAction(async () => {
    await ensureBrowserProfile(accountId)
    return startBrowser(accountId)
  }, 'Не удалось запустить браузер')
}

async function stop(): Promise<void> {
  const accountId = selectedAccountId.value
  if (!accountId) {
    actionError.value = 'Сначала выберите HH-аккаунт'
    return
  }
  await runAction(() => stopBrowser(accountId), 'Не удалось остановить браузер')
}
</script>

<template>
  <PageSkeleton v-if="loading && !data" />
  <section v-else-if="error && !data" class="page-error">
    <IconBrandChrome :size="36" />
    <h1>Не удалось загрузить Browser Agent</h1>
    <p>{{ error }}</p>
    <AppButton variant="primary" @click="refresh">Повторить</AppButton>
  </section>

  <div v-else class="browser-page">
    <header class="page-header">
      <div>
        <h1>Браузер</h1>
        <p>Постоянный профиль Google Chrome для выбранного HH-аккаунта.</p>
      </div>
      <div v-if="profile" class="browser-page-actions">
        <AppButton :disabled="!running || browserAgentStatus !== 'READY' || busy || setupBusy" :loading="checking" @click="checkEntry">
          <IconRefresh v-if="!checking" :size="18" /> Проверить вход
        </AppButton>
        <AppButton v-if="!running" variant="primary" :disabled="browserAgentStatus !== 'READY' || checking || setupBusy" :loading="busy" @click="start">
          <IconPlayerPlay v-if="!busy" :size="18" /> Запустить браузер
        </AppButton>
        <AppButton v-else variant="danger" :disabled="checking || !agentReady || setupBusy" :loading="busy" @click="stop">
          <IconPlayerStop v-if="!busy" :size="18" /> Остановить браузер
        </AppButton>
      </div>
    </header>

    <AppAlert v-if="actionError" tone="warning" dismissible @dismiss="actionError = null">
      <strong>Операция не выполнена.</strong> {{ actionError }}
    </AppAlert>

    <section class="browser-status-grid">
      <div>
        <span class="browser-status-icon browser-status-icon--green"><IconServer :size="21" /></span>
        <span>Browser Agent</span>
        <StatusBadge :label="browserAgentStatus" :tone="agentReady ? 'green' : 'neutral'" />
      </div>
      <div>
        <span class="browser-status-icon browser-status-icon--blue"><IconShieldCheck :size="21" /></span>
        <span>HH авторизация</span>
        <StatusBadge :label="authorizationStatus" :tone="authorizationTone" />
      </div>
      <div>
        <span class="browser-status-icon browser-status-icon--orange"><IconBrandChrome :size="21" /></span>
        <span>Google Chrome</span>
        <StatusBadge :label="!profile ? 'НЕТ ПРОФИЛЯ' : running ? 'RUNNING' : 'STOPPED'" :tone="running ? 'orange' : 'neutral'" />
      </div>
    </section>

    <section
      v-if="profile"
      class="browser-authorization-notice"
      :class="`browser-authorization-notice--${authorizationTone}`"
      role="status"
      aria-atomic="true"
    >
      <span class="browser-authorization-notice__icon" aria-hidden="true">
        <component :is="authorizationNotice.icon" :size="24" />
      </span>
      <div class="browser-authorization-notice__content">
        <h2>{{ authorizationNotice.title }}</h2>
        <p>{{ checking ? 'Открываем страницу профиля HH и проверяем авторизацию…' : authorizationCheck?.result?.message ?? 'Проверка выполняется при запуске браузера. После ручного входа или выхода нажмите «Проверить вход».' }}</p>
      </div>
    </section>

    <SelectorDiagnosticsPanel v-if="selectedAccountId" :account-id="selectedAccountId" :entry="diagnosticEntry"
      :resume-id="applicationContextStore.state.overview?.selectedResumeId ?? null"
      :available="browserAgentStatus === 'READY' && !busy && !checking && !setupBusy"
      :full-available="browserAgentStatus === 'READY' && !busy && !checking && !setupBusy" />
    <AccountSetupPanel
      v-if="selectedAccount"
      :key="selectedAccount.id"
      :account-id="selectedAccount.id"
      :account-name="selectedAccount.name"
      :running="running"
      :page-busy="busy"
      @profile="profileReady"
      @open="start"
      @busy="setupBusy = $event"
    />
    <section v-else class="content-card browser-empty">
      <EmptyState title="Выберите HH-аккаунт" description="Создайте аккаунт, чтобы настроить браузер и загрузить резюме.">
        <RouterLink to="/resumes" class="app-button app-button--primary app-button--medium">К аккаунтам и резюме</RouterLink>
      </EmptyState>
    </section>
  </div>
</template>
