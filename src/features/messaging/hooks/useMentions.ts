import { useMemo, useState, useCallback } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

export interface MentionCandidate {
  userId: string
  displayName: string
  avatarUrl: string | null
  isRoomMention?: boolean
}

const ROOM_MENTION: MentionCandidate = {
  userId: '@room',
  displayName: 'room',
  avatarUrl: null,
  isRoomMention: true,
}

export function useMentions(roomId: string) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(false)

  const allMembers = useMemo<MentionCandidate[]>(() => {
    const client = getMatrixClient()
    if (!client) return []
    const room = client.getRoom(roomId)
    if (!room) return []

    const myUserId = client.getUserId()
    return room
      .getJoinedMembers()
      .filter((m) => m.userId !== myUserId)
      .map((m) => ({
        userId: m.userId,
        displayName: m.name || m.userId,
        avatarUrl: m.getMxcAvatarUrl() ?? null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [roomId])

  const candidates = useMemo(() => {
    if (!active || !query) return [ROOM_MENTION, ...allMembers.slice(0, 7)]
    const q = query.toLowerCase()
    const filtered = allMembers
      .filter((m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q),
      )
      .slice(0, 7)
    // Show @room if query matches "room" or "all" or "все"
    if ('room'.includes(q) || 'all'.includes(q) || 'все'.includes(q)) {
      return [ROOM_MENTION, ...filtered]
    }
    return filtered
  }, [allMembers, query, active])

  const open = useCallback((q: string) => {
    setQuery(q)
    setActive(true)
  }, [])

  const close = useCallback(() => {
    setQuery('')
    setActive(false)
  }, [])

  return { candidates, active, open, close, setQuery }
}
