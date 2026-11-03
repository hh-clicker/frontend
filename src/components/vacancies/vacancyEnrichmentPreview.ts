export interface VacancyEnrichmentPreviewData {
  conditions: Array<{ label: string; value: string }>
  application: Array<{ label: string; value: string }>
  requirements: Array<{ label: string; value: string }>
  company: Array<{ label: string; value: string; href?: string }>
  location: Array<{ label: string; value: string }>
  dates: Array<{ label: string; value: string }>
}

