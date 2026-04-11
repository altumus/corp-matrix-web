import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { getDeviceList } from '../../encryption/services/cryptoService.js'
import { VerifyDeviceDialog } from '../../encryption/components/VerifyDeviceDialog.js'
import type { DeviceInfo } from '../../encryption/types.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Button, Spinner } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './DevicesSettings.module.scss'

export function DevicesSettings() {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyDevice, setVerifyDevice] = useState<DeviceInfo | null>(null)

  const refresh = useCallback(async () => {
    const list = await getDeviceList()
    setDevices(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleRemove = async (deviceId: string) => {
    if (!confirm('Удалить это устройство?')) return
    try {
      if (!client) return
      await client.deleteDevice(deviceId)
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
      toast('Устройство удалено', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    }
  }

  const userId = client?.getUserId() || ''

  if (loading) return <Spinner />

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t('settings.devices')}</h3>
      <div className={styles.list}>
        {devices.map((device) => (
          <div key={device.deviceId} className={styles.device}>
            <div className={styles.info}>
              <span className={styles.name}>
                {device.trustLevel === 'verified'
                  ? <ShieldCheck size={14} className={styles.verified} />
                  : <ShieldAlert size={14} className={styles.unverified} />
                }
                {device.displayName || device.deviceId}
                {device.isCurrentDevice && <span className={styles.current}>(текущее)</span>}
              </span>
              <span className={styles.meta}>
                {device.lastSeenIp && `IP: ${device.lastSeenIp}`}
                {device.lastSeenTs && ` • ${new Date(device.lastSeenTs).toLocaleString()}`}
              </span>
            </div>
            <div className={styles.actions}>
              {!device.isCurrentDevice && device.trustLevel !== 'verified' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setVerifyDevice(device)}
                >
                  {t('encryption.verifyDevice')}
                </Button>
              )}
              {!device.isCurrentDevice && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRemove(device.deviceId)}
                >
                  {t('messages.remove')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {verifyDevice && (
        <VerifyDeviceDialog
          device={verifyDevice}
          userId={userId}
          onClose={() => {
            setVerifyDevice(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
