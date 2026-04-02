import { useCallback, useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent } from 'matrix-js-sdk'
import type { TimelineEvent } from '../types.js'

function collectThreadEvents(roomId: string, threadRootId: string): TimelineEvent[] {
  const client = getMatrixClient()
  if (!client) return []
  const room = client.getRoom(roomId)
  if (!room) return []

  const events: TimelineEvent[] = []
  const seen = new Set<string>()

  const allTimelines = room.getUnfilteredTimelineSet().getTimelines()
  for (const tl of allTimelines) {
    for (const e of tl.getEvents()) {
      const id = e.getId()!
      if (seen.has(id)) continue

      const rel = e.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
      const isInThread = rel?.rel_type === 'm.thread' && rel?.event_id === threadRootId
      const isRoot = id === threadRootId

      if (!isInThread && !isRoot) continue
      if (e.isRedacted()) continue
      seen.add(id)

      const sender = room.getMember(e.getSender()!)
      events.push({
        eventId: id,
        roomId,
        type: e.getType(),
        sender: e.getSender()!,
        senderName: sender?.name || e.getSender()!,
        senderAvatar: sender?.getMxcAvatarUrl() ?? null,
        timestamp: e.getTs(),
        content: e.getContent(),
        isEdited: !!e.getContent()['m.new_content'],
        isRedacted: false,
        replyTo: undefined,
        replyToEvent: undefined,
        threadRootId: isRoot ? undefined : threadRootId,
        reactions: new Map(),
      })
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}

export function useThread(roomId: string, threadRootId: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([])

  const refresh = useCallback(() => {
    setEvents(collectThreadEvents(roomId, threadRootId))
  }, [roomId, threadRootId])

  useEffect(() => {
    refresh()

    const client = getMatrixClient()
    if (!client) return

    const onTimeline = () => refresh()
    client.on(RoomEvent.Timeline, onTimeline)
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline)
    }
  }, [refresh])

  const rootEvent = events.length > 0 ? events[0] : null
  const replies = events.slice(1)

  return { rootEvent, replies, refresh }
}
