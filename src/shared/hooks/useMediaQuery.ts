import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useIsTouchDevice(): boolean {
  const [isTouch] = useState(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    return hasTouch && isMobileUA
  })
  return isTouch
}

export function useIsMobile() {
  const narrow = useMediaQuery('(max-width: 767px)')
  const touch = useIsTouchDevice()
  return narrow && touch
}

export function useIsTablet() {
  const medium = useMediaQuery('(max-width: 1024px)')
  const touch = useIsTouchDevice()
  return medium && touch
}
