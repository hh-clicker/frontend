export type AgentStatus = 'OFFLINE' | 'CONNECTING' | 'READY' | 'BUSY'
export type AuthorizationStatus = 'AUTHORIZED' | 'REQUIRED' | 'UNKNOWN'
export type SearchStatus = 'ACTIVE' | 'PAUSED'
export type AttentionKind = 'QUESTIONNAIRE' | 'CAPTCHA' | 'AUTH' | 'ERROR'

export interface AccountOption {
  id: string
  name: string
}

export interface ResumeOption {
  id: string
  name: string
}

export interface OverviewMetric {
  id: 'new' | 'selected' | 'succeeded' | 'attention' | 'limit'
  label: string
  value: number
  hint: string
  tone: 'purple' | 'blue' | 'green' | 'orange'
}

export interface RecentSearch {
  id: string
  name: string
  createdAt: string
  newVacancies: number
  status: SearchStatus
}

export interface AttentionItem {
  id: string
  vacancy: string
  company: string
  kind: AttentionKind
  occurredAt: string
}

export interface ActiveRunSummary {
  id: string
  sequence: number
  status: 'RUNNING' | 'PAUSED_USER' | 'PAUSED_CAPTCHA' | 'PAUSED_AUTH' | 'PAUSED_ERROR' | 'PAUSED_LIMIT' | 'PAUSED_AI_LIMIT'
  processed: number
  total: number
  succeeded: number
  attention: number
  failed: number
}

export interface OverviewResponse {
  accounts: AccountOption[]
  selectedAccountId: string | null
  resumes: ResumeOption[]
  selectedResumeId: string | null
  agentStatus: AgentStatus
  authorizationStatus: AuthorizationStatus
  activeRun: ActiveRunSummary | null
  metrics: OverviewMetric[]
  recentSearches: RecentSearch[]
  attentionItems: AttentionItem[]
}
