import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth.js'
import { ServerPicker } from './ServerPicker.js'
import { Button, Input } from '../../../shared/ui/index.js'
import styles from './AuthForms.module.scss'

export default function LoginPage() {
  const { t } = useTranslation()
  const { status, error, homeserver, setHomeserver, login, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

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

      <p className={styles.switchLink}>
        {t('auth.noAccount')}{' '}
        <Link to="/register">{t('auth.register')}</Link>
      </p>
    </form>
  )
}
