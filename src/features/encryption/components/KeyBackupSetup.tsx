import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setupKeyBackup } from '../services/cryptoService.js'
import type { KeyBackupInfo } from '../types.js'
import { Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './KeyBackupSetup.module.scss'

interface KeyBackupSetupProps {
  backupInfo: KeyBackupInfo | null
  onRefresh: () => void
}

export function KeyBackupSetup({ backupInfo, onRefresh }: KeyBackupSetupProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const handleSetup = async () => {
    setLoading(true)
    try {
      const recoveryKey = await setupKeyBackup()
      if (recoveryKey) {
        setGeneratedKey(recoveryKey)
      }
      toast(t('encryption.keyBackup'), 'success')
      onRefresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey)
      toast('Ключ скопирован в буфер обмена', 'success')
    }
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('encryption.keyBackup')}</h3>
      {generatedKey ? (
        <div className={styles.setup}>
          <p className={styles.description} style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
            Сохраните ключ восстановления! Он нужен для расшифровки сообщений на других устройствах.
          </p>
          <code style={{
            display: 'block',
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            wordBreak: 'break-all',
            fontSize: 'var(--font-size-sm)',
            userSelect: 'all',
          }}>
            {generatedKey}
          </code>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
            <Button variant="secondary" onClick={handleCopyKey}>
              Копировать
            </Button>
            <Button onClick={() => setGeneratedKey(null)}>
              Готово
            </Button>
          </div>
        </div>
      ) : backupInfo?.enabled ? (
        <p className={styles.status}>
          Бэкап ключей активен (v{backupInfo.version})
        </p>
      ) : (
        <div className={styles.setup}>
          <p className={styles.description}>
            Настройте резервное копирование ключей для восстановления зашифрованных сообщений
            при входе с нового устройства.
          </p>
          <Button onClick={handleSetup} loading={loading}>
            {t('encryption.setupKeyBackup')}
          </Button>
        </div>
      )}
    </div>
  )
}
