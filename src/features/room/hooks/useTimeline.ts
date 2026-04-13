import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
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
  const isDecryptionFailure = isEncrypted && event.getType() === 'm.room.encrypted'
  let content: Record<string, unknown>
  if (isDecryptionFailure) {
    content = { msgtype: 'm.text', body: '' }
  } else {
    const replacing = event.replacingEvent()
    const newContent = replacing?.getContent()?.['m.new_content'] as Record<string, unknown> | undefined
    content = newContent ?? event.getContent()
  }
  const isEdited = !!event.replacingEvent() || !!content['m.new_content']
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
    isDecryptionFailure,
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

const TIMELINE_EVENT_TYPES = [
  'm.room.message', 'm.room.encrypted', 'm.sticker',
  'org.matrix.msc3381.poll.start', 'm.poll.start',
  'm.room.member', 'm.room.create', 'm.room.name', 'm.room.topic', 'm.room.avatar',
]

function isThreadReply(e: MatrixEvent): boolean {
  const rel = e.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
  return rel?.rel_type === 'm.thread'
}

function countThreadReplies(room: Room): Map<string, number> {
  const counts = new Map<string, number>()
  let allTimelines
  try { allTimelines = room.getUnfilteredTimelineSet()?.getTimelines() } catch { return counts }
  if (!allTimelines) return counts
  for (const tl of allTimelines) {
    for (const e of tl.getEvents()) {
      const rel = e.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
      if (rel?.rel_type === 'm.thread' && typeof rel?.event_id === 'string') {
        counts.set(rel.event_id, (counts.get(rel.event_id) || 0) + 1)
      }
    }
  }
  return counts
}

// Per-room mapEvent cache to avoid re-mapping unchanged events on every sync.
// Key: eventId, Value: { event, editTs, reactionCount — all three must match to use cache }
const eventCache = new WeakMap<Room, Map<string, { ev: TimelineEvent; editTs: number; reactionCount?: number }>>()

function getCacheForRoom(room: Room): Map<string, { ev: TimelineEvent; editTs: number; reactionCount?: number }> {
  let cache = eventCache.get(room)
  if (!cache) {
    cache = new Map()
    eventCache.set(room, cache)
  }
  return cache
}

function collectEvents(room: Room): TimelineEvent[] {
  const mapped: TimelineEvent[] = []
  const seen = new Set<string>()

  // Guard: room may not be fully initialized after reload (crypto still loading)
  let allTimelines
  try {
    allTimelines = room.getUnfilteredTimelineSet()?.getTimelines()
  } catch {
    return []
  }
  if (!allTimelines) return []

  const threadCounts = countThreadReplies(room)
  const cache = getCacheForRoom(room)
  for (const tl of allTimelines) {
    for (const e of tl.getEvents()) {
      if (!TIMELINE_EVENT_TYPES.includes(e.getType())) continue
      if (isEditEvent(e)) continue
      if (e.isRedacted()) continue
      if (isThreadReply(e)) continue
      const id = e.getId()!
      if (seen.has(id)) continue
      seen.add(id)

      // Check cache — invalidate if event was edited or reactions changed
      const editTs = e.replacingEvent()?.getTs() || 0
      let reactionCount = 0
      try {
        const timelineSet = room.getUnfilteredTimelineSet()
        const rels = timelineSet.relations.getChildEventsForEvent(id, RelationType.Annotation, EventType.Reaction)
        reactionCount = rels?.getRelations().length || 0
      } catch { /* relations API may not be available */ }

      // Also invalidate cache if decryption status changed (event was decrypted after key restore)
      const isEncrypted = e.isEncrypted()
      const isStillFailed = isEncrypted && e.getType() === 'm.room.encrypted'
      const cached = cache.get(id)
      if (
        cached &&
        cached.editTs === editTs &&
        (cached.reactionCount ?? 0) === reactionCount &&
        cached.ev.isDecryptionFailure === isStillFailed // ← re-map if decryption status changed
      ) {
        const tc = threadCounts.get(id)
        if (tc !== cached.ev.threadReplyCount) {
          cached.ev.threadReplyCount = tc
        }
        mapped.push(cached.ev)
        continue
      }

      try {
        const ev = mapEvent(e, room)
        const tc = threadCounts.get(id)
        if (tc) {
          ev.threadReplyCount = tc
        }
        cache.set(id, { ev, editTs, reactionCount })
        mapped.push(ev)
      } catch {
        // skip
      }
    }
  }

  mapped.sort((a, b) => a.timestamp - b.timestamp)
  return mapped
}

