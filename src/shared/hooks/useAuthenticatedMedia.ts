import { useEffect, useMemo, useState } from 'react'
import { getMatrixClient } from '../lib/matrixClient.js'

const blobCache = new Map<string, string>()

export function useAuthenticatedMedia(mxcUrl: string | null | undefined): string | null {
  const cached = useMemo(() => (mxcUrl ? blobCache.get(mxcUrl) ?? null : null), [mxcUrl])
  const [blobUrl, setBlobUrl] = useState<string | null>(cached)

  useEffect(() => {
    if (!mxcUrl || blobCache.has(mxcUrl)) {
      return
    }

    let cancelled = false
    const client = getMatrixClient()
    if (!client) return

    const httpUrl = client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true)
    if (!httpUrl) return

    fetch(httpUrl, {
      headers: {
        Authorization: `Bearer ${client.getAccessToken()}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        blobCache.set(mxcUrl, url)
        setBlobUrl(url)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [mxcUrl])

  return cached ?? blobUrl
}
