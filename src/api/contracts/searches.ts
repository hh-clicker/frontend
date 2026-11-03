export type SearchStatus = 'ACTIVE' | 'PAUSED' | 'SCANNING' | 'ERROR'

export interface SearchScanProgress {
  startedAt: string
  currentPage: number
  totalPages: number | null
  collected: number
  totalResults: number | null
}

export interface SearchDefinition {
  id: string
  name: string
  sourceUrl: string
  resumeId: string
  resumeName: string
  pagesLimit: number
  status: SearchStatus
  newVacancies: number
  totalVacancies: number
  createdAt: string
  lastScannedAt: string | null
  lastError: string | null
  scanProgress: SearchScanProgress | null
}

export interface CreateSearchRequest {
  name: string
  sourceUrl: string
  resumeId: string
  resumeName: string
  pagesLimit: number
}

export interface ParsedHhSearchUrl {
  resumeId: string | null
  area: string | null
  searchFields: string[]
  filtersCount: number
}

export type UpdateSearchRequest = Pick<CreateSearchRequest, 'name' | 'sourceUrl' | 'pagesLimit'>
