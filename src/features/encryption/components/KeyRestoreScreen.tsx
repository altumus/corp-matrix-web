import { useState, useCallback, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Smartphone, LogOut } from 'lucide-react'
import { getMatrixClient, setSecretStorageKey } from '../../../shared/lib/matrixClient.js'
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js'
import { useAuthStore } from '../../auth/store/authStore.js'
import { Button, Input } from '../../../shared/ui/index.js'
import { CrossSignVerification } from './CrossSignVerification.js'
import styles from './KeyRestoreScreen.module.scss'

type Mode = 'choose' | 'key' | 'verify'

export function KeyRestoreScreen() {
  const { t } = useTranslation()
  const completeKeyRestore = useAuthStore((s) => s.completeKeyRestore)
  const logout = useAuthStore((s) => s.logout)
  const [mode, setMode] = useState<Mode>('choose')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const client = getMatrixClient()
    const crypto = client?.getCrypto()
    if (!crypto || !recoveryKey.trim()) return

    setLoading(true)
    setError(null)

    try {
      const decodedKey = decodeRecoveryKey(recoveryKey.trim())

      const defaultKeyId = await client!.secretStorage.getDefaultKeyId()
      if (!defaultKeyId) {
        setError(t('encryption.noBackupFound'))
        return
      }

      const keyInfo = await client!.secretStorage.getKey(defaultKeyId)
      if (!keyInfo?.[1]) {
        setError(t('encryption.noBackupFound'))
        return
      }

      const valid = await client!.secretStorage.checkKey(decodedKey, keyInfo[1])
      if (!valid) {
        setError(t('encryption.wrongRecoveryKey'))
        return
      }

      setSecretStorageKey(decodedKey)

      await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
      await crypto.checkKeyBackupAndEnable()
      completeKeyRestore()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('does not match') || msg.includes('MAC mismatch')) {
        setError(t('encryption.wrongRecoveryKey'))
      } else if (msg.includes('Invalid recoveryKey')) {
        setError(t('encryption.invalidKeyFormat'))
      } else {
        setError(msg || t('encryption.restoreFailed'))
      }
    } finally {
      setLoading(false)
    }
  }, [recoveryKey, completeKeyRestore, t])

  const handleBack = useCallback(() => {
    setMode('choose')
    setError(null)
  }, [])

  return (
    <div className={styles.layout}>
      <div className={styles.container}>
        {mode === 'choose' && (
          <>
            <div className={styles.header}>
              <span className={styles.icon}>🔐</span>
              <h1 className={styles.title}>{t('encryption.chooseMethod')}</h1>
              <p className={styles.description}>{t('encryption.chooseMethodDescription')}</p>
            </div>

            <div className={styles.methodGrid}>
              <button
                type="button"
                className={styles.methodCard}
                onClick={() => setMode('key')}
              >
                <KeyRound size={28} />
                <span className={styles.methodTitle}>{t('encryption.useRecoveryKey')}</span>
                <span className={styles.methodDescription}>{t('encryption.useRecoveryKeyHint')}</span>
              </button>

              <button
                type="button"
                className={styles.methodCard}
                onClick={() => setMode('verify')}
              >
                <Smartphone size={28} />
                <span className={styles.methodTitle}>{t('encryption.useDeviceVerification')}</span>
                <span className={styles.methodDescription}>{t('encryption.useDeviceVerificationHint')}</span>
              </button>
            </div>

            <div className={styles.bottomLinks}>
              <button
                type="button"
                className={styles.skipButton}
                onClick={completeKeyRestore}
              >
                {t('encryption.skipForNow')}
              </button>
              <button
                type="button"
                className={styles.logoutButton}
                onClick={logout}
              >
                <LogOut size={14} />
                {t('auth.logout')}
              </button>
            </div>
          </>
        )}

        {mode === 'key' && (
          <>
            <div className={styles.header}>
              <span className={styles.icon}>🔑</span>
              <h1 className={styles.title}>{t('encryption.restoreTitle')}</h1>
              <p className={styles.description}>{t('encryption.restoreDescription')}</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                label={t('encryption.recoveryKeyLabel')}
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder="EsTc aHph ..."
                autoFocus
              />

              {error && <p className={styles.error}>{error}</p>}

              <div className={styles.actions}>
                <Button type="submit" loading={loading} disabled={!recoveryKey.trim()}>
                  {t('encryption.restore')}
                </Button>
                <Button type="button" variant="secondary" onClick={handleBack}>
                  {t('encryption.back')}
                </Button>
              </div>
            </form>
          </>
        )}

        {mode === 'verify' && (
          <>
            <div className={styles.header}>
              <span className={styles.icon}>📱</span>
              <h1 className={styles.title}>{t('encryption.verifyFromDevice')}</h1>
              <p className={styles.description}>{t('encryption.verifyFromDeviceDescription')}</p>
            </div>

            <CrossSignVerification onBack={handleBack} />
          </>
        )}
      </div>
    </div>
  )
}
