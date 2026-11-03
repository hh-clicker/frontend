import type { AgentStatus, AuthorizationStatus } from './overview'

export type BrowserProcessStatus = 'STOPPED' | 'STARTING' | 'RUNNING'

export interface BrowserProfile {
  id: string
  tags: string[]
  accountId: string
  processStatus: BrowserProcessStatus
  createdAt: string
  lastStartedAt: string | null
  profileDirectory: string
}

export interface BrowserAgentDetails {
  status: AgentStatus
  authorizationStatus: AuthorizationStatus
  version: string
  endpoint: string
  host: string
  browserVersion: string
}

export interface BrowserAgentStatusResponse {
  agentId: string | null
  version: string | null
  status: AgentStatus
  lastHeartbeatAt: string | null
  offlineAfterSeconds: number
  browserOpen: boolean
  activeProfileId: string | null
}

export type BrowserAgentCommandStatus = 'QUEUED' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED'

export interface BrowserAuthorizationResult {
  status: AuthorizationStatus
  message: string | null
}

export interface DiscoveredResume {
  hhResumeId: string
  name: string
  plainText?: string | null
}

export interface BrowserAgentCommandResponse {
  id: string
  type: 'OPEN_BROWSER' | 'OPEN_URL' | 'CLOSE_BROWSER' | 'CHECK_AUTHORIZATION' | 'DISCOVER_RESUMES' | 'SCAN_SEARCH' | 'INSPECT_APPLICATION' | 'APPLY_VACANCY'
  status: BrowserAgentCommandStatus
  agentId: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  authorization?: BrowserAuthorizationResult | null
  resumes?: DiscoveredResume[] | null
  application?: import('./applications').ApplicationOutcome | null
}

export interface BrowserCommandReceiptResponse {
  commandId: string
}

export interface BrowserPageResponse {
  agent: BrowserAgentDetails
  profile: BrowserProfile | null
}
