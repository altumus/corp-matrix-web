import { useCallback, useEffect, useState } from 'react'
import { getDeviceList, getKeyBackupInfo } from '../services/cryptoService.js'
import type { DeviceInfo, KeyBackupInfo } from '../types.js'

export function useEncryption() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [keyBackup, setKeyBackup] = useState<KeyBackupInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [deviceList, backupInfo] = await Promise.all([
        getDeviceList(),
        getKeyBackupInfo(),
      ])
      setDevices(deviceList)
      setKeyBackup(backupInfo)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { devices, keyBackup, loading, refresh }
}
