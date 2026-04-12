import { create } from 'zustand'
import { getMatrixClient, saveRecoveryKey, loadRecoveryKey, setSecretStorageKey, clearSession } from '../../../shared/lib/matrixClient.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'
import type { AuthState, AuthStatus } from '../types.js'
import {
  loginWithPassword,
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

async function ensureKeyBackup(): Promise<void> {
  const client = getMatrixClient()
  const crypto = client?.getCrypto()
  if (!crypto) return

  try {
    await crypto.checkKeyBackupAndEnable()
    const activeVersion = await crypto.getActiveSessionBackupVersion()
    if (activeVersion) return // backup already active

    const backupInfo = await crypto.getKeyBackupInfo()
    if (backupInfo?.version) return // backup exists but needs restore — don't auto-create

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
      }
    } catch {
      // Recovery key generation failed — backup still works for current device
    }
  } catch {
    // best-effort — don't block auth
  }
}

// NOTE: cleanup is no longer automatic — moved to manual UI in DevicesSettings
// to avoid surprising users by killing their other sessions.
async function cleanupOldDevices(): Promise<void> {
  // intentionally no-op — keep function signature for backwards compat
}

async function bootstrapCrossSigning(): Promise<void> {
  const client = getMatrixClient()
  const crypto = client?.getCrypto()
  if (!crypto) return

  try {
    const crossSigningStatus = await crypto.getCrossSigningStatus()
    if (crossSigningStatus.privateKeysInSecretStorage) return // already set up

    await crypto.bootstrapCrossSigning({
      setupNewCrossSigning: true,
    })
  } catch {
    // best-effort — cross-signing may not be supported
  }
}

async function resolvePostAuthStatus(isNewAccount = false): Promise<AuthStatus> {
  try {
    await waitForInitialSync(30_000)

    const client = getMatrixClient()
    const crypto = client?.getCrypto()
    if (!crypto) return 'authenticated'

    // For new accounts — bootstrap cross-signing and create key backup
    if (isNewAccount) {
      await bootstrapCrossSigning()
      await ensureKeyBackup()
      cleanupOldDevices()
      return 'authenticated'
    }

    // Try to load cached recovery key from IndexedDB (saved during backup creation)
    const cachedKey = await loadRecoveryKey()
    if (cachedKey) {
      setSecretStorageKey(cachedKey)
    }

    // For existing accounts — check backup status
    await crypto.checkKeyBackupAndEnable()

    const activeVersion = await crypto.getActiveSessionBackupVersion()
    if (activeVersion) {
      cleanupOldDevices()
      return 'authenticated'
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
          return 'authenticated'
        }
      } catch {
        // Could not auto-restore — show the restore screen
      }
      return 'needs_key_restore'
    }

    // No backup exists — auto-create one
    await ensureKeyBackup()
    cleanupOldDevices()
  } catch {
    // crypto not available — proceed
  }
  return 'authenticated'
}

function installSyncErrorGuard(set: (s: Partial<AuthState>) => void) {
  const client = getMatrixClient()
  if (!client) return

  const onSyncError = async (state: SyncState) => {
    if (state === SyncState.Error) {
      try {
        await client.whoami()
      } catch {
        // Token invalid — force logout
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

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  error: null,
  homeserver: import.meta.env.VITE_MATRIX_HOMESERVER_URL || '',

  setHomeserver: (url: string) => set({ homeserver: url }),

  login: async (credentials) => {
    set({ status: 'loading', error: null })
    keyRestoreSkipped = false
    try {
      const user = await loginWithPassword(credentials)
      set({ status: 'authenticated', user, error: null })
      installSyncErrorGuard(set)
      resolvePostAuthStatus().then((s) => {
        if (s === 'needs_key_restore' && !keyRestoreSkipped) set({ status: s })
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  register: async (credentials) => {
    set({ status: 'loading', error: null })
    keyRestoreSkipped = false
    try {
      const user = await registerAccount(credentials)
      set({ status: 'authenticated', user, error: null })
      installSyncErrorGuard(set)
      resolvePostAuthStatus(true).then((s) => {
        if (s === 'needs_key_restore' && !keyRestoreSkipped) set({ status: s })
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  restoreSession: async () => {
    set({ status: 'loading', error: null })
    keyRestoreSkipped = false
    try {
      const user = await restoreExistingSession()
      if (user) {
        set({ status: 'authenticated', user })
        installSyncErrorGuard(set)
        resolvePostAuthStatus().then((s) => {
          if (s === 'needs_key_restore' && !keyRestoreSkipped) set({ status: s })
        })
      } else {
        set({ status: 'unauthenticated' })
      }
    } catch {
      set({ status: 'unauthenticated' })
    }
  },

  logout: async () => {
    keyRestoreSkipped = false
    await logoutSession()
    set({ status: 'unauthenticated', user: null, error: null })
  },

  completeKeyRestore: () => {
    keyRestoreSkipped = true
    set({ status: 'authenticated' })
  },

  clearError: () => set({ error: null }),
}))
