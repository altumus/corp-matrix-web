import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getKeyBackupInfo } from '../../encryption/services/cryptoService.js'
import { KeyBackupSetup } from '../../encryption/components/KeyBackupSetup.js'
import { CrossSignVerification } from '../../encryption/components/CrossSignVerification.js'
import { ImportKeysDialog } from '../../encryption/components/ImportKeysDialog.js'
import type { KeyBackupInfo } from '../../encryption/types.js'
import { Spinner, Button } from '../../../shared/ui/index.js'

export function EncryptionSettings() {
  const { t } = useTranslation()
  const [backupInfo, setBackupInfo] = useState<KeyBackupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVerify, setShowVerify] = useState(false)
  const [showImport, setShowImport] = useState(false)

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

      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
          {t('encryption.importKeys', { defaultValue: 'Импорт ключей' })}
        </h4>
        <Button onClick={() => setShowImport(true)}>
          {t('encryption.importKeysFromFile', { defaultValue: 'Импорт ключей из файла' })}
        </Button>
        {showImport && <ImportKeysDialog onClose={() => setShowImport(false)} />}
      </div>

      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
          {t('encryption.crossSigning', { defaultValue: 'Перекрёстная подпись устройств' })}
        </h4>
        {!showVerify ? (
          <Button onClick={() => setShowVerify(true)}>
            {t('encryption.verifyDevice', { defaultValue: 'Верифицировать другое устройство' })}
          </Button>
        ) : (
          <CrossSignVerification onBack={() => setShowVerify(false)} />
        )}
      </div>
    </div>
  )
}
