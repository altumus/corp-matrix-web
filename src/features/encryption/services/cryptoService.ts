import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'
import { ImportRoomKeyStage } from 'matrix-js-sdk/lib/crypto-api/index.js'
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

/**
 * After device verification, wait for the verified device to gossip the backup
 * decryption key via m.secret.send to-device events. These arrive during sync
 * cycles, so we poll until the backup becomes active or timeout.
 */
export async function waitForBackupAfterVerification(timeoutMs = 30_000): Promise<boolean> {
  const client = getMatrixClient()
  const crypto = client?.getCrypto()
  if (!crypto || !client) return false

  // Already active?
  try {
    const active = await crypto.getActiveSessionBackupVersion()
    if (active) return true
  } catch { /* ignore */ }

  const CHECK_INTERVAL = 3_000
  const maxAttempts = Math.ceil(timeoutMs / CHECK_INTERVAL)

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, CHECK_INTERVAL))

    // Try loading backup key from SSSS (works if the SSSS key was gossiped)
    try {
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
    } catch { /* ignore — key might not be in SSSS yet */ }

    try {
      await crypto.checkKeyBackupAndEnable()
      const active = await crypto.getActiveSessionBackupVersion()
      if (active) return true
    } catch { /* ignore */ }
  }

  return false
}

export async function requestOwnUserVerification(): Promise<VerificationRequest> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const crypto = client.getCrypto()
  if (!crypto) throw new Error('Crypto not initialized')

  return await crypto.requestOwnUserVerification()
}

/**
 * Decrypt a megolm key export file (the format used by Element/FluffyChat).
 * Format: "-----BEGIN MEGOLM SESSION DATA-----" + base64 + "-----END..."
 * Encryption: PBKDF2-SHA-512 → AES-256-CTR + HMAC-SHA-256
 */
async function decryptMegolmKeyExport(data: string, passphrase: string): Promise<string> {
  // Strip PEM-like header/footer
  const lines = data.split('\n').map((l) => l.trim())
  const start = lines.findIndex((l) => l.includes('BEGIN MEGOLM SESSION DATA'))
  const end = lines.findIndex((l) => l.includes('END MEGOLM SESSION DATA'))
  if (start === -1 || end === -1) throw new Error('Invalid key export format')

  const base64 = lines.slice(start + 1, end).join('')
  const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  // Parse binary: version(1) + salt(16) + iv(16) + rounds(4) + ciphertext(...) + hmac(32)
  if (buf[0] !== 1) throw new Error(`Unsupported export version: ${buf[0]}`)
  const salt = buf.slice(1, 17)
  const iv = buf.slice(17, 33)
  const rounds = new DataView(buf.buffer, buf.byteOffset + 33, 4).getUint32(0, false)
  const ciphertext = buf.slice(37, buf.length - 32)
  const hmacExpected = buf.slice(buf.length - 32)

  // Derive key: PBKDF2-SHA-512 → 64 bytes (32 AES + 32 HMAC)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-512' }, keyMaterial, 512),
  )
  const aesKeyBuf = derived.slice(0, 32)
  const hmacKeyBuf = derived.slice(32)

  // Verify HMAC-SHA-256 over everything except the HMAC itself
  const hmacKey = await crypto.subtle.importKey('raw', hmacKeyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const dataToVerify = buf.slice(0, buf.length - 32)
  const hmacValid = await crypto.subtle.verify('HMAC', hmacKey, hmacExpected, dataToVerify)
  if (!hmacValid) throw new Error('Неверный пароль или повреждённый файл')

  // Decrypt AES-CTR-256
  const aesKey = await crypto.subtle.importKey('raw', aesKeyBuf, 'AES-CTR', false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CTR', counter: iv, length: 64 }, aesKey, ciphertext)
  return new TextDecoder().decode(decrypted)
}

export async function importRoomKeysFromFile(file: File, passphrase: string): Promise<number> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')
  const crypto = client.getCrypto()
  if (!crypto) throw new Error('Crypto not initialized')

  const text = await file.text()
  let jsonText: string

  if (text.includes('BEGIN MEGOLM SESSION DATA')) {
    // Encrypted export (FluffyChat / Element format) — decrypt with passphrase
    if (!passphrase) throw new Error('Файл зашифрован — введите пароль')
    jsonText = await decryptMegolmKeyExport(text, passphrase)
  } else {
    // Plain JSON export
    jsonText = text
  }

  let imported = 0
  await crypto.importRoomKeysAsJson(jsonText, {
    progressCallback: (stage) => {
      if (stage.stage === ImportRoomKeyStage.LoadKeys) {
        imported = stage.successes
      }
    },
  })
  return imported
}
