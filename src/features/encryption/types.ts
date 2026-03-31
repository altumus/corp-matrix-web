export type DeviceTrustLevel = 'verified' | 'unverified' | 'blocked'

export interface DeviceInfo {
  deviceId: string
  displayName: string | null
  lastSeenIp: string | null
  lastSeenTs: number | null
  trustLevel: DeviceTrustLevel
  isCurrentDevice: boolean
}

export interface KeyBackupInfo {
  enabled: boolean
  version: string | null
  keysBackedUp: number
  totalKeys: number
}

export type VerificationMethod = 'emoji' | 'qr'

export interface VerificationState {
  inProgress: boolean
  method: VerificationMethod | null
  emoji: Array<{ emoji: string; description: string }> | null
  qrCodeData: string | null
}
