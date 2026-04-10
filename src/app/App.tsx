import { RouterProvider } from 'react-router'
import { Providers } from './providers.js'
import { router } from './router.js'
import { ErrorBoundary } from '../shared/ui/index.js'

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  )
}
