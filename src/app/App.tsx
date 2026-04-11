import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { Providers } from './providers.js'
import { router } from './router.js'
import { ErrorBoundary } from '../shared/ui/index.js'
import { startQueueProcessor } from '../features/messaging/services/sendQueue.js'

export default function App() {
  useEffect(() => {
    startQueueProcessor()
  }, [])

  return (
    <ErrorBoundary>
      <a href="#main-content" className="sr-only sr-only-focusable">
        Перейти к содержимому
      </a>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  )
}
