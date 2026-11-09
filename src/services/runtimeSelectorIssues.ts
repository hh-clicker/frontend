import { apiRequest } from '../api/client'
import { isMockMode, getMockScenario } from '../app/runtime'
import type { SelectorDiagnosticReport } from '../api/contracts/browser'

export interface RuntimeSelectorIssue {
  commandId: string; searchId: string | null; applicationId: string | null
  completedAt: string; report: SelectorDiagnosticReport
  resolved?: boolean
  hhResumeId?: string | null
}
export async function loadRuntimeSelectorIssues(accountId: string, signal?: AbortSignal): Promise<RuntimeSelectorIssue[]> {
  if (isMockMode) {
    const [{ getSearchesMock }, { getApplicationRunsMock }, { runtimeSelectorIssuesMock }] = await Promise.all([
      import('../mocks/searches'), import('../mocks/applications'), import('../mocks/selectorDiagnostics'),
    ])
    const scenario = getMockScenario()
    return runtimeSelectorIssuesMock(getSearchesMock(scenario).map(search => search.id),
      getApplicationRunsMock(scenario).flatMap(run => run.applications.filter(item => item.status === 'FAILED').map(item => item.id)), scenario)
  }
  return apiRequest<RuntimeSelectorIssue[]>(`/api/v1/browser-agent/commands/selector-issues?accountId=${encodeURIComponent(accountId)}`, { signal: signal ?? null })
}
export { diagnosticIssueRoute } from './selectorDiagnosticEntry'
