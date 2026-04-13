import { useEffect } from 'react'

/**
 * Sets CSS custom property --vh to the actual visible viewport height,
 * accounting for mobile virtual keyboard. Updates on resize/keyboard open/close.
 *
 * Usage in CSS: height: calc(var(--vh, 1dvh) * 100);
 *
 * Without this, 100dvh on iOS/Android includes the area behind the keyboard,
 * pushing the composer off-screen when the keyboard opens.
 */
export function useViewportHeight() {
  useEffect(() => {
    function update() {
      // visualViewport.height excludes the keyboard area
      const vh = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`)
    }

    update()

    // visualViewport fires 'resize' when keyboard opens/closes
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)

    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
}
