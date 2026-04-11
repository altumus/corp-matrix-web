import { useCallback, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

export interface UserResult {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export function useUserSearch() {
  const client = useMatrixClient()
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
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
        avatarUrl: u.avatar_url ?? null,
      }))
      setUsers(mapped)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [client])

  return { users, loading, search }
}
