export interface NotificationSettings {
  desktopEnabled: boolean
  soundEnabled: boolean
  notifyRunCompleted: boolean
  notifyRunPaused: boolean
  notifyAttentionRequired: boolean
  notifyRelevanceCompleted: boolean
  notifyMarketCompleted: boolean
}

export interface AppSettings {
  notifications: NotificationSettings
}

export interface SettingsPageResponse {
  settings: AppSettings
}

export type TelegramConnectionStatus = 'DISCONNECTED' | 'WAITING_FOR_START' | 'PAIRING_EXPIRED' | 'CONNECTED'

export interface TelegramConnection {
  status: TelegramConnectionStatus
  botUsername: string | null
  pairingUrl: string | null
  pairingExpiresAt: string | null
  lastError: string | null
}
