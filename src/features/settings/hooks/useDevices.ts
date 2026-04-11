import { useCallback, useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

interface DeviceEntry {
  deviceId: string
  displayName: string | null
  lastSeenIp: string | null
  lastSeenTs: number | null
  isCurrent: boolean
}

export function useDevices() {
  const client = useMatrixClient()
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!client) return

    try {
      const result = await client.getDevices()
      const currentId = client.getDeviceId()

      setDevices(
        result.devices.map((d) => ({
          deviceId: d.device_id,
          displayName: d.display_name ?? null,
          lastSeenIp: d.last_seen_ip ?? null,
          lastSeenTs: d.last_seen_ts ?? null,
          isCurrent: d.device_id === currentId,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    refresh()
  }, [refresh])

  const removeDevice = useCallback(async (deviceId: string) => {
    if (!client) return
    await client.deleteDevice(deviceId)
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
  }, [client])

  return { devices, loading, removeDevice, refresh }
}
