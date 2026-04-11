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
    // Errors always go through — caught by ErrorBoundary or Sentry in prod
    console.error(...args)
  },
}
