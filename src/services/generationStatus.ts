import { apiRequest } from '../api/client'
import { getMockScenario, isMockMode } from '../app/runtime'

export type GenerationState = 'READY' | 'AUTH_REQUIRED' | 'UNAVAILABLE' | 'CHECK_FAILED' | 'AGENT_OFFLINE' | 'UNKNOWN' | 'STALE'
export interface GenerationStatus {
  state: GenerationState; checkedAt: string | null; refreshing: boolean
  model: string | null; reasoningEffort: string | null; cliVersion: string | null
  queued: number | null; running: number | null
  limits?: { primary: LimitWindow | null; secondary: LimitWindow | null; checkedAt?: string | null } | null
}
export interface LimitWindow { usedPercent: number; windowDurationMins: number; resetsAt: number }
export async function loadGenerationStatus(refresh = false, signal?: AbortSignal): Promise<GenerationStatus> {
  if (isMockMode) {
    const scenario = getMockScenario()
    const state = scenario === 'agent-offline' ? 'AGENT_OFFLINE' : scenario === 'error' ? 'UNAVAILABLE' : scenario === 'partial' ? 'AUTH_REQUIRED' : 'READY'
    return { state, checkedAt: new Date().toISOString(), refreshing: false, model: 'gpt-6-luna', reasoningEffort: 'low',
      cliVersion: '0.163.0', queued: scenario === 'scanning' ? 2 : 0, running: scenario === 'scanning' ? 1 : 0,
      limits: state === 'READY' ? { primary: { usedPercent: 36, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 }, secondary: { usedPercent: 60, windowDurationMins: 10080, resetsAt: Math.floor(Date.now() / 1000) + 86400 } } : null }
  }
  return apiRequest<GenerationStatus>(`/api/v1/generation-agent/status${refresh ? '/refresh' : ''}`, {
    method: refresh ? 'POST' : 'GET', signal: signal ?? null,
  })
}
