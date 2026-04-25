import { useCallback, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'

export interface UserResult {
  userId: string
  displayName: string
  avatarUrl: string | null
}

const FULL_MXID = /^@[^:\s]+:[^:\s]+$/
const USERNAME_LIKE = /^@?[a-zA-Z0-9._=\-/+]+$/

export function useUserSearch() {
  const client = useMatrixClient()
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!client || !query.trim()) {
      setUsers([])
      return
    }

    const term = query.trim()
    const myUserId = client.getUserId()
    const myDomain = myUserId?.split(':')[1]

    let candidateMxid: string | null = null
    if (FULL_MXID.test(term)) {
      candidateMxid = term
    } else if (myDomain && USERNAME_LIKE.test(term)) {
      const localpart = term.startsWith('@') ? term.slice(1) : term
      if (localpart) candidateMxid = `@${localpart}:${myDomain}`
    }

    setLoading(true)
    try {
      const directoryPromise = client
        .searchUserDirectory({ term, limit: 20 })
        .then((res) =>
          (res.results || []).map<UserResult>((u) => ({
            userId: u.user_id,
            displayName: u.display_name || u.user_id,
            avatarUrl: u.avatar_url ?? null,
          })),
        )
        .catch(() => [] as UserResult[])

      const profilePromise: Promise<UserResult | null> = candidateMxid
        ? client
            .getProfileInfo(candidateMxid)
            .then((info) => ({
              userId: candidateMxid as string,
              displayName: info.displayname || (candidateMxid as string),
              avatarUrl: info.avatar_url ?? null,
            }))
            .catch(() => null)
        : Promise.resolve(null)

      const [directoryUsers, profileUser] = await Promise.all([
        directoryPromise,
        profilePromise,
      ])

      const merged = profileUser
        ? [profileUser, ...directoryUsers.filter((u) => u.userId !== profileUser.userId)]
        : directoryUsers

      setUsers(merged)
    } finally {
      setLoading(false)
    }
  }, [client])

  return { users, loading, search }
}
