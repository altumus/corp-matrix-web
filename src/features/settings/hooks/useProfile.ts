import { useCallback, useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

interface ProfileData {
  displayName: string
  avatarUrl: string | null
  userId: string
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const client = getMatrixClient()
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
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateDisplayName = useCallback(async (name: string) => {
    const client = getMatrixClient()
    if (!client) return
    await client.setDisplayName(name)
    setProfile((prev) => prev ? { ...prev, displayName: name } : null)
  }, [])

  const updateAvatar = useCallback(async (file: File) => {
    const client = getMatrixClient()
    if (!client) return

    const response = await client.uploadContent(file)
    await client.setAvatarUrl(response.content_uri)
    setProfile((prev) =>
      prev ? { ...prev, avatarUrl: response.content_uri } : null,
    )
  }, [])

  return { profile, loading, updateDisplayName, updateAvatar }
}