export function useTimeline(roomId: string) {
  const client = useMatrixClient()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [paginating, setPaginating] = useState(false)
  const [prependCount, setPrependCount] = useState(0)
  const roomRef = useRef<Room | null>(null)
  const paginatingRef = useRef(false)
  const activeRoomIdRef = useRef(roomId)
  const prevEventIdsRef = useRef('')
  const prevFirstIdRef = useRef<string | null>(null)
  const decryptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshEvents = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    if (room.roomId !== activeRoomIdRef.current) return
    const newEvents = collectEvents(room)
    const newIds = newEvents.map((e) => e.eventId).join(',')
    if (newIds === prevEventIdsRef.current) return
    prevEventIdsRef.current = newIds

    if (newEvents.length > 0 && prevFirstIdRef.current !== null) {
      const newFirstId = newEvents[0].eventId
      if (newFirstId !== prevFirstIdRef.current) {
        const oldIdx = newEvents.findIndex((e) => e.eventId === prevFirstIdRef.current)
        if (oldIdx > 0) {
          setPrependCount((prev) => prev + oldIdx)
        }
      }
    }

    if (newEvents.length > 0) {
      prevFirstIdRef.current = newEvents[0].eventId
    }

    setEvents(newEvents)
  }, [])

  const sendReadReceipt = useCallback(async () => {
    // Privacy: respect user setting
    const { getSendReadReceipts } = await import('../../settings/components/PrivacySettings.js')
    if (!getSendReadReceipts()) return

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
    prevFirstIdRef.current = null
    prevEventIdsRef.current = ''
    setPrependCount(0)
    paginatingRef.current = false

    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    roomRef.current = room
    setEvents(collectEvents(room))
    setLoading(false)
    setPaginating(false)
    sendReadReceipt()

    const timeline = room.getLiveTimeline()
    const hasMessages = timeline.getEvents().some((e) => TIMELINE_EVENT_TYPES.includes(e.getType()))
    if (!hasMessages && timeline.getPaginationToken(Direction.Backward)) {
      client.paginateEventTimeline(timeline, { backwards: true, limit: 100 }).then(() => {
        if (activeRoomIdRef.current === roomId) {
          setEvents(collectEvents(room))
        }
      }).catch(() => {})
    }

    const onTimelineEvent = () => {
      if (activeRoomIdRef.current !== roomId) return
      prevEventIdsRef.current = ''
      refreshEvents()
      sendReadReceipt()
    }
    const onRedaction = () => {
      if (activeRoomIdRef.current !== roomId) return
      prevEventIdsRef.current = ''
      refreshEvents()
    }
    const onDecrypted = () => {
      if (activeRoomIdRef.current !== roomId) return
      const room = roomRef.current
      if (!room) return
      // Clear cache so newly-decrypted events get re-mapped with actual content
      eventCache.delete(room)
      // Debounce: batch rapid decryption events into a single refresh
      // to avoid "too many re-renders" when opening encrypted rooms
      if (decryptDebounceRef.current) clearTimeout(decryptDebounceRef.current)
      decryptDebounceRef.current = setTimeout(() => {
        decryptDebounceRef.current = null
        prevEventIdsRef.current = ''
        refreshEvents()
      }, 100)
    }

    client.on(RoomEvent.Timeline, onTimelineEvent)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      if (decryptDebounceRef.current) {
        clearTimeout(decryptDebounceRef.current)
        decryptDebounceRef.current = null
      }
      client.removeListener(RoomEvent.Timeline, onTimelineEvent)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [roomId, refreshEvents, sendReadReceipt, client])

  const paginateBack = useCallback(async () => {
    if (paginatingRef.current) return
    const room = roomRef.current
    if (!client || !room) return

    const timeline = room.getLiveTimeline()
    const token = timeline.getPaginationToken(Direction.Backward)
    if (!token) return

    paginatingRef.current = true
    setPaginating(true)
    try {
      await client.paginateEventTimeline(timeline, { backwards: true, limit: 100 })
      if (activeRoomIdRef.current === room.roomId) {
        setEvents(collectEvents(room))
      }
    } catch {
      // pagination failed
    } finally {
      paginatingRef.current = false
      setPaginating(false)
    }
  }, [client])

  return { events, loading, paginating, paginateBack, prependCount }
}
