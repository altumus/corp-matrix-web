import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { useDebounce } from '../../../shared/hooks/useDebounce.js'
import type { RoomListEntry } from '../types.js'
import { SearchOrderBy } from 'matrix-js-sdk/lib/@types/search.js'
import type { ISearchRequestBody, ISearchResult } from 'matrix-js-sdk/lib/@types/search.js'

export interface UserResult {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export interface MessageResult {
  eventId: string
  roomId: string
  roomName: string
  senderName: string
  body: string
  timestamp: number
}

export interface CombinedSearchResult {
  rooms: RoomListEntry[]
  users: UserResult[]
  messages: MessageResult[]
  loadingUsers: boolean
  loadingMessages: boolean
}

export function useCombinedSearch(query: string): CombinedSearchResult {
  const rooms = useRoomListStore((s) => s.rooms)
  const [users, setUsers] = useState<UserResult[]>([])
  const [messages, setMessages] = useState<MessageResult[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const debouncedQuery = useDebounce(query.trim(), 300)
  const abortRef = useRef(0)

  const filteredRooms = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return rooms
      .filter((r) => !r.isInvite && r.name.toLowerCase().includes(q))
      .slice(0, 5)
  }, [query, rooms])

  const searchUsers = useCallback(async (term: string, id: number) => {
    const client = getMatrixClient()
    if (!client) return

    setLoadingUsers(true)
    try {
      const response = await client.searchUserDirectory({ term, limit: 5 })
      if (abortRef.current !== id) return
      setUsers(
        (response.results || []).map((u) => ({
          userId: u.user_id,
          displayName: u.display_name || u.user_id,
          avatarUrl: u.avatar_url ?? null,
        })),
      )
    } catch {
      if (abortRef.current === id) setUsers([])
    } finally {
      if (abortRef.current === id) setLoadingUsers(false)
    }
  }, [])

  const searchMessagesLocal = useCallback((term: string): MessageResult[] => {
    const client = getMatrixClient()
    if (!client) return []

    const lowerTerm = term.toLowerCase()
    const results: MessageResult[] = []

    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue
      let timelines
      try {
        timelines = room.getUnfilteredTimelineSet()?.getTimelines()
      } catch { continue }
      if (!timelines) continue

      for (const tl of timelines) {
        for (const ev of tl.getEvents()) {
          const type = ev.getType()
          if (type !== 'm.room.message' && type !== 'm.room.encrypted') continue
          if (ev.isRedacted()) continue
          const body = (ev.getContent()?.body as string) || ''
          if (!body || !body.toLowerCase().includes(lowerTerm)) continue

          const member = room.getMember(ev.getSender()!)
          results.push({
            eventId: ev.getId()!,
            roomId: room.roomId,
            roomName: room.name || room.roomId,
            senderName: member?.name || ev.getSender()!,
            body,
            timestamp: ev.getTs(),
          })
        }
      }
    }

    results.sort((a, b) => b.timestamp - a.timestamp)
    return results.slice(0, 20)
  }, [])

  const searchMessages = useCallback(async (term: string, id: number) => {
    const client = getMatrixClient()
    if (!client) return

    setLoadingMessages(true)
    try {
      // Local search (works for encrypted rooms with decrypted events)
      const localResults = searchMessagesLocal(term)

      // Server-side search (works for unencrypted rooms, may return more results)
      let serverResults: MessageResult[] = []
      try {
        const body: ISearchRequestBody = {
          search_categories: {
            room_events: {
              search_term: term,
              order_by: SearchOrderBy.Recent,
            },
          },
        }
        const response = await client.search({ body })
        if (abortRef.current !== id) return
        const roomEvents = response?.search_categories?.room_events
        serverResults = (roomEvents?.results || []).slice(0, 10).map((r: ISearchResult) => {
          const ev = r.result
          const room = client.getRoom(ev.room_id)
          const member = room?.getMember(ev.sender)
          return {
            eventId: ev.event_id,
            roomId: ev.room_id,
            roomName: room?.name || ev.room_id,
            senderName: member?.name || ev.sender,
            body: (ev.content as Record<string, unknown>)?.body as string || '',
            timestamp: ev.origin_server_ts,
          }
        })
      } catch { /* server search may fail for encrypted-only servers */ }

      if (abortRef.current !== id) return

      // Merge: deduplicate by eventId, prefer local (has decrypted content)
      const seen = new Set(localResults.map((r) => r.eventId))
      const merged = [...localResults, ...serverResults.filter((r) => !seen.has(r.eventId))]
      merged.sort((a, b) => b.timestamp - a.timestamp)
      setMessages(merged.slice(0, 20))
    } catch {
      if (abortRef.current === id) setMessages([])
    } finally {
      if (abortRef.current === id) setLoadingMessages(false)
    }
  }, [searchMessagesLocal])

  useEffect(() => {
    const id = ++abortRef.current

    if (!debouncedQuery) {
      setUsers([])
      setMessages([])
      setLoadingUsers(false)
      setLoadingMessages(false)
      return
    }

    if (debouncedQuery.length >= 2) {
      searchUsers(debouncedQuery, id)
    } else {
      setUsers([])
    }

    if (debouncedQuery.length >= 3) {
      searchMessages(debouncedQuery, id)
    } else {
      setMessages([])
    }
  }, [debouncedQuery, searchUsers, searchMessages])

  const deduplicatedUsers = useMemo(() => {
    const client = getMatrixClient()
    if (!client || filteredRooms.length === 0) return users

    const dmUserIds = new Set<string>()
    for (const room of filteredRooms) {
      if (!room.isDirect) continue
      const matrixRoom = client.getRoom(room.roomId)
      if (!matrixRoom) continue
      for (const member of matrixRoom.getJoinedMembers()) {
        if (member.userId !== client.getUserId()) {
          dmUserIds.add(member.userId)
        }
      }
    }

    return users.filter((u) => !dmUserIds.has(u.userId))
  }, [users, filteredRooms])

  return {
    rooms: filteredRooms,
    users: deduplicatedUsers,
    messages,
    loadingUsers,
    loadingMessages,
  }
}
