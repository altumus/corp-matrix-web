import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getKeyBackupInfo } from '../../encryption/services/cryptoService.js'
import { KeyBackupSetup } from '../../encryption/components/KeyBackupSetup.js'
import type { KeyBackupInfo } from '../../encryption/types.js'
import { Spinner } from '../../../shared/ui/index.js'

export function EncryptionSettings() {
  const { t } = useTranslation()
  const [backupInfo, setBackupInfo] = useState<KeyBackupInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const info = await getKeyBackupInfo()
    setBackupInfo(info)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (loading) return <Spinner />

  return (
    <div>
      <h3 style={{ fontSize: 'var(--font-size-xl)', margin: '0 0 var(--spacing-xl)' }}>
        {t('settings.encryption')}
      </h3>
      <KeyBackupSetup backupInfo={backupInfo} onRefresh={refresh} />
    </div>
  )
}
