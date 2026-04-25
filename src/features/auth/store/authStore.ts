import { create } from 'zustand'
import { getMatrixClient, saveRecoveryKey, loadRecoveryKey, setSecretStorageKey, clearSession, isRecoveryKeyAcknowledged, setRecoveryKeyAcknowledged } from '../../../shared/lib/matrixClient.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'
import { encodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js'
import type { AuthState, AuthStatus } from '../types.js'
import {
  loginWithPassword,
  loginWithSsoToken,
  registerAccount,
  restoreExistingSession,
  logoutSession,
} from '../services/authService.js'

function waitForInitialSync(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve) => {
    const client = getMatrixClient()
    if (!client) { resolve(); return }

    const currentState = client.getSyncState()
    if (currentState === SyncState.Prepared || currentState === SyncState.Syncing) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      client.removeListener(ClientEvent.Sync, onSync)
      resolve()
    }, timeoutMs)

    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        clearTimeout(timer)
        client.removeListener(ClientEvent.Sync, onSync)
        resolve()
      }
    }

    client.on(ClientEvent.Sync, onSync)
  })
}

async function ensureKeyBackup(): Promise<string | null> {
  const client = getMatrixClient()
  const crypto = client?.getCrypto()
  if (!crypto) return null

  try {
    await crypto.checkKeyBackupAndEnable()
    const activeVersion = await crypto.getActiveSessionBackupVersion()
    if (activeVersion) return null // backup already active

    const backupInfo = await crypto.getKeyBackupInfo()
    if (backupInfo?.version) return null // backup exists but needs restore — don't auto-create

    // No backup at all — create one and persist the recovery key
    await crypto.resetKeyBackup()

    // Generate and persist recovery key for automatic restore on future logins
    try {
      const recoveryKey = await crypto.createRecoveryKeyFromPassphrase()
      if (recoveryKey.privateKey) {
        await saveRecoveryKey(recoveryKey.privateKey)
        // Store it in secret storage so other devices can access it
        setSecretStorageKey(recoveryKey.privateKey)
        await crypto.bootstrapSecretStorage({
          createSecretStorageKey: () => Promise.resolve(recoveryKey),
          setupNewSecretStorage: true,
        })
        return recoveryKey.encodedPrivateKey ?? encodeRecoveryKey(recoveryKey.privateKey) ?? null
      }
    } catch {
      // Recovery key generation failed — backup still works for current device
    }
  } catch {
    // best-effort — don't block auth
  }
  return null
}

// NOTE: cleanup is no longer automatic — moved to manual UI in DevicesSettings
// to avoid surprising users by killing their other sessions.
async function cleanupOldDevices(): Promise<void> {
  // intentionally no-op — keep function signature for backwards compat
}

async function bootstrapCrossSigning(setupNew = true): Promise<void> {
  const client = getMatrixClient()
  const crypto = client?.getCrypto()
  if (!crypto) return

  try {
    if (setupNew) {
      const crossSigningStatus = await crypto.getCrossSigningStatus()
      if (crossSigningStatus.privateKeysInSecretStorage) return // already set up
    }

    await crypto.bootstrapCrossSigning({
      setupNewCrossSigning: setupNew,
    })
  } catch {
    // best-effort — cross-signing may not be supported
  }
}

interface PostAuthResult {
  status: AuthStatus
  pendingRecoveryKey?: string | null
}

async function resolvePostAuthStatus(isNewAccount = false): Promise<PostAuthResult> {
  try {
    await waitForInitialSync(30_000)

    const client = getMatrixClient()
    const crypto = client?.getCrypto()
    if (!crypto) return { status: 'authenticated' }

    // For new accounts — bootstrap cross-signing and create key backup
    if (isNewAccount) {
      await bootstrapCrossSigning()
      const newKey = await ensureKeyBackup()
      cleanupOldDevices()
      if (newKey) return { status: 'show_recovery_key', pendingRecoveryKey: newKey }
      return { status: 'authenticated' }
    }

    // Try to load cached recovery key from IndexedDB (saved during backup creation)
    const cachedKey = await loadRecoveryKey()
    if (cachedKey) {
      setSecretStorageKey(cachedKey)
    }

    // For existing accounts — bootstrap cross-signing with existing keys
    // (setupNew=false: uses keys from SSSS, doesn't create new ones)
    // This cross-signs the current device so other clients (FluffyChat/Element)
    // see it as verified.
    await bootstrapCrossSigning(false)

    await crypto.checkKeyBackupAndEnable()

    const activeVersion = await crypto.getActiveSessionBackupVersion()
    if (activeVersion) {
      cleanupOldDevices()
      return resolveAcknowledgedOrShowKey(cachedKey)
    }

    // Backup exists but not active for this device — try auto-restore
    const backupInfo = await crypto.getKeyBackupInfo()
    if (backupInfo?.version) {
      try {
        await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
        await crypto.checkKeyBackupAndEnable()
        const nowActive = await crypto.getActiveSessionBackupVersion()
        if (nowActive) {
          cleanupOldDevices()
          return resolveAcknowledgedOrShowKey(cachedKey)
        }
      } catch {
        // Could not auto-restore — show the restore screen
      }
      return { status: 'needs_key_restore' }
    }

    // No backup exists — auto-create one
    const newKey = await ensureKeyBackup()
    cleanupOldDevices()
    if (newKey) return { status: 'show_recovery_key', pendingRecoveryKey: newKey }
  } catch {
    // crypto not available — proceed
  }
  return { status: 'authenticated' }
}

