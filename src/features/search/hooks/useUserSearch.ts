import { useCallback, useState } from 'react'
import { getMatrixClient, mxcToHttp } from '../../../shared/lib/matrixClient.js'

export interface UserResult {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export function useUserSearch() {
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    const client = getMatrixClient()
    if (!client || !query.trim()) {
      setUsers([])
      return
    }

    setLoading(true)
    try {
      const response = await client.searchUserDirectory({ term: query, limit: 20 })
      const mapped: UserResult[] = (response.results || []).map((u) => ({
        userId: u.user_id,
        displayName: u.display_name || u.user_id,
        avatarUrl: mxcToHttp(u.avatar_url ?? null, 40, 40),
      }))
      setUsers(mapped)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { users, loading, search }
}
