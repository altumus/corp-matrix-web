import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'
import type { DeviceInfo, KeyBackupInfo } from '../types.js'

export async function getDeviceList(): Promise<DeviceInfo[]> {
  const client = getMatrixClient()
  if (!client) return []

  const userId = client.getUserId()
  if (!userId) return []

  const devices = await client.getDevices()
  const crypto = client.getCrypto()
  const currentDeviceId = client.getDeviceId()

  const result: DeviceInfo[] = []

  for (const device of devices.devices) {
    let trustLevel: DeviceInfo['trustLevel'] = 'unverified'

    if (crypto) {
      try {
        const trust = await crypto.getDeviceVerificationStatus(userId, device.device_id)
        if (trust && trust.isVerified()) {
          trustLevel = 'verified'
        }
      } catch {
        // ignore
      }
    }

    result.push({
      deviceId: device.device_id,
      displayName: device.display_name ?? null,
      lastSeenIp: device.last_seen_ip ?? null,
      lastSeenTs: device.last_seen_ts ?? null,
      trustLevel,
      isCurrentDevice: device.device_id === currentDeviceId,
    })
  }

  return result
}

export async function getKeyBackupInfo(): Promise<KeyBackupInfo> {
  const client = getMatrixClient()
  if (!client) {
    return { enabled: false, version: null, keysBackedUp: 0, totalKeys: 0 }
  }

  try {
    const crypto = client.getCrypto()
    if (!crypto) {
      return { enabled: false, version: null, keysBackedUp: 0, totalKeys: 0 }
    }

    const backupInfo = await crypto.checkKeyBackupAndEnable()
    if (!backupInfo) {
      return { enabled: false, version: null, keysBackedUp: 0, totalKeys: 0 }
    }

    return {
      enabled: true,
      version: (backupInfo as unknown as Record<string, unknown>).version as string ?? null,
      keysBackedUp: 0,
      totalKeys: 0,
    }
  } catch {
    return { enabled: false, version: null, keysBackedUp: 0, totalKeys: 0 }
  }
}

export async function setupKeyBackup(): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const crypto = client.getCrypto()
  if (!crypto) throw new Error('Crypto not initialized')

  const existing = await crypto.getActiveSessionBackupVersion()
  if (existing) {
    throw new Error('BACKUP_EXISTS')
  }

  await crypto.resetKeyBackup()
}

export async function startVerification(userId: string, deviceId: string): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const crypto = client.getCrypto()
  if (!crypto) throw new Error('Crypto not initialized')

  await crypto.requestDeviceVerification(userId, deviceId)
}

export async function requestOwnUserVerification(): Promise<VerificationRequest> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const crypto = client.getCrypto()
  if (!crypto) throw new Error('Crypto not initialized')

  return await crypto.requestOwnUserVerification()
}
