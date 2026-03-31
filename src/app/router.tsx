/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { MainLayout } from './layouts/MainLayout.js'
import { AuthLayout } from './layouts/AuthLayout.js'
import { AuthGuard } from '../features/auth/components/AuthGuard.js'
import { Spinner } from '../shared/ui/index.js'

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
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/rooms" replace />,
      },
      {
        path: 'rooms',
        element: (
          <SuspenseWrapper>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-tertiary)' }}>
              Выберите чат
            </div>
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
])
