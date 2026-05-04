import { useCallback, useEffect, useRef, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { RoomEvent, RelationType, EventType, MatrixEventEvent } from 'matrix-js-sdk'
import { Direction } from 'matrix-js-sdk/lib/models/event-timeline.js'
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import type { TimelineEvent } from '../types.js'
import { getThreadRootId, isThreadReply } from '../utils/threadRelations.js'

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
  const stillEncrypted = isEncrypted && event.getType() === 'm.room.encrypted'
  // Grace-period split: when an encrypted event first shows up we don't know
  // yet whether crypto can decrypt it. Showing "не удалось расшифровать"
  // immediately and then flipping to real content as rust-crypto catches up
  // is what produces the visible jump. We mark the event as "pending" for a
  // short window and only escalate to a failure after the grace expires.
  const seenMap = getFirstSeenEncryptedForRoom(room)
  const eventId = event.getId()!
  let decryptionPending = false
  let isDecryptionFailure = false
  if (stillEncrypted) {
    let firstSeen = seenMap.get(eventId)
    if (firstSeen === undefined) {
      firstSeen = Date.now()
      seenMap.set(eventId, firstSeen)
    }
    if (Date.now() - firstSeen < DECRYPTION_GRACE_MS) {
      decryptionPending = true
    } else {
      isDecryptionFailure = true
    }
  } else if (seenMap.has(eventId)) {
    seenMap.delete(eventId)
  }
  let content: Record<string, unknown>
  if (stillEncrypted) {
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

  const stateKey = event.getStateKey() ?? undefined
  let targetName: string | undefined
  let prevContent: Record<string, unknown> | undefined
  if (event.getType() === 'm.room.member' && stateKey) {
    const target = room.getMember(stateKey)
    targetName = target?.name || (content.displayname as string) || stateKey
    const prev = event.getPrevContent() as Record<string, unknown> | undefined
    if (prev && Object.keys(prev).length > 0) prevContent = prev
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
    decryptionPending,
    replyTo: replyToId,
    replyToEvent,
    threadRootId: getThreadRootId(event),
    reactions,
    stateKey,
    targetName,
    prevContent,
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

function countThreadReplies(room: Room): Map<string, number> {
  const counts = new Map<string, number>()
  let allTimelines
  try { allTimelines = room.getUnfilteredTimelineSet()?.getTimelines() } catch { return counts }
  if (!allTimelines) return counts
  for (const tl of allTimelines) {
    for (const e of tl.getEvents()) {
      const rootId = getThreadRootId(e)
      if (rootId) counts.set(rootId, (counts.get(rootId) || 0) + 1)
    }
  }
  return counts
}

// Grace window between an event first appearing as `m.room.encrypted` and
// us labeling it a permanent decryption failure. Most decryptions complete
// within a few hundred ms after the rust-crypto backend processes the
// associated to-device key, so 5s is generous without making real failures
// invisible for too long.
const DECRYPTION_GRACE_MS = 5000

// First time we observed a given event still encrypted, per room. Cleaned up
// once the event is decrypted (handled in mapEvent) and on room cleanup.
const firstSeenEncrypted = new WeakMap<Room, Map<string, number>>()

function getFirstSeenEncryptedForRoom(room: Room): Map<string, number> {
  let m = firstSeenEncrypted.get(room)
  if (!m) {
    m = new Map()
    firstSeenEncrypted.set(room, m)
  }
  return m
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

/**
 * Eagerly decrypt every encrypted event currently in the live timeline,
 * racing against a timeout so we never block the UI more than `timeoutMs`
 * even if a key is missing. Mirrors what Element/FluffyChat do on room
 * enter: the first frame the user sees has decrypted content rather than
 * placeholders that mutate moments later.
 */
async function decryptVisibleEvents(client: MatrixClient, room: Room, timeoutMs: number): Promise<void> {
  const tl = room.getLiveTimeline().getEvents()
  const encrypted = tl.filter((e) => e.isEncrypted() && e.getType() === 'm.room.encrypted')
  if (encrypted.length === 0) return

  const work = Promise.all(
    encrypted.map((e) => client.decryptEventIfNeeded(e).catch(() => {})),
  )
  await Promise.race([
    work,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])
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
      const isStillEncrypted = isEncrypted && e.getType() === 'm.room.encrypted'
      // pending→failed transition is purely time-based, so we must re-map any
      // cached pending event whose grace window has expired even if the SDK
      // says nothing changed.
      const cachedFlags = cache.get(id)?.ev
      const isPendingExpired =
        isStillEncrypted &&
        !!cachedFlags?.decryptionPending &&
        (() => {
          const seen = getFirstSeenEncryptedForRoom(room).get(id)
          return seen !== undefined && Date.now() - seen >= DECRYPTION_GRACE_MS
        })()
      const cached = cache.get(id)
      if (
        !isPendingExpired &&
        cached &&
        cached.editTs === editTs &&
        (cached.reactionCount ?? 0) === reactionCount &&
        cached.ev.isDecryptionFailure === (isStillEncrypted && !cached.ev.decryptionPending)
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

export function useTimeline(roomId: string, isAtBottomRef?: React.RefObject<boolean>) {
  const client = useMatrixClient()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [paginating, setPaginating] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const paginatingRef = useRef(false)
  const activeRoomIdRef = useRef(roomId)
  const prevEventIdsRef = useRef('')
  const decryptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const receiptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReceiptEventIdRef = useRef<string | null>(null)
  const [prevRoomId, setPrevRoomId] = useState(roomId)

  // Synchronous state reset during render — eliminates the stale-state frame
  // that useEffect (which fires after paint) cannot prevent. Seed events from
  // the SDK cache so revisits render messages immediately instead of flashing
  // a spinner while the post-paint effect runs.
  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId)
    const room = client?.getRoom(roomId) ?? null
    const cached = room ? collectEvents(room) : []
    setEvents(cached)
    // Keep the spinner up if we'd have to backfill anyway. Showing a few
    // cached events and then snapping to 30+ as pagination resolves is the
    // visible "jump" people complain about. The post-mount effect flips
    // loading=false once the timeline is filled and decrypted.
    const SHOW_CACHED_THRESHOLD = 30
    setLoading(cached.length < SHOW_CACHED_THRESHOLD)
    roomRef.current = room
    activeRoomIdRef.current = roomId
    prevEventIdsRef.current = cached.map((e) => e.eventId).join(',')
    paginatingRef.current = false
  }

  const refreshEvents = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    if (room.roomId !== activeRoomIdRef.current) return
    const newEvents = collectEvents(room)
    const newIds = newEvents.map((e) => e.eventId).join(',')
    if (newIds === prevEventIdsRef.current) return
    prevEventIdsRef.current = newIds

    setEvents(newEvents)

    // If anything is still in the decryption grace window, schedule a single
    // refresh at the earliest expiry so we can flip pending → failed without
    // waiting for the next sync to nudge us.
    schedulePendingExpiryRefreshRef.current?.(newEvents)
  }, [])

  // Forward declaration for the closure inside refreshEvents (assigned in effect).
  const schedulePendingExpiryRefreshRef = useRef<((events: TimelineEvent[]) => void) | null>(null)

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
      const type = ev.getType()
      if (type !== 'm.room.message' && type !== 'm.room.encrypted') continue
      // Skip thread replies — threads have their own read state and should
      // only be marked read when the user actually opens the thread.
      if (isThreadReply(ev)) continue
      const evId = ev.getId()
      if (!evId) break
      // Dedup: server already knows about the previous receipt — re-sending it
      // for the same event clogs the network and main thread, especially when
      // sync delivers a batch of timeline events in quick succession.
      if (lastReceiptEventIdRef.current === evId) return
      lastReceiptEventIdRef.current = evId
      client.sendReadReceipt(ev).catch(() => {})
      break
    }
  }, [])

  // Debounce wrapper: a single sync batch can fire RoomEvent.Timeline dozens
  // of times back-to-back. Without coalescing, each one queues a POST that
  // takes ~700ms and starves React's rendering work.
  const scheduleReadReceipt = useCallback(() => {
    if (receiptDebounceRef.current) clearTimeout(receiptDebounceRef.current)
    receiptDebounceRef.current = setTimeout(() => {
      receiptDebounceRef.current = null
      sendReadReceipt()
    }, 250)
  }, [sendReadReceipt])

  useEffect(() => {
    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    // Per-mount cancellation flag. activeRoomIdRef alone is insufficient:
    // on A→B→A it goes back to A and lets stale requests from the FIRST
    // mount write state into the SECOND mount, which intermittently flips
    // loading off with empty events on rapid chat switches.
    let cancelled = false

    roomRef.current = room
    // Reset receipt dedup when switching rooms — the lastReceipt eventId is
    // per-room, but the ref persists across mounts of this hook.
    lastReceiptEventIdRef.current = null

    // Schedule a single refresh when the soonest-expiring "decryption pending"
    // event would tip into "failed". Cleared and re-armed on each refresh so
    // we never queue a thundering herd of timers.
    schedulePendingExpiryRefreshRef.current = (currentEvents: TimelineEvent[]) => {
      if (graceExpiryTimerRef.current) {
        clearTimeout(graceExpiryTimerRef.current)
        graceExpiryTimerRef.current = null
      }
      const seenMap = getFirstSeenEncryptedForRoom(room)
      let earliestExpiry = Infinity
      for (const ev of currentEvents) {
        if (!ev.decryptionPending) continue
        const seen = seenMap.get(ev.eventId)
        if (seen === undefined) continue
        const expiry = seen + DECRYPTION_GRACE_MS
        if (expiry < earliestExpiry) earliestExpiry = expiry
      }
      if (earliestExpiry === Infinity) return
      const wait = Math.max(0, earliestExpiry - Date.now()) + 50
      graceExpiryTimerRef.current = setTimeout(() => {
        graceExpiryTimerRef.current = null
        if (cancelled) return
        // Same reasoning as onDecrypted: don't punch a partial refresh
        // into the middle of an active paginate loop.
        if (paginatingRef.current) return
        eventCache.delete(room)
        prevEventIdsRef.current = ''
        refreshEvents()
      }, wait)
    }

    // Pick up any events that arrived between the synchronous seed and effect mount.
    refreshEvents()
    setPaginating(false)
    sendReadReceipt()

    const timeline = room.getLiveTimeline()
    const finishLoading = async () => {
      // Backfill enough history before first paint so the user lands on a
      // populated timeline rather than seeing a few cached events jump to
      // many a moment later.
      const MIN_INITIAL_EVENTS = 30
      const MAX_INITIAL_PAGINATIONS = 3
      // Block user-triggered paginateBack while the initial backfill runs;
      // a layout-driven scroll-near-top could race a second concurrent
      // pagination otherwise.
      paginatingRef.current = true
      try {
        for (let i = 0; i < MAX_INITIAL_PAGINATIONS; i++) {
          if (cancelled) return
          if (collectEvents(room).length >= MIN_INITIAL_EVENTS) break
          if (!timeline.getPaginationToken(Direction.Backward)) break
          try {
            await client.paginateEventTimeline(timeline, { backwards: true, limit: 100 })
          } catch {
            break
          }
        }
      } finally {
        paginatingRef.current = false
      }
      if (cancelled) return

      // Eagerly decrypt before flipping loading=false so the very first
      // painted frame already shows real message content. Capped at 1.5s so
      // a stuck key request can't keep the spinner up indefinitely.
      try {
        await decryptVisibleEvents(client, room, 1500)
      } catch { /* timeout/no-op */ }
      if (cancelled) return

      // Re-collect after decryption so any newly-decrypted events get mapped
      // with their real content instead of the encrypted placeholder.
      eventCache.delete(room)
      const finalEvents = collectEvents(room)
      prevEventIdsRef.current = finalEvents.map((e) => e.eventId).join(',')
      setEvents(finalEvents)
      setLoading(false)
    }
    finishLoading()

    // RoomEvent.Timeline is a CLIENT-level event — it fires for every room.
    // Filter to the active room before doing any work; otherwise unrelated
    // sync traffic causes refreshEvents/sendReadReceipt to run pointlessly.
    //
    // Also bail out while a backward-pagination is in flight: each of the
    // ~100 fetched events fires this listener and a per-event refreshEvents
    // would trigger N separate setEvents cycles. The pagination caller does
    // a single bulk refreshEvents after the await completes.
    const onTimelineEvent = (_event: MatrixEvent, evRoom: Room | undefined) => {
      if (cancelled) return
      if (!evRoom || evRoom.roomId !== activeRoomIdRef.current) return
      if (paginatingRef.current) return
      prevEventIdsRef.current = ''
      refreshEvents()
      // Only mark as read if user is scrolled to the bottom (can see new messages)
      if (!isAtBottomRef || isAtBottomRef.current) {
        scheduleReadReceipt()
      }
    }
    const onRedaction = (_event: MatrixEvent, evRoom: Room | undefined) => {
      if (cancelled) return
      if (!evRoom || evRoom.roomId !== activeRoomIdRef.current) return
      if (paginatingRef.current) return
      prevEventIdsRef.current = ''
      refreshEvents()
    }
    const onDecrypted = () => {
      if (cancelled) return
      const room = roomRef.current
      if (!room) return
      // Clear cache so newly-decrypted events get re-mapped with actual content
      eventCache.delete(room)
      // Debounce: batch rapid decryption events into a single refresh
      // to avoid "too many re-renders" when opening encrypted rooms
      if (decryptDebounceRef.current) clearTimeout(decryptDebounceRef.current)
      decryptDebounceRef.current = setTimeout(() => {
        decryptDebounceRef.current = null
        if (cancelled) return
        // Skip during active pagination — the multi-step paginate loop
        // will refresh once at the end. A mid-loop refresh would commit
        // a partial event list and consume our prepend-effect's
        // captured height/top, leaving the rest of the loop's items
        // un-anchored (visible as a discrete scroll jump).
        if (paginatingRef.current) return
        prevEventIdsRef.current = ''
        refreshEvents()
      }, 100)
    }

    client.on(RoomEvent.Timeline, onTimelineEvent)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)

    return () => {
      cancelled = true
      if (decryptDebounceRef.current) {
        clearTimeout(decryptDebounceRef.current)
        decryptDebounceRef.current = null
      }
      if (receiptDebounceRef.current) {
        clearTimeout(receiptDebounceRef.current)
        receiptDebounceRef.current = null
      }
      if (graceExpiryTimerRef.current) {
        clearTimeout(graceExpiryTimerRef.current)
        graceExpiryTimerRef.current = null
      }
      schedulePendingExpiryRefreshRef.current = null
      client.removeListener(RoomEvent.Timeline, onTimelineEvent)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [roomId, refreshEvents, sendReadReceipt, scheduleReadReceipt, client])

  const paginateBack = useCallback(async () => {
    if (paginatingRef.current) return
    const room = roomRef.current
    if (!client || !room) return

    const timeline = room.getLiveTimeline()
    const token = timeline.getPaginationToken(Direction.Backward)
    if (!token) return

    const startedRoomId = room.roomId
    const beforeCount = collectEvents(room).length
    paginatingRef.current = true
    setPaginating(true)
    // collectEvents drops state changes, edits, redactions, and thread
    // replies. A single 100-event paginate request can return mostly such
    // filtered events, leaving the user with only a handful of new
    // displayable messages — and back inside the near-top trigger zone
    // immediately after the restore. We loop until enough displayable
    // events are added (or we run out of history / hit the attempt cap)
    // so each user-triggered paginate is one substantial step.
    const MIN_ADDED_EVENTS = 15
    const MAX_PAGINATIONS_PER_TRIGGER = 5
    try {
      let attempts = 0
      while (attempts < MAX_PAGINATIONS_PER_TRIGGER) {
        attempts++
        if (!timeline.getPaginationToken(Direction.Backward)) break
        try {
          await client.paginateEventTimeline(timeline, { backwards: true, limit: 100 })
        } catch {
          break
        }
        if (activeRoomIdRef.current !== startedRoomId) break
        const totalAdded = collectEvents(room).length - beforeCount
        if (totalAdded >= MIN_ADDED_EVENTS) break
      }
      if (activeRoomIdRef.current === startedRoomId) {
        // Eagerly decrypt the newly-fetched encrypted events before
        // refreshEvents commits them. Otherwise they paint as small
        // "decrypting…" placeholders, then the post-commit decryption
        // listener flushes ~100ms later with real bodies — height grows
        // by hundreds of pixels and the user sees a delayed jerk *after*
        // the prepend-effect already settled. Capped at 1.5s in case keys
        // are missing.
        try {
          await decryptVisibleEvents(client, room, 1500)
        } catch { /* timeout/no-op */ }
        if (activeRoomIdRef.current !== startedRoomId) return
        // Re-collect after decryption so we map with real content.
        eventCache.delete(room)
        // Single bulk update for the whole batch. The Timeline-event
        // listener was silenced for the duration of the await so each
        // fetched event didn't re-run refreshEvents; this one call after
        // the fact replaces ~100 listener-driven refreshes.
        prevEventIdsRef.current = ''
        refreshEvents()
      }
    } finally {
      if (activeRoomIdRef.current === startedRoomId) {
        paginatingRef.current = false
        setPaginating(false)
      }
    }
  }, [client, refreshEvents])

  return { events, loading, paginating, paginateBack }
}
