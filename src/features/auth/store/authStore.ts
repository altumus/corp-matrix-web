import { create } from 'zustand'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { ClientEvent, SyncState } from 'matrix-js-sdk'
import type { AuthState, AuthStatus } from '../types.js'
import {
  loginWithPassword,
  registerAccount,
  restoreExistingSession,
  logoutSession,
} from '../services/authService.js'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

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

async function resolvePostAuthStatus(): Promise<AuthStatus> {
  const result = await withTimeout(resolvePostAuthStatusInner(), 12_000)
  return result ?? 'authenticated'
}

async function resolvePostAuthStatusInner(): Promise<AuthStatus> {
  try {
    await waitForInitialSync()

    const client = getMatrixClient()
    const crypto = client?.getCrypto()
    if (!crypto) return 'authenticated'

    await crypto.checkKeyBackupAndEnable()

    const activeVersion = await crypto.getActiveSessionBackupVersion()
    if (activeVersion) return 'authenticated'

    const backupInfo = await crypto.getKeyBackupInfo()
    if (backupInfo?.version) return 'needs_key_restore'
  } catch {
    // crypto not available or check failed — proceed normally
  }
  return 'authenticated'
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  error: null,
  homeserver: import.meta.env.VITE_MATRIX_HOMESERVER_URL || '',

  setHomeserver: (url: string) => set({ homeserver: url }),

  login: async (credentials) => {
    set({ status: 'loading', error: null })
    try {
      const user = await loginWithPassword(credentials)
      set({ status: 'authenticated', user, error: null })
      resolvePostAuthStatus().then((s) => {
        if (s === 'needs_key_restore') set({ status: s })
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  register: async (credentials) => {
    set({ status: 'loading', error: null })
    try {
      const user = await registerAccount(credentials)
      set({ status: 'authenticated', user, error: null })
      resolvePostAuthStatus().then((s) => {
        if (s === 'needs_key_restore') set({ status: s })
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'auth.errors.unknownError'
      set({ status: 'unauthenticated', error: message })
    }
  },

  restoreSession: async () => {
    set({ status: 'loading', error: null })
    try {
      const user = await restoreExistingSession()
      if (user) {
        set({ status: 'authenticated', user })
        resolvePostAuthStatus().then((s) => {
          if (s === 'needs_key_restore') set({ status: s })
        })
      } else {
        set({ status: 'unauthenticated' })
      }
    } catch {
      set({ status: 'unauthenticated' })
    }
  },

  logout: async () => {
    await logoutSession()
    set({ status: 'unauthenticated', user: null, error: null })
  },

  completeKeyRestore: () => set({ status: 'authenticated' }),

  clearError: () => set({ error: null }),
}))
