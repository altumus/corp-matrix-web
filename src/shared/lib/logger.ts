/**
 * Conditional logger — outputs only in development.
 * In production builds these calls become no-ops (Vite tree-shakes them).
 */
const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args)
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error('[Corp Matrix]', ...args)
  },
}
