/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { MainLayout } from './layouts/MainLayout.js'
import { AuthLayout } from './layouts/AuthLayout.js'
import { AuthGuard } from '../features/auth/components/AuthGuard.js'
import { Spinner } from '../shared/ui/index.js'
import { useRoomListStore } from '../features/room-list/store/roomListStore.js'
import { RouteErrorBoundary } from './RouteErrorBoundary.js'

function RoomsPlaceholder() {
  const loading = useRoomListStore((s) => s.initialLoading)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-tertiary)' }}>
      {loading ? <Spinner size={32} /> : 'Выберите чат'}
    </div>
  )
}

const LoginPage = lazy(() => import('../features/auth/components/LoginPage.js'))
const RegisterPage = lazy(() => import('../features/auth/components/RegisterPage.js'))
const RoomView = lazy(() => import('../features/room/components/RoomView.js'))
const SettingsPage = lazy(() => import('../features/settings/components/SettingsPage.js'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Spinner size={32} />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <AuthLayout>
        <SuspenseWrapper>
          <LoginPage />
        </SuspenseWrapper>
      </AuthLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/register',
    element: (
      <AuthLayout>
        <SuspenseWrapper>
          <RegisterPage />
        </SuspenseWrapper>
      </AuthLayout>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/rooms" replace />,
      },
      {
        path: 'rooms',
        element: (
          <SuspenseWrapper>
            <RoomsPlaceholder />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'rooms/:roomId',
        element: (
          <SuspenseWrapper>
            <RoomView />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings/*',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  {
    // Catch-all for unknown URLs — without it, React Router falls back to its
    // default ErrorBoundary which logs to console.
    path: '*',
    element: <RouteErrorBoundary />,
  },
])
