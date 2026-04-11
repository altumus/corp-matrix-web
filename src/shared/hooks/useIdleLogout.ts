import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore.js'

const STORAGE_KEY = 'corp-matrix-idle-timeout'
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']

export function getIdleTimeout(): number {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const n = parseInt(stored, 10)
    if (n > 0) return n
  }
  return DEFAULT_TIMEOUT_MS
}

export function setIdleTimeout(ms: number): void {
  if (ms <= 0) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, String(ms))
  }
}

/**
 * Auto-logout after period of inactivity.
 * Pass 0 to disable.
 */
export function useIdleLogout(timeoutMs?: number): void {
  const logout = useAuthStore((s) => s.logout)
  const status = useAuthStore((s) => s.status)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return

    const ms = timeoutMs ?? getIdleTimeout()
    if (ms <= 0) return // disabled

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logout()
      }, ms)
    }

    reset()
    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, reset, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, reset)
      }
    }
  }, [logout, status, timeoutMs])
}
