import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../features/auth/store/authStore.js'

const STORAGE_KEY = 'corp-matrix-idle-timeout'
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']

export function getIdleTimeout(): number {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    const n = parseInt(stored, 10)
    return isNaN(n) ? 0 : n
  }
  // Default: disabled (0)
  return 0
}

export function setIdleTimeout(ms: number): void {
  // Always persist — including 0 (disabled), so the setting survives reload
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, ms)))
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
