import { useCallback, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import type { ISearchRequestBody, ISearchResult } from 'matrix-js-sdk/lib/@types/search.js'
import { SearchOrderBy } from 'matrix-js-sdk/lib/@types/search.js'

export interface SearchResult {
  eventId: string
  roomId: string
  roomName: string
  sender: string
  senderName: string
  body: string
  timestamp: number
}

export function useMessageSearch() {
  const client = useMatrixClient()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextBatch, setNextBatch] = useState<string | null>(null)

  const search = useCallback(async (query: string, roomId?: string) => {
    if (!client || !query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const body: ISearchRequestBody = {
        search_categories: {
          room_events: {
            search_term: query,
            filter: roomId ? { rooms: [roomId] } : undefined,
            order_by: SearchOrderBy.Recent,
          },
        },
      }

      const response = await client.search({ body })
      const roomEvents = response?.search_categories?.room_events

      const mapped: SearchResult[] = (roomEvents?.results || []).map((r: ISearchResult) => {
        const event = r.result
        const room = client.getRoom(event.room_id)
        const member = room?.getMember(event.sender)

        return {
          eventId: event.event_id,
          roomId: event.room_id,
          roomName: room?.name || event.room_id,
          sender: event.sender,
          senderName: member?.name || event.sender,
          body: (event.content as Record<string, unknown>)?.body as string || '',
          timestamp: event.origin_server_ts,
        }
      })

      setResults(mapped)
      setNextBatch(roomEvents?.next_batch || null)
      setHasMore(!!roomEvents?.next_batch)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [client])

  return { results, loading, hasMore, nextBatch, search }
}
