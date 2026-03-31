import { useTranslation } from 'react-i18next'
import { useDevices } from '../hooks/useDevices.js'
import { Button, Spinner } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './DevicesSettings.module.scss'

export function DevicesSettings() {
  const { t } = useTranslation()
  const { devices, loading, removeDevice } = useDevices()

  if (loading) return <Spinner />

  const handleRemove = async (deviceId: string) => {
    if (!confirm('Удалить это устройство?')) return
    try {
      await removeDevice(deviceId)
      toast('Устройство удалено', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t('settings.devices')}</h3>
      <div className={styles.list}>
        {devices.map((device) => (
          <div key={device.deviceId} className={styles.device}>
            <div className={styles.info}>
              <span className={styles.name}>
                {device.displayName || device.deviceId}
                {device.isCurrent && <span className={styles.current}>(текущее)</span>}
              </span>
              <span className={styles.meta}>
                {device.lastSeenIp && `IP: ${device.lastSeenIp}`}
                {device.lastSeenTs && ` • ${new Date(device.lastSeenTs).toLocaleString()}`}
              </span>
            </div>
            {!device.isCurrent && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleRemove(device.deviceId)}
              >
                {t('messages.remove')}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
