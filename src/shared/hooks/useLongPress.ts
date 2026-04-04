import { useCallback, useRef } from 'react'
import { useIsTouchDevice } from './useMediaQuery.js'

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent) => void
  delay?: number
}

const MOVE_THRESHOLD = 10

export function useLongPress({ onLongPress, delay = 500 }: UseLongPressOptions) {
  const isTouch = useIsTouchDevice()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPos.current = null
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      firedRef.current = false
      const touch = e.touches[0]
      startPos.current = { x: touch.clientX, y: touch.clientY }
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        navigator.vibrate?.(50)
        onLongPress(e)
      }, delay)
    },
    [onLongPress, delay],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPos.current) return
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - startPos.current.x)
      const dy = Math.abs(touch.clientY - startPos.current.y)
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        clear()
      }
    },
    [clear],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (firedRef.current) {
        e.preventDefault()
      }
      clear()
    },
    [clear],
  )

  if (!isTouch) {
    return {} as Partial<{
      onTouchStart: React.TouchEventHandler
      onTouchMove: React.TouchEventHandler
      onTouchEnd: React.TouchEventHandler
    }>
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
