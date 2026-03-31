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

  const handleSetup = async () => {
    setLoading(true)
    try {
      await setupKeyBackup()
      toast(t('encryption.keyBackup'), 'success')
      onRefresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('encryption.keyBackup')}</h3>
      {backupInfo?.enabled ? (
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
