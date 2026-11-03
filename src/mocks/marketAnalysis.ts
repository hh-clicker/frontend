import type { MarketAnalysis, MarketAnalysisPreview } from '../services/marketAnalysis'
import type { VacancyRelevanceCategory } from '../api/contracts/vacancies'

function exampleReport(resumeName: string, vacancyCount = 84, searchName: string | null = null): string {
  return `# Срез вакансий: ${resumeName}\n\n> Демонстрационные данные mock-режима. Не использовать для выводов о рынке.\n\nВакансий: ${vacancyCount}; компаний: ${Math.min(59, vacancyCount)}.${searchName ? ` Поиск: ${searchName}.` : ''}\n\n*Вес: первая вакансия каждой компании даёт 1, каждая следующая — в e раз меньше.\n\n## Частоты терминов\n\n### Технологии\n\n| Термин | Вакансий | Компаний | Вес* |\n| --- | ---: | ---: | ---: |\n| PostgreSQL | 12 | 10 | 10.74 |\n\n### Навыки\n\n| Термин | Вакансий | Компаний | Вес* |\n| --- | ---: | ---: | ---: |\n\n### Домены\n\n| Термин | Вакансий | Компаний | Вес* |\n| --- | ---: | ---: | ---: |\n\n## Названия вакансий в выборке\n\n${Array.from({ length: vacancyCount }, (_, index) => `- Пример вакансии №${index + 1}`).join('\n')}\n`
}

function exampleDebugReport(resumeName: string): string {
  return `# Проверочный срез вакансий: ${resumeName}\n\n> Демонстрационные данные mock-режима.\n\n## Извлечённые термины\n\n### Технологии\n\n#### PostgreSQL\n\nВакансий: 12; компаний: 10.\n\nЦитаты из вакансий:\n\n- HH 123456 · Пример компании: «Работа с PostgreSQL»\n\n## Диагностика извлечения\n\nОтклонённых элементов: 0.\n\n## Исходные тексты всех вакансий\n\n### HH 123456 · Пример вакансии · Пример компании\n\n\`\`\`\nРабота с PostgreSQL\n\`\`\`\n`
}

const reports: MarketAnalysis[] = [
  {
    id: 'market-analysis-example',
    resumeId: 'resume-marketing',
    resumeName: 'Менеджер по маркетингу',
    searchName: null,
    createdAt: '2026-10-19T12:30:00+03:00',
    status: 'COMPLETED',
    phase: 'DONE',
    processed: 84,
    vacancyCount: 84,
    companyCount: 59,
    periodFrom: '2026-09-21T10:00:00+03:00',
    periodTo: '2026-09-28T18:00:00+03:00',
    coveragePercent: null,
    reportAvailable: true,
    diagnosticOnly: true,
    diagnosticCount: 0,
    estimatedRemainingSeconds: null,
    error: null,
    reportMarkdown: exampleReport('Менеджер по маркетингу'),
    debugReportMarkdown: exampleDebugReport('Менеджер по маркетингу'),
  },
]

export function getMarketAnalysesMock(resumeId: string): MarketAnalysis[] {
  return reports.filter((report) => report.resumeId === resumeId).map((report) => ({ ...report }))
}

export function getMarketAnalysisPreviewMock(maxVacancies: number | null, searchId: string | null = null, relevanceCategory: VacancyRelevanceCategory | null = null): MarketAnalysisPreview {
  const categoryCounts: Record<VacancyRelevanceCategory, number> = searchId
    ? { TARGET: 21, ADJACENT: 12, UNKNOWN: 4, NOISE: 5 }
    : { TARGET: 44, ADJACENT: 23, UNKNOWN: 7, NOISE: 10 }
  const availableCount = searchId === 'search-django' ? 0 : relevanceCategory ? categoryCounts[relevanceCategory] : searchId ? 42 : 84
  const selectedCount = Math.min(availableCount, maxVacancies ?? availableCount)
  return { availableCount, selectedCount, earliestAttemptedAt: selectedCount ? '2026-09-21T10:00:00+03:00' : null }
}

export function startMarketAnalysisMock(resumeId: string, resumeName: string, maxVacancies: number | null, searchId: string | null, searchName: string | null, relevanceCategory: VacancyRelevanceCategory | null): MarketAnalysis {
  const preview = getMarketAnalysisPreviewMock(maxVacancies, searchId, relevanceCategory)
  const report: MarketAnalysis = {
    id: `market-analysis-${Date.now()}`,
    resumeId,
    resumeName,
    searchName,
    createdAt: new Date().toISOString(),
    status: 'RUNNING',
    phase: 'EXTRACT',
    processed: 0,
    vacancyCount: preview.selectedCount,
    companyCount: Math.min(59, preview.selectedCount),
    periodFrom: '2026-09-21T10:00:00+03:00',
    periodTo: '2026-09-28T18:00:00+03:00',
    coveragePercent: null,
    reportAvailable: false,
    diagnosticOnly: true,
    diagnosticCount: 0,
    estimatedRemainingSeconds: null,
    error: null,
    reportMarkdown: exampleReport(resumeName, preview.selectedCount, searchName),
    debugReportMarkdown: exampleDebugReport(resumeName),
  }
  reports.unshift(report)
  return { ...report }
}

export function resumeMarketAnalysisMock(id: string): MarketAnalysis {
  const report = reports.find((item) => item.id === id)
  if (!report || !['FAILED', 'PAUSED'].includes(report.status)) throw new Error('Этот анализ нельзя продолжить')
  report.status = 'RUNNING'
  report.estimatedRemainingSeconds = null
  report.error = null
  return { ...report }
}

export function stopMarketAnalysisMock(id: string): MarketAnalysis {
  const report = reports.find((item) => item.id === id)
  if (!report || report.status !== 'RUNNING') throw new Error('Этот анализ нельзя остановить')
  report.status = 'PAUSED'
  return { ...report }
}

export function cancelMarketAnalysisMock(id: string): MarketAnalysis {
  const report = reports.find((item) => item.id === id)
  if (!report || !['RUNNING', 'STOPPING', 'PAUSED'].includes(report.status)) throw new Error('Этот анализ нельзя отменить')
  report.status = 'CANCELLED'
  report.estimatedRemainingSeconds = null
  return { ...report }
}
