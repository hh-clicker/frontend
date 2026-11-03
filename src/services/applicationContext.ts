import { reactive, watch } from 'vue'
import type { ActiveRunSummary, AuthorizationStatus, OverviewResponse } from '../api/contracts/overview'
import { loadOverview } from './overview'
import { isMockMode } from '../app/runtime'
import { mockRevision, selectMockAccount, selectMockResume } from '../mocks/state'

interface ApplicationContextState {
  overview: OverviewResponse | null
  loading: boolean
  error: string | null
}

const state = reactive<ApplicationContextState>({
  overview: null,
  loading: false,
  error: null,
})
let reloadRequested = false
let activeLoad: Promise<void> | null = null
let requestedAccountId = isMockMode ? null : localStorage.getItem('hh-clicker.account-id')
let requestedResumeId = isMockMode ? null : localStorage.getItem('hh-clicker.resume-id')

async function load(force = false): Promise<void> {
  if (activeLoad) {
    if (force) reloadRequested = true
    return activeLoad
  }
  if (state.overview && !force) return

  activeLoad = (async () => {
    state.loading = true
    do {
      reloadRequested = false
      state.error = null
      try {
        const accountId = requestedAccountId
        const resumeId = requestedResumeId
        const overview = await loadOverview(accountId, resumeId)
        // Не возвращаем старый аккаунт, если пользователь переключился во время запроса.
        if (!isMockMode && (accountId !== requestedAccountId || resumeId !== requestedResumeId)) {
          reloadRequested = true
          continue
        }
        state.overview = overview
        if (!isMockMode) {
          requestedAccountId = state.overview.selectedAccountId
          requestedResumeId = state.overview.selectedResumeId
          persistSelection()
        }
      } catch (cause) {
        state.error = cause instanceof Error ? cause.message : 'Не удалось загрузить данные приложения'
      }
    } while (reloadRequested)
    state.loading = false
  })()

  try {
    await activeLoad
  } finally {
    activeLoad = null
  }
}

function selectAccount(accountId: string | number | null): void {
  if (state.overview && typeof accountId === 'string') {
    state.overview.selectedAccountId = accountId
    state.overview.authorizationStatus = 'UNKNOWN'
    if (isMockMode) {
      state.overview.selectedResumeId = selectMockAccount(accountId)
    } else {
      requestedAccountId = accountId
      requestedResumeId = null
      persistSelection()
      void load(true)
    }
  }
}

function selectResume(resumeId: string | number | null): void {
  if (state.overview && typeof resumeId === 'string') {
    state.overview.selectedResumeId = resumeId
    if (isMockMode) {
      selectMockResume(resumeId)
    } else {
      requestedResumeId = resumeId
      persistSelection()
      void load(true)
    }
  }
}

function setActiveRun(activeRun: ActiveRunSummary | null): void {
  if (state.overview) state.overview.activeRun = activeRun
}

function setAuthorizationStatus(accountId: string, status: AuthorizationStatus): void {
  if (state.overview?.selectedAccountId === accountId) state.overview.authorizationStatus = status
}

export const applicationContextStore = { state, load, selectAccount, selectResume, setActiveRun, setAuthorizationStatus }

watch(mockRevision, () => { if (isMockMode && state.overview) void load(true) })

function persistSelection(): void {
  if (requestedAccountId) localStorage.setItem('hh-clicker.account-id', requestedAccountId)
  else localStorage.removeItem('hh-clicker.account-id')
  if (requestedResumeId) localStorage.setItem('hh-clicker.resume-id', requestedResumeId)
  else localStorage.removeItem('hh-clicker.resume-id')
}
