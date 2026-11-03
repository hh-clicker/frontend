<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  IconBan,
  IconChartBar,
  IconBriefcase,
  IconBrowser,
  IconFileCv,
  IconHome,
  IconLock,
  IconSearch,
  IconSettings,
  IconWifi,
} from '@tabler/icons-vue'
import { RouterLink, RouterView } from 'vue-router'
import AppAlert from '../ui/AppAlert.vue'
import BrowserUnavailableDialog from '../browser/BrowserUnavailableDialog.vue'
import AppButton from '../ui/AppButton.vue'
import AppSelect from '../ui/AppSelect.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import { applicationContextStore } from '../../services/applicationContext'
import { authorizationChecks, openBrowserViaAgent } from '../../services/browser'
import { browserAgentOpen, useBrowserAgentStatus } from '../../composables/useBrowserAgentStatus'

const alertDismissed = ref(false)
const browserOpening = ref(false)
const browserCommandError = ref<string | null>(null)
const context = applicationContextStore.state
const { status: agentStatus, refresh: refreshAgentStatus } = useBrowserAgentStatus()

const navigation = computed(() => [
  { label: 'Обзор', to: '/', icon: IconHome },
  { label: 'Поиски', to: '/searches', icon: IconSearch },
  { label: 'Вакансии', to: '/vacancies', icon: IconBriefcase },
  { label: 'Отклики', to: '/applications', icon: IconFileCv, count: context.overview?.metrics.find((metric) => metric.id === 'attention')?.value ?? 0 },
  { label: 'Аналитика рынка', to: '/market-analysis', icon: IconChartBar },
  { label: 'Стоп-лист', to: '/bans', icon: IconBan },
  { label: 'Резюме', to: '/resumes', icon: IconFileCv },
  { label: 'Браузер', to: '/browser', icon: IconBrowser },
  { label: 'Настройки', to: '/settings', icon: IconSettings },
])

const accountOptions = computed(() => context.overview?.accounts.map((item) => ({ value: item.id, label: item.name })) ?? [])
const resumeOptions = computed(() => context.overview?.resumes.map((item) => ({ value: item.id, label: item.name })) ?? [])
const agentConnected = computed(() => agentStatus.value !== 'OFFLINE')
const agentStatusTone = computed(() => ({
  OFFLINE: 'neutral',
  CONNECTING: 'blue',
  READY: 'green',
  BUSY: 'orange',
} as const)[agentStatus.value])
const authorizationStatus = computed(() => {
  const accountId = context.overview?.selectedAccountId
  const check = accountId ? authorizationChecks[accountId] : undefined
  if (check?.checking) return 'CHECKING'
  if (!browserAgentOpen.value) return 'UNKNOWN'
  return check?.result?.status ?? context.overview?.authorizationStatus ?? 'UNKNOWN'
})
const authorizationTone = computed(() => ({ AUTHORIZED: 'green', REQUIRED: 'orange', UNKNOWN: 'neutral', CHECKING: 'blue' } as const)[authorizationStatus.value])
const selectorPlaceholder = computed(() => context.loading ? 'Загрузка…' : context.error ? 'Недоступно' : 'Выберите')
const accountSelectDisabled = computed(() => context.loading || !!context.error || accountOptions.value.length === 0)
const resumeSelectDisabled = computed(() => context.loading || !!context.error || resumeOptions.value.length === 0)

onMounted(() => void applicationContextStore.load())

watch(agentStatus, (status) => {
  if (status !== 'OFFLINE') alertDismissed.value = false
})

async function openBrowser(): Promise<void> {
  browserOpening.value = true
  browserCommandError.value = null
  try {
    const accountId = context.overview?.selectedAccountId
    if (!accountId) throw new Error('Сначала выберите HH-аккаунт')
    await openBrowserViaAgent(accountId)
    await refreshAgentStatus()
  } catch (cause) {
    browserCommandError.value = cause instanceof Error ? cause.message : 'Не удалось открыть браузер'
  } finally {
    browserOpening.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <img class="brand__icon" src="/brand-icon.svg" alt="" aria-hidden="true">
        <span>HH Clicker</span>
      </RouterLink>
      <nav class="sidebar__nav" aria-label="Основная навигация">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          exact-active-class="nav-link--active"
          active-class="nav-link--active"
        >
          <component :is="item.icon" :size="19" stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <span v-if="item.count" class="nav-link__count">{{ item.count }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="app-workspace">
      <header class="topbar">
        <div class="topbar__selectors">
          <label class="topbar-field">
            <span>HH-аккаунт</span>
            <AppSelect
              :model-value="context.overview?.selectedAccountId ?? null"
              :options="accountOptions"
              :placeholder="selectorPlaceholder"
              :disabled="accountSelectDisabled"
              aria-label="HH-аккаунт"
              @update:model-value="applicationContextStore.selectAccount"
            />
          </label>
          <label class="topbar-field topbar-field--resume">
            <span>Резюме</span>
            <AppSelect
              :model-value="context.overview?.selectedResumeId ?? null"
              :options="resumeOptions"
              :placeholder="selectorPlaceholder"
              :disabled="resumeSelectDisabled"
              aria-label="Резюме"
              @update:model-value="applicationContextStore.selectResume"
            />
          </label>
        </div>

        <div class="topbar__status-group">
          <div class="topbar-status">
            <span>Browser Agent</span>
            <StatusBadge :label="agentStatus" :tone="agentStatusTone" />
          </div>
          <IconWifi class="topbar-status__signal" :class="{ 'is-offline': !agentConnected }" :size="18" />
          <div class="topbar-status">
            <span>HH авторизация</span>
            <StatusBadge :label="authorizationStatus" :tone="authorizationTone" />
          </div>
          <IconLock :size="17" class="topbar-status__lock" />
          <div v-if="context.overview?.activeRun" class="topbar-status">
            <span>Активный запуск</span>
            <StatusBadge :label="`Запуск #${context.overview.activeRun.sequence}`" tone="orange" />
          </div>
          <AppButton
            variant="primary"
            :disabled="agentStatus !== 'READY' || !context.overview?.selectedAccountId || authorizationStatus === 'CHECKING'"
            :loading="browserOpening"
            @click="openBrowser"
          >
            Открыть браузер <IconBrowser :size="18" />
          </AppButton>
        </div>
      </header>

      <main class="app-main">
        <AppAlert
          v-if="browserCommandError"
          tone="warning"
          dismissible
          @dismiss="browserCommandError = null"
        >
          <strong>Не удалось открыть браузер.</strong> {{ browserCommandError }}
        </AppAlert>
        <AppAlert
          v-if="agentStatus === 'OFFLINE' && !alertDismissed"
          dismissible
          @dismiss="alertDismissed = true"
        >
          <strong>Browser Agent не подключён.</strong> Сканирование и отклики недоступны.
        </AppAlert>
        <AppAlert v-if="context.error" tone="warning">
          <strong>Не удалось загрузить контекст приложения.</strong> {{ context.error }}
        </AppAlert>
        <RouterView />
      </main>
    </div>
    <BrowserUnavailableDialog />
  </div>
</template>
