import { useCallback, useEffect, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { RoomEvent, RelationType, EventType } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import type { TimelineEvent } from '../types.js'
import { getThreadRootId } from '../utils/threadRelations.js'

function mapThreadEvent(e: MatrixEvent, room: Room, threadRootId: string): TimelineEvent {
  const id = e.getId()!
  const isRoot = id === threadRootId
  const sender = room.getMember(e.getSender()!)

  // Reactions
  const reactions = new Map<string, Set<string>>()
  try {
    const timelineSet = room.getUnfilteredTimelineSet()
    const relations = timelineSet.relations.getChildEventsForEvent(
      id, RelationType.Annotation, EventType.Reaction,
    )
    if (relations) {
      for (const relEvent of relations.getRelations()) {
        const key = relEvent.getContent()?.['m.relates_to']?.key
        if (key) {
          if (!reactions.has(key)) reactions.set(key, new Set())
          reactions.get(key)!.add(relEvent.getSender()!)
        }
      }
    }
  } catch { /* relations API may not be available */ }

  // Edited content
  let content = e.getContent()
  const replacing = e.replacingEvent()
  if (replacing) {
    const newContent = replacing.getContent()['m.new_content'] as Record<string, unknown> | undefined
    content = newContent ?? e.getContent()
  }
  const isEdited = !!e.replacingEvent() || !!content['m.new_content']

  // Reply
  const relatesTo = content['m.relates_to'] as Record<string, unknown> | undefined
  const replyToId = (relatesTo?.['m.in_reply_to'] as Record<string, unknown>)?.event_id as string | undefined
  let replyToEvent: { sender: string; body: string } | undefined
  if (replyToId) {
    const replyEvent = room.findEventById(replyToId)
    if (replyEvent) {
      const replySender = room.getMember(replyEvent.getSender()!)
      replyToEvent = {
        sender: replySender?.name || replyEvent.getSender()!,
        body: (replyEvent.getContent().body as string) || '',
      }
    }
  }

  const isDecryptionFailure = e.getType() === 'm.room.encrypted' && !e.isBeingDecrypted()

  return {
    eventId: id,
    roomId: room.roomId,
    type: e.getType(),
    sender: e.getSender()!,
    senderName: sender?.name || e.getSender()!,
    senderAvatar: sender?.getMxcAvatarUrl() ?? null,
    timestamp: e.getTs(),
    content,
    isEdited,
    isRedacted: e.isRedacted(),
    isDecryptionFailure,
    replyTo: replyToId,
    replyToEvent,
    threadRootId: isRoot ? undefined : threadRootId,
    reactions,
  }
}

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

      const isInThread = getThreadRootId(e) === threadRootId
      const isRoot = id === threadRootId

      if (!isInThread && !isRoot) continue
      seen.add(id)

      events.push(mapThreadEvent(e, room, threadRootId))
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}

export function useThread(roomId: string, threadRootId: string) {
  const client = useMatrixClient()
  const [events, setEvents] = useState<TimelineEvent[]>([])

  const refresh = useCallback(() => {
    setEvents(collectThreadEvents(roomId, threadRootId))
  }, [roomId, threadRootId])

  useEffect(() => {
    refresh()
    if (!client) return

    const onTimeline = () => refresh()
    client.on(RoomEvent.Timeline, onTimeline)
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline)
    }
  }, [refresh, client])

  const rootEvent = events.length > 0 ? events[0] : null
  const replies = events.slice(1)

  return { rootEvent, replies, refresh }
}
