import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent, RelationType, EventType, MatrixEventEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import type { TimelineEvent } from '../types.js'

function mapEvent(event: MatrixEvent, room: Room): TimelineEvent {
  const sender = room.getMember(event.getSender()!)
  const reactions = new Map<string, Set<string>>()

  try {
    const timelineSet = room.getUnfilteredTimelineSet()
    const relations = timelineSet.relations.getChildEventsForEvent(
      event.getId()!,
      RelationType.Annotation,
      EventType.Reaction,
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
  } catch {
    // relations API may not be available
  }

  const isEncrypted = event.isEncrypted()
  const effectiveContent = isEncrypted && event.getType() === 'm.room.encrypted'
    ? { msgtype: 'm.text', body: '🔒 Зашифрованное сообщение' }
    : event.getContent()

  const content = effectiveContent
  const isEdited = !!content['m.new_content']
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

  return {
    eventId: event.getId()!,
    roomId: room.roomId,
    type: event.getType() === 'm.room.encrypted' ? 'm.room.message' : event.getType(),
    sender: event.getSender()!,
    senderName: sender?.name || event.getSender()!,
    senderAvatar: sender?.getMxcAvatarUrl() ?? null,
    timestamp: event.getTs(),
    content,
    isEdited,
    isRedacted: event.isRedacted(),
    replyTo: replyToId,
    replyToEvent,
    threadRootId: relatesTo?.rel_type === 'm.thread'
      ? relatesTo.event_id as string
      : undefined,
    reactions,
  }
}

export function useTimeline(roomId: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [paginating, setPaginating] = useState(false)
  const [canPaginateBack, setCanPaginateBack] = useState(true)
  const roomRef = useRef<Room | null>(null)

  const refreshEvents = useCallback(() => {
    const room = roomRef.current
    if (!room) return

    const timeline = room.getLiveTimeline()
    const matrixEvents = timeline.getEvents()
    const mapped = matrixEvents
      .filter((e) => ['m.room.message', 'm.room.encrypted', 'm.sticker'].includes(e.getType()))
      .map((e) => mapEvent(e, room))
    setEvents(mapped)
  }, [])

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    roomRef.current = room
    refreshEvents()
    setLoading(false)

    const onTimelineEvent = () => refreshEvents()
    const onRedaction = () => refreshEvents()

    const onDecrypted = () => refreshEvents()

    client.on(RoomEvent.Timeline, onTimelineEvent)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      client.removeListener(RoomEvent.Timeline, onTimelineEvent)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [roomId, refreshEvents])

  const paginateBack = useCallback(async () => {
    const client = getMatrixClient()
    const room = roomRef.current
    if (!client || !room || paginating) return

    setPaginating(true)
    try {
      const result = await client.paginateEventTimeline(
        room.getLiveTimeline(),
        { backwards: true, limit: 30 },
      )
      setCanPaginateBack(result)
      refreshEvents()
    } finally {
      setPaginating(false)
    }
  }, [paginating, refreshEvents])

  return { events, loading, paginating, canPaginateBack, paginateBack }
}
