export interface AuthUser {
  userId: string
  displayName?: string
  avatarUrl?: string | null
}

export interface LoginCredentials {
  homeserver: string
  username: string
  password: string
}

export interface RegisterCredentials {
  homeserver: string
  username: string
  password: string
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'needs_key_restore' | 'unauthenticated'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  homeserver: string

  setHomeserver: (url: string) => void
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  restoreSession: () => Promise<void>
  logout: () => Promise<void>
  completeKeyRestore: () => void
  clearError: () => void
}
