import { type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '../hooks/useSession.js'
import { KeyRestoreScreen } from '../../encryption/components/KeyRestoreScreen.js'
import { Spinner } from '../../../shared/ui/index.js'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { status } = useSession()

  if (status === 'idle' || status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <Spinner size={40} />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (status === 'needs_key_restore') {
    return <KeyRestoreScreen />
  }

  return <>{children}</>
}
