import { useState, useEffect, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth.js'
import { stopClient, clearCryptoStore } from '../../../shared/lib/matrixClient.js'
import { fetchLoginFlows, type LoginFlows } from '../services/authService.js'
import { ServerPicker } from './ServerPicker.js'
import { Button, Input } from '../../../shared/ui/index.js'
import styles from './AuthForms.module.scss'

export default function LoginPage() {
  const { t } = useTranslation()
  const { status, error, homeserver, setHomeserver, login, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginFlows, setLoginFlows] = useState<LoginFlows | null>(null)
  const [_loadingFlows, setLoadingFlows] = useState(false)

  useEffect(() => {
    // Only stop client and clear crypto store if user is not authenticated.
    // Prevents accidental key destruction when navigating to /login while logged in.
    if (status === 'unauthenticated') {
      stopClient().then(() => clearCryptoStore()).catch(() => {})
    }
  }, [status])

  useEffect(() => {
    const url = homeserver.trim()
    if (!url) return
    setLoadingFlows(true)
    fetchLoginFlows(url)
      .then(setLoginFlows)
      .catch(() => setLoginFlows(null))
      .finally(() => setLoadingFlows(false))
  }, [homeserver])

  const handleSsoLogin = (providerId?: string) => {
    const url = homeserver.trim()
    localStorage.setItem('sso_homeserver', url)

    const callbackUrl = `${window.location.origin}/auth/callback`

    let ssoUrl: string
    if (providerId) {
      ssoUrl = `${url}/_matrix/client/v3/login/sso/redirect/${encodeURIComponent(providerId)}?redirectUrl=${encodeURIComponent(callbackUrl)}`
    } else {
      ssoUrl = `${url}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(callbackUrl)}`
    }

    window.location.href = ssoUrl
  }

  if (status === 'authenticated') {
    return <Navigate to="/rooms" replace />
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    clearError()
    login({ homeserver, username, password })
  }

  const isLoading = status === 'loading'

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.heading}>{t('auth.loginTitle')}</h2>

      <div className={styles.fields}>
        <ServerPicker value={homeserver} onChange={setHomeserver} />
      </div>

      {loginFlows?.supportsSso && (
        <div className={styles.ssoSection}>
          {loginFlows.ssoProviders.length > 0 ? (
            loginFlows.ssoProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={styles.ssoBtn}
                onClick={() => handleSsoLogin(provider.id)}
              >
                {provider.icon && <img src={provider.icon} alt="" width={20} height={20} />}
                {t('auth.ssoLoginWith', { provider: provider.name })}
              </button>
            ))
          ) : (
            <button
              type="button"
              className={styles.ssoBtn}
              onClick={() => handleSsoLogin()}
            >
              {t('auth.ssoLogin')}
            </button>
          )}
          {loginFlows.supportsPassword && (
            <div className={styles.divider}>
              <span>{t('auth.ssoOr')}</span>
            </div>
          )}
        </div>
      )}

      {(loginFlows === null || loginFlows.supportsPassword) && (
        <>
          <div className={styles.fields}>
            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />

            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" fullWidth loading={isLoading} size="lg">
            {isLoading ? t('auth.loggingIn') : t('auth.login')}
          </Button>
        </>
      )}

      <p className={styles.switchLink}>
        {t('auth.noAccount')}{' '}
        <Link to="/register">{t('auth.register')}</Link>
      </p>
    </form>
  )
}
