import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getKeyBackupInfo } from '../../encryption/services/cryptoService.js'
import { setSecretStorageKey } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js'
import { KeyBackupSetup } from '../../encryption/components/KeyBackupSetup.js'
import { CrossSignVerification } from '../../encryption/components/CrossSignVerification.js'
import { ImportKeysDialog } from '../../encryption/components/ImportKeysDialog.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import type { KeyBackupInfo } from '../../encryption/types.js'
import { Spinner, Button, Input } from '../../../shared/ui/index.js'

export function EncryptionSettings() {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [backupInfo, setBackupInfo] = useState<KeyBackupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVerify, setShowVerify] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [restoringKey, setRestoringKey] = useState(false)
  const [isDeviceVerified, setIsDeviceVerified] = useState(false)

  const refresh = useCallback(async () => {
    const info = await getKeyBackupInfo()
    setBackupInfo(info)
    setLoading(false)

    // Check if current device is cross-signed
    const crypto = client?.getCrypto()
    if (crypto) {
      try {
        const status = await crypto.getCrossSigningStatus()
        setIsDeviceVerified(status.privateKeysInSecretStorage)
      } catch { /* ignore */ }
    }
  }, [client])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRestoreKey = async () => {
    const crypto = client?.getCrypto()
    if (!crypto || !recoveryKey.trim()) return

    setRestoringKey(true)
    try {
      const decodedKey = decodeRecoveryKey(recoveryKey.trim())
      setSecretStorageKey(decodedKey)
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
      await crypto.checkKeyBackupAndEnable()
      try { await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false }) } catch { /* best-effort */ }
      toast('Ключи восстановлены. Старые сообщения будут расшифрованы.', 'success')
      setRecoveryKey('')
      refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('does not match') || msg.includes('MAC mismatch')) {
        toast('Неверный ключ восстановления', 'error')
      } else if (msg.includes('Invalid recoveryKey')) {
        toast('Неверный формат ключа', 'error')
      } else {
        toast(msg || 'Ошибка восстановления ключей', 'error')
      }
    } finally {
      setRestoringKey(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <h3 style={{ fontSize: 'var(--font-size-xl)', margin: '0 0 var(--spacing-xl)' }}>
        {t('settings.encryption')}
      </h3>
      <KeyBackupSetup backupInfo={backupInfo} onRefresh={refresh} />

      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
          Ввести ключ восстановления
        </h4>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
          Вставьте ключ восстановления из FluffyChat или Element для расшифровки старых сообщений.
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              type="password"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="EsTc aHph ..."
              label="Recovery Key"
            />
          </div>
          <Button
            onClick={handleRestoreKey}
            disabled={!recoveryKey.trim() || restoringKey}
            loading={restoringKey}
          >
            Восстановить
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
          {t('encryption.importKeys', { defaultValue: 'Импорт ключей' })}
        </h4>
        <Button onClick={() => setShowImport(true)}>
          {t('encryption.importKeysFromFile', { defaultValue: 'Импорт ключей из файла' })}
        </Button>
        {showImport && <ImportKeysDialog onClose={() => setShowImport(false)} />}
      </div>

      {!isDeviceVerified && (
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
      )}
    </div>
  )
}
