import type { DiagnosticPageType, SelectorDiagnosticReport } from '../api/contracts/browser'

export interface DiagnosticEntry { pageType: DiagnosticPageType; fields: string; tabId: string | null; accountId: string | null }
export function parseDiagnosticEntry(query: Record<string, unknown>): DiagnosticEntry | null {
  const pageType = query.diagnostic
  if (typeof pageType !== 'string' || !['PROFILE', 'RESUME', 'SEARCH', 'VACANCY'].includes(pageType)) return null
  return { pageType: pageType as DiagnosticPageType,
    fields: typeof query.fields === 'string' ? query.fields.slice(0, 500) : '',
    tabId: typeof query.diagnosticTab === 'string' && /^[a-f0-9-]{36}$/i.test(query.diagnosticTab) ? query.diagnosticTab : null,
    accountId: typeof query.account === 'string' ? query.account : null }
}
export function diagnosticIssueRoute(issue: { report: SelectorDiagnosticReport }, accountId: string) {
  return { path: '/browser', query: { diagnostic: issue.report.pageType, account: accountId,
    ...(issue.report.tabId ? { diagnosticTab: issue.report.tabId } : {}),
    fields: issue.report.rows.filter(row => row.status === 'FAIL').map(row => row.purpose).join(', ').slice(0, 500) } }
}
export function selectorRepairReady(status: { state: string; refreshing: boolean } | null): boolean {
  return status?.state === 'READY' && !status.refreshing
}
