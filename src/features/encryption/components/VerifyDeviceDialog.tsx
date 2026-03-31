import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startVerification } from '../services/cryptoService.js'
import type { DeviceInfo } from '../types.js'
import { Modal, Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './VerifyDeviceDialog.module.scss'

interface VerifyDeviceDialogProps {
  device: DeviceInfo
  userId: string
  onClose: () => void
}

export function VerifyDeviceDialog({ device, userId, onClose }: VerifyDeviceDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setLoading(true)
    try {
      await startVerification(userId, device.deviceId)
      toast(t('encryption.verified'), 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('encryption.verifyDevice')}>
      <div className={styles.content}>
        <p className={styles.info}>
          Устройство: <strong>{device.displayName || device.deviceId}</strong>
        </p>
        <p className={styles.info}>ID: {device.deviceId}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleVerify} loading={loading}>
            {t('encryption.verifyDevice')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
