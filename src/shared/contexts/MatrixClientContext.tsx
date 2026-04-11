import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { MatrixClient } from 'matrix-js-sdk'
import { getMatrixClient } from '../lib/matrixClient.js'
import { useAuthStore } from '../../features/auth/store/authStore.js'

const MatrixClientContext = createContext<MatrixClient | null>(null)

interface ProviderProps {
  children: ReactNode
}

/**
 * Provides the active Matrix client through React Context.
 * Reactively re-reads the singleton when auth status changes (login/logout).
 */
export function MatrixClientProvider({ children }: ProviderProps) {
  const status = useAuthStore((s) => s.status)
  const [client, setClient] = useState<MatrixClient | null>(getMatrixClient())

  useEffect(() => {
    // Re-read singleton when auth status changes
    setClient(getMatrixClient())
  }, [status])

  return (
    <MatrixClientContext.Provider value={client}>
      {children}
    </MatrixClientContext.Provider>
  )
}

/**
 * Returns the active Matrix client.
 * - Inside React tree: reads from Context (reactive to auth changes)
 * - Outside React tree (services, helpers): falls back to singleton
 */
export function useMatrixClient(): MatrixClient | null {
  const ctx = useContext(MatrixClientContext)
  return ctx ?? getMatrixClient()
}
