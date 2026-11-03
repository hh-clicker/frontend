export type AuthorizationStatus = 'AUTHORIZED' | 'REQUIRED' | 'UNKNOWN'

export interface HhAccount {
  id: string
  name: string
  hhUserId: string | null
  authorizationStatus: AuthorizationStatus
  createdAt: string
  updatedAt: string
}

export interface CreateAccountRequest {
  name: string
  hhUserId: null
}