// If a backup is active and we have the local key but the user never confirmed
// they saved it (e.g. closed the tab during register) — re-show the screen.
async function resolveAcknowledgedOrShowKey(cachedKey: Uint8Array | null): Promise<PostAuthResult> {
  if (!cachedKey) return { status: 'authenticated' }
  if (await isRecoveryKeyAcknowledged()) return { status: 'authenticated' }
  const encoded = encodeRecoveryKey(cachedKey)
  if (!encoded) return { status: 'authenticated' }
  return { status: 'show_recovery_key', pendingRecoveryKey: encoded }
}

let syncGuardInstalled = false

function installSyncErrorGuard(set: (s: Partial<AuthState>) => void) {
  if (syncGuardInstalled) return
  syncGuardInstalled = true

  const client = getMatrixClient()
  if (!client) return

  const onSyncError = async (state: SyncState) => {
    if (state === SyncState.Error) {
      try {
        await client.whoami()
      } catch {
        // Token invalid — notify user before force logout
        const { toast } = await import('../../../shared/ui/Toast/toastService.js')
        toast('Сессия истекла. Необходимо войти снова.', 'error', 10000)
        try {
          const { clearQueue } = await import('../../messaging/services/sendQueue.js')
          await clearQueue()
        } catch { /* best-effort */ }
        await clearSession()
        set({ user: null, status: 'unauthenticated' })
      }
    }
  }

  client.on(ClientEvent.Sync, onSyncError)
}

// When user clicks "Skip for now", prevent resolvePostAuthStatus from
// overwriting status back to 'needs_key_restore'
let keyRestoreSkipped = false

function applyPostAuth(set: (s: Partial<AuthState>) => void, result: PostAuthResult) {
  if (result.status === 'needs_key_restore' && !keyRestoreSkipped) {
    set({ status: 'needs_key_restore' })
  } else if (result.status === 'show_recovery_key' && result.pendingRecoveryKey) {
    set({ status: 'show_recovery_key', pendingRecoveryKey: result.pendingRecoveryKey })
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  error: null,
  homeserver: import.meta.env.VITE_MATRIX_HOMESERVER_URL || '',
  pendingRecoveryKey: null,

  setHomeserver: (url: string) => set({ homeserver: url }),

  login: async (credentials) => {
    set({ status: 'loading', error: null, pendingRecoveryKey: null })
    keyRestoreSkipped = false
    try {
      const user = await loginWithPassword(credentials)
      set({ status: 'authenticated', user, error: null })
      installSyncErrorGuard(set)
      resolvePostAuthStatus().then((r) => applyPostAuth(set, r))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  loginWithSso: async (homeserverUrl, loginToken) => {
    set({ status: 'loading', error: null, pendingRecoveryKey: null })
    keyRestoreSkipped = false
    try {
      const user = await loginWithSsoToken(homeserverUrl, loginToken)
      set({ status: 'authenticated', user, error: null })
      installSyncErrorGuard(set)
      resolvePostAuthStatus().then((r) => applyPostAuth(set, r))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'SSO login failed'
      set({ status: 'unauthenticated', error: message })
    }
  },

  register: async (credentials) => {
    set({ status: 'loading', error: null, pendingRecoveryKey: null })
    keyRestoreSkipped = false
    try {
      const user = await registerAccount(credentials)
      set({ status: 'authenticated', user, error: null })
      installSyncErrorGuard(set)
      resolvePostAuthStatus(true).then((r) => applyPostAuth(set, r))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  restoreSession: async () => {
    set({ status: 'loading', error: null, pendingRecoveryKey: null })
    keyRestoreSkipped = false
    try {
      const user = await restoreExistingSession()
      if (user) {
        set({ status: 'authenticated', user })
        installSyncErrorGuard(set)
        resolvePostAuthStatus().then((r) => applyPostAuth(set, r))
      } else {
        set({ status: 'unauthenticated' })
      }
    } catch {
      set({ status: 'unauthenticated' })
    }
  },

  logout: async () => {
    keyRestoreSkipped = false
    // Clear offline send queue to prevent cross-account message leaks
    try {
      const { clearQueue } = await import('../../messaging/services/sendQueue.js')
      await clearQueue()
    } catch { /* best-effort */ }
    await logoutSession()
    set({ status: 'unauthenticated', user: null, error: null, pendingRecoveryKey: null })
  },

  completeKeyRestore: () => {
    keyRestoreSkipped = true
    set({ status: 'authenticated' })
    // User just typed the recovery key — they obviously have it,
    // so don't pester them with the welcome screen on next login.
    setRecoveryKeyAcknowledged().catch(() => { /* best-effort */ })
  },

  acknowledgeRecoveryKey: async () => {
    try {
      await setRecoveryKeyAcknowledged()
    } catch {
      // best-effort — proceed even if persistence fails
    }
    set({ status: 'authenticated', pendingRecoveryKey: null })
  },

  clearError: () => set({ error: null }),
}))
