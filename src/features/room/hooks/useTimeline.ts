import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { RoomEvent, RelationType, EventType, MatrixEventEvent } from 'matrix-js-sdk'
import { Direction } from 'matrix-js-sdk/lib/models/event-timeline.js'
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

function isEditEvent(e: MatrixEvent): boolean {
  const rel = e.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
  return rel?.rel_type === 'm.replace'
}

function collectEvents(room: Room): TimelineEvent[] {
  const messageTypes = ['m.room.message', 'm.room.encrypted', 'm.sticker', 'org.matrix.msc3381.poll.start', 'm.poll.start']
  const mapped: TimelineEvent[] = []
  const seen = new Set<string>()

  const allTimelines = room.getUnfilteredTimelineSet().getTimelines()
  for (const tl of allTimelines) {
    for (const e of tl.getEvents()) {
      if (!messageTypes.includes(e.getType())) continue
      if (isEditEvent(e)) continue
      if (e.isRedacted()) continue
      const id = e.getId()!
      if (seen.has(id)) continue
      seen.add(id)
      try {
        mapped.push(mapEvent(e, room))
      } catch {
        // skip
      }
    }
  }

  mapped.sort((a, b) => a.timestamp - b.timestamp)
  return mapped
}

export function useTimeline(roomId: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [paginating, setPaginating] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const paginatingRef = useRef(false)
  const activeRoomIdRef = useRef(roomId)

  const refreshEvents = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    if (room.roomId !== activeRoomIdRef.current) return
    setEvents(collectEvents(room))
  }, [])

  const sendReadReceipt = useCallback(() => {
    const client = getMatrixClient()
    const room = roomRef.current
    if (!client || !room) return

    const timeline = room.getLiveTimeline().getEvents()
    for (let i = timeline.length - 1; i >= 0; i--) {
      const ev = timeline[i]
      if (ev.getType() === 'm.room.message' || ev.getType() === 'm.room.encrypted') {
        client.sendReadReceipt(ev).catch(() => {})
        break
      }
    }
  }, [])

  useEffect(() => {
    activeRoomIdRef.current = roomId
    paginatingRef.current = false

    const client = getMatrixClient()
    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    roomRef.current = room
    setEvents(collectEvents(room))
    setLoading(false)
    setPaginating(false)
    sendReadReceipt()

    const timeline = room.getLiveTimeline()
    const messageTypes = ['m.room.message', 'm.room.encrypted', 'm.sticker', 'org.matrix.msc3381.poll.start', 'm.poll.start']
    const hasMessages = timeline.getEvents().some((e) => messageTypes.includes(e.getType()))
    if (!hasMessages && timeline.getPaginationToken(Direction.Backward)) {
      client.paginateEventTimeline(timeline, { backwards: true, limit: 50 }).then(() => {
        if (activeRoomIdRef.current === roomId) {
          setEvents(collectEvents(room))
        }
      }).catch(() => {})
    }

    const onTimelineEvent = () => {
      if (activeRoomIdRef.current !== roomId) return
      refreshEvents()
      sendReadReceipt()
    }
    const onRedaction = () => {
      if (activeRoomIdRef.current !== roomId) return
      refreshEvents()
    }
    const onDecrypted = () => {
      if (activeRoomIdRef.current !== roomId) return
      refreshEvents()
    }

    client.on(RoomEvent.Timeline, onTimelineEvent)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      client.removeListener(RoomEvent.Timeline, onTimelineEvent)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [roomId, refreshEvents, sendReadReceipt])

  const paginateBack = useCallback(async () => {
    if (paginatingRef.current) return
    const client = getMatrixClient()
    const room = roomRef.current
    if (!client || !room) return

    const timeline = room.getLiveTimeline()
    const token = timeline.getPaginationToken(Direction.Backward)
    if (!token) return

    paginatingRef.current = true
    setPaginating(true)
    try {
      await client.paginateEventTimeline(timeline, { backwards: true, limit: 30 })
      if (activeRoomIdRef.current === room.roomId) {
        setEvents(collectEvents(room))
      }
    } catch {
      // pagination failed
    } finally {
      paginatingRef.current = false
      setPaginating(false)
    }
  }, [])

  return { events, loading, paginating, paginateBack }
}
