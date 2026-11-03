import { isMockMode } from '../app/runtime'
import { apiRequest, ApiError } from '../api/client'
import type { VacancyRelevanceCategory } from '../api/contracts/vacancies'
import { cancelMarketAnalysisMock, getMarketAnalysesMock, getMarketAnalysisPreviewMock, resumeMarketAnalysisMock, startMarketAnalysisMock, stopMarketAnalysisMock } from '../mocks/marketAnalysis'

export interface MarketAnalysisPreview {
  availableCount: number
  selectedCount: number
  earliestAttemptedAt: string | null
}

export interface MarketAnalysis {
  id: string
  resumeId: string
  resumeName: string
  searchName: string | null
  createdAt: string
  status: 'RUNNING' | 'STOPPING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  phase: 'EXTRACT' | 'COVERAGE' | 'DONE'
  processed: number
  vacancyCount: number
  companyCount: number
  periodFrom: string | null
  periodTo: string | null
  coveragePercent: number | null
  reportAvailable: boolean
  diagnosticOnly: boolean
  diagnosticCount: number
  estimatedRemainingSeconds: number | null
  reportMarkdown?: string | null
  debugReportMarkdown?: string | null
  error: string | null
}

export async function loadMarketAnalyses(resumeId: string): Promise<MarketAnalysis[]> {
  if (isMockMode) return getMarketAnalysesMock(resumeId)
  return apiRequest<MarketAnalysis[]>(`/api/v1/market-analyses?resumeId=${encodeURIComponent(resumeId)}`)
}

export async function loadMarketAnalysisPreview(resumeId: string, maxVacancies: number | null, searchId: string | null, relevanceCategory: VacancyRelevanceCategory | null = null): Promise<MarketAnalysisPreview> {
  if (isMockMode) return getMarketAnalysisPreviewMock(maxVacancies, searchId, relevanceCategory)
  const limit = maxVacancies == null ? '' : `&maxVacancies=${maxVacancies}`
  const search = searchId == null ? '' : `&searchId=${encodeURIComponent(searchId)}`
  const category = relevanceCategory == null ? '' : `&relevanceCategory=${encodeURIComponent(relevanceCategory)}`
  return apiRequest<MarketAnalysisPreview>(`/api/v1/market-analyses/preview?resumeId=${encodeURIComponent(resumeId)}${limit}${search}${category}`)
}

export async function startMarketAnalysis(resumeId: string, resumeName: string, maxVacancies: number | null, searchId: string | null, searchName: string | null, relevanceCategory: VacancyRelevanceCategory | null = null): Promise<MarketAnalysis> {
  if (isMockMode) return startMarketAnalysisMock(resumeId, resumeName, maxVacancies, searchId, searchName, relevanceCategory)
  return apiRequest<MarketAnalysis>('/api/v1/market-analyses', {
    method: 'POST', body: JSON.stringify({ resumeId, maxVacancies, searchId, relevanceCategory }),
  })
}

export async function stopMarketAnalysis(id: string): Promise<MarketAnalysis> {
  if (isMockMode) return stopMarketAnalysisMock(id)
  return apiRequest<MarketAnalysis>(`/api/v1/market-analyses/${encodeURIComponent(id)}/stop`, { method: 'POST' })
}

export async function cancelMarketAnalysis(id: string): Promise<MarketAnalysis> {
  if (isMockMode) return cancelMarketAnalysisMock(id)
  return apiRequest<MarketAnalysis>(`/api/v1/market-analyses/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export async function resumeMarketAnalysis(id: string): Promise<MarketAnalysis> {
  if (isMockMode) return resumeMarketAnalysisMock(id)
  return apiRequest<MarketAnalysis>(`/api/v1/market-analyses/${encodeURIComponent(id)}/resume`, { method: 'POST' })
}

export async function loadMarketAnalysisReport(report: MarketAnalysis, debug = false): Promise<string> {
  if (isMockMode) return debug ? report.debugReportMarkdown ?? '' : report.reportMarkdown ?? ''
  const response = await fetch(`/api/v1/market-analyses/${encodeURIComponent(report.id)}/report${debug ? '?debug=true' : ''}`)
  if (!response.ok) throw new ApiError(`Не удалось скачать отчёт: сервер вернул ${response.status}`, response.status)
  return response.text()
}
