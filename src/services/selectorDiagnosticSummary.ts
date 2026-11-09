import type { SelectorDiagnosticReport } from '../api/contracts/browser'

export function selectorDiagnosticSummary(report: SelectorDiagnosticReport): 'PASSED' | 'FAILED' | 'INCOMPLETE' {
  const children = (report.scenarios ?? []).map(selectorDiagnosticSummary)
  if (report.status === 'BLOCKED' || report.rows.some(row => row.status === 'FAIL') || children.includes('FAILED')) return 'FAILED'
  if (report.status !== 'CHECKED' || report.rows.some(row => row.status === 'NOT_CHECKED') || children.includes('INCOMPLETE')) return 'INCOMPLETE'
  return 'PASSED'
}

/** Replace one checked step without discarding the other diagnostic snapshots. */
export function mergeSelectorDiagnosticRepair(previous: SelectorDiagnosticReport | null,
  step: SelectorDiagnosticReport, result: SelectorDiagnosticReport): SelectorDiagnosticReport {
  if (result.pageType === 'FULL' || previous?.pageType !== 'FULL' || !previous.scenarios) return result
  const index = previous.scenarios.findIndex(item => item.pageType === step.pageType && item.tabId === step.tabId)
  if (index < 0 || result.pageType !== step.pageType) return previous
  const scenarios = previous.scenarios.map((item, position) => position === index
    ? { ...result, contextLabel: item.contextLabel ?? result.contextLabel } : item)
  const merged = { ...previous, checkedAt: result.checkedAt, scenarios }
  merged.summary = selectorDiagnosticSummary(merged)
  merged.message = merged.summary === 'PASSED' ? 'Все доступные сценарии чтения прошли проверку. Формы отклика автоматически не открывались.'
    : merged.summary === 'FAILED' ? 'Обнаружены проблемы. Смотрите результаты отдельных сценариев.'
      : 'Диагностика выполнена частично. Для непроверенных шагов указаны причины.'
  return merged
}
