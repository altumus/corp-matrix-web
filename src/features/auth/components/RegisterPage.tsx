import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth.js'
import { ServerPicker } from './ServerPicker.js'
import { Button, Input } from '../../../shared/ui/index.js'
import styles from './AuthForms.module.scss'

export default function RegisterPage() {
  const { t } = useTranslation()
  const { status, error, homeserver, setHomeserver, register, clearError } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  if (status === 'authenticated') {
    return <Navigate to="/rooms" replace />
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)

    if (password !== confirmPassword) {
      setLocalError(t('auth.errors.passwordMismatch'))
      return
    }

    register({ homeserver, username, password })
  }

  const isLoading = status === 'loading'
  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.heading}>{t('auth.registerTitle')}</h2>

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
          autoComplete="new-password"
          required
        />

        <Input
          label={t('auth.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {displayError && <p className={styles.error}>{displayError}</p>}

      <Button type="submit" fullWidth loading={isLoading} size="lg">
        {isLoading ? t('auth.registering') : t('auth.register')}
      </Button>

      <p className={styles.switchLink}>
        {t('auth.hasAccount')}{' '}
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </form>
  )
}
