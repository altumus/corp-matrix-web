import { useCallback, useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

interface ProfileData {
  displayName: string
  avatarUrl: string | null
  userId: string
}

export function useProfile() {
  const client = useMatrixClient()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!client) return

    const userId = client.getUserId()
    if (!userId) return

    try {
      const info = await client.getProfileInfo(userId)
      setProfile({
        displayName: info.displayname || userId,
        avatarUrl: info.avatar_url ?? null,
        userId,
      })
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateDisplayName = useCallback(async (name: string) => {
    if (!client) return
    await client.setDisplayName(name)
    setProfile((prev) => prev ? { ...prev, displayName: name } : null)
  }, [client])

  const updateAvatar = useCallback(async (file: File) => {
    if (!client) return

    const response = await client.uploadContent(file)
    await client.setAvatarUrl(response.content_uri)
    setProfile((prev) =>
      prev ? { ...prev, avatarUrl: response.content_uri } : null,
    )
  }, [client])

  return { profile, loading, updateDisplayName, updateAvatar }
}
