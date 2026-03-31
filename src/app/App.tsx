import { RouterProvider } from 'react-router'
import { Providers } from './providers.js'
import { router } from './router.js'

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
