import { getMockScenario, isMockMode } from '../app/runtime'
import { apiRequest } from '../api/client'
import type { ApplicationRun, ApplicationRunSummary, ApplicationRunStatus, StartApplicationRunRequest } from '../api/contracts/applications'
import { createApplicationRunMock, getApplicationRunsMock } from '../mocks/applications'
import { getMockSelection, touchMockState } from '../mocks/state'

export async function loadApplicationRuns(resumeId?: string | null): Promise<ApplicationRunSummary[]> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить историю откликов')
    return getApplicationRunsMock(getMockScenario()).filter((run) => run.resumeId === getMockSelection().resumeId).map((run) => {
      const processed = run.applications.filter(item => !['QUEUED', 'IN_PROGRESS'].includes(item.status)).length
      const remaining = run.applications.length - processed
      const active = run.status === 'RUNNING' || run.status.startsWith('PAUSED_')
      return {
        id: run.id, sequence: run.sequence, resumeId: run.resumeId, resumeName: run.resumeName, mode: run.mode,
        status: run.status, createdAt: run.createdAt, total: run.applications.length,
        attention: run.applications.filter(item => item.status === 'ATTENTION_REQUIRED' && (!item.attentionStatus || item.attentionStatus === 'OPEN')).length,
        revision: JSON.stringify([run.status, run.applications.map(item => [item.id, item.status, item.attentionStatus, item.outcome, item.letter])]),
        estimatedRemainingSeconds: active && processed > 0 && remaining > 0 ? remaining * 45 : null,
      }
    })
  }
  if (!resumeId) return []
  return apiRequest<ApplicationRunSummary[]>(`/api/v1/application-runs?resumeId=${encodeURIComponent(resumeId)}`)
}

export async function loadApplicationRun(runId: string): Promise<ApplicationRun> {
  if (isMockMode) {
    if (getMockScenario() === 'error') throw new Error('Не удалось загрузить запуск')
    const run = getApplicationRunsMock(getMockScenario()).find(item => item.id === runId)
    if (!run) throw new Error('Запуск не найден')
    return structuredClone(run)
  }
  return apiRequest<ApplicationRun>(`/api/v1/application-runs/${encodeURIComponent(runId)}`)
}

export async function startApplicationRun(request: StartApplicationRunRequest): Promise<ApplicationRun> {
  if (isMockMode) return createApplicationRunMock(getMockScenario(), request)
  return apiRequest<ApplicationRun>('/api/v1/application-runs', { method: 'POST', body: JSON.stringify(request) })
}

export async function setApplicationRunStatus(runId: string, status: ApplicationRunStatus, confirmFallback = false): Promise<ApplicationRun> {
  if (isMockMode) {
    const run = getApplicationRunsMock(getMockScenario()).find((item) => item.id === runId)
    if (!run) throw new Error('Запуск не найден')
    run.status = status
    if (confirmFallback) run.aiFallbackConfirmed = true
    if (['COMPLETED', 'CANCELLED'].includes(status)) {
      run.finishedAt = 'Только что'
      if (status === 'CANCELLED') {
        run.applications.forEach((item) => {
          if (['QUEUED', 'IN_PROGRESS'].includes(item.status)) item.status = 'CANCELLED'
        })
      }
    }
    touchMockState()
    return structuredClone(run)
  }
  return apiRequest<ApplicationRun>(`/api/v1/application-runs/${encodeURIComponent(runId)}/status`, { method: 'PUT', body: JSON.stringify({ status, confirmFallback }) })
}
