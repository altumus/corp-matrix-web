import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore.js'

export function useSession() {
  const { status, restoreSession } = useAuthStore()

  useEffect(() => {
    if (status === 'idle') {
      restoreSession()
    }
  }, [status, restoreSession])

  return { status }
}
