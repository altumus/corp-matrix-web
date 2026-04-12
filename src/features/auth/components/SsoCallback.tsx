import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useAuthStore } from '../store/authStore.js'
import { Spinner } from '../../../shared/ui/index.js'

export function SsoCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const loginWithSso = useAuthStore((s) => s.loginWithSso)
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)

  useEffect(() => {
    const loginToken = searchParams.get('loginToken')
    const homeserver = localStorage.getItem('sso_homeserver') || ''

    if (!loginToken || !homeserver) {
      navigate('/login')
      return
    }

    loginWithSso(homeserver, loginToken).then(() => {
      localStorage.removeItem('sso_homeserver')
      navigate('/rooms')
    }).catch(() => {
      navigate('/login')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 16 }}>
      {error ? (
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
      ) : (
        <>
          <Spinner size={32} />
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {status === 'loading' ? 'Завершение авторизации...' : ''}
          </p>
        </>
      )}
    </div>
  )
}
