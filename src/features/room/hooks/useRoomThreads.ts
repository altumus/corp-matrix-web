import { useCallback, useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { RoomEvent, MatrixEventEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'

export interface ThreadSummary {
  rootEventId: string
  rootSender: string
  rootSenderName: string
  rootSenderAvatar: string | null
  rootBody: string
  rootIsRedacted: boolean
  rootTimestamp: number
  replyCount: number
  lastReplyTimestamp: number
  lastReplySender: string
  lastReplySenderName: string
  lastReplyBody: string
  unread: boolean
}

function getRelatesTo(e: MatrixEvent): Record<string, unknown> | undefined {
  return e.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
}

function isThreadReply(e: MatrixEvent): { rootId: string } | null {
  const rel = getRelatesTo(e)
  if (rel?.rel_type === 'm.thread' && typeof rel.event_id === 'string') {
    return { rootId: rel.event_id }
  }
  return null
}

function effectiveContent(e: MatrixEvent): Record<string, unknown> {
  const replacing = e.replacingEvent()
  const newContent = replacing?.getContent()?.['m.new_content'] as Record<string, unknown> | undefined
  return newContent ?? e.getContent()
}

function bodyText(content: Record<string, unknown>): string {
  const b = content.body
  return typeof b === 'string' ? b : ''
}

export function roomHasUnreadThreads(room: Room, myUserId: string | null): boolean {
  if (!myUserId) return false
  let timelines
  try {
    timelines = room.getUnfilteredTimelineSet()?.getTimelines()
  } catch {
    return false
  }
  if (!timelines) return false

  // Track latest non-redacted reply per thread root
  const latestPerRoot = new Map<string, MatrixEvent>()
  for (const tl of timelines) {
    for (const e of tl.getEvents()) {
      const rel = getRelatesTo(e)
      if (rel?.rel_type === 'm.replace') continue
      if (e.isRedacted()) continue
      if (rel?.rel_type !== 'm.thread') continue
      const rootId = rel.event_id as string | undefined
      if (!rootId) continue
      const cur = latestPerRoot.get(rootId)
      if (!cur || cur.getTs() < e.getTs()) latestPerRoot.set(rootId, e)
    }
  }

  for (const ev of latestPerRoot.values()) {
    if (ev.getSender() === myUserId) continue
    try {
      if (!room.hasUserReadEvent(myUserId, ev.getId()!)) return true
    } catch {
      /* ignore */
    }
  }
  return false
}

function collectThreads(room: Room, myUserId: string | null): ThreadSummary[] {
  let timelines
  try {
    timelines = room.getUnfilteredTimelineSet()?.getTimelines()
  } catch {
    return []
  }
  if (!timelines) return []

  type Agg = {
    rootId: string
    replyCount: number
    lastReplyTs: number
    lastReplyEvent: MatrixEvent | null
  }
  const aggByRoot = new Map<string, Agg>()

  for (const tl of timelines) {
    for (const e of tl.getEvents()) {
      // skip edits — they relate to original via m.replace, not a thread
      const rel = getRelatesTo(e)
      if (rel?.rel_type === 'm.replace') continue
      if (e.isRedacted()) continue
      const threadInfo = isThreadReply(e)
      if (!threadInfo) continue

      const rootId = threadInfo.rootId
      const ts = e.getTs()
      let agg = aggByRoot.get(rootId)
      if (!agg) {
        agg = { rootId, replyCount: 0, lastReplyTs: 0, lastReplyEvent: null }
        aggByRoot.set(rootId, agg)
      }
      agg.replyCount += 1
      if (ts >= agg.lastReplyTs) {
        agg.lastReplyTs = ts
        agg.lastReplyEvent = e
      }
    }
  }

  const summaries: ThreadSummary[] = []
  for (const agg of aggByRoot.values()) {
    const rootEv = room.findEventById(agg.rootId)
    if (!rootEv) continue

    const rootSenderId = rootEv.getSender() ?? ''
    const rootMember = room.getMember(rootSenderId)
    const rootContent = effectiveContent(rootEv)
    const rootBody = bodyText(rootContent)

    const lastEv = agg.lastReplyEvent
    const lastSenderId = lastEv?.getSender() ?? ''
    const lastMember = lastEv ? room.getMember(lastSenderId) : null
    const lastContent = lastEv ? effectiveContent(lastEv) : {}
    const lastBody = bodyText(lastContent)

    let unread = false
    if (myUserId && lastEv && lastSenderId !== myUserId) {
      try {
        unread = !room.hasUserReadEvent(myUserId, lastEv.getId()!)
      } catch {
        unread = false
      }
    }

    summaries.push({
      rootEventId: agg.rootId,
      rootSender: rootSenderId,
      rootSenderName: rootMember?.name || rootSenderId,
      rootSenderAvatar: rootMember?.getMxcAvatarUrl() ?? null,
      rootBody,
      rootIsRedacted: rootEv.isRedacted(),
      rootTimestamp: rootEv.getTs(),
      replyCount: agg.replyCount,
      lastReplyTimestamp: agg.lastReplyTs,
      lastReplySender: lastSenderId,
      lastReplySenderName: lastMember?.name || lastSenderId,
      lastReplyBody: lastBody,
      unread,
    })
  }

  summaries.sort((a, b) => b.lastReplyTimestamp - a.lastReplyTimestamp)
  return summaries
}

export function useRoomThreads(roomId: string) {
  const client = useMatrixClient()
  const [threads, setThreads] = useState<ThreadSummary[]>([])

  const refresh = useCallback(() => {
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) {
      setThreads([])
      return
    }
    setThreads(collectThreads(room, client.getUserId()))
  }, [client, roomId])

  useEffect(() => {
    refresh()
    if (!client) return

    const onTimeline = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onRedaction = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onReceipt = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onDecrypted = () => refresh()

    client.on(RoomEvent.Timeline, onTimeline)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(RoomEvent.Receipt, onReceipt)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(RoomEvent.Receipt, onReceipt)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [client, roomId, refresh])

  return threads
}

export function useRoomHasUnreadThreads(roomId: string): boolean {
  const client = useMatrixClient()
  const [hasUnread, setHasUnread] = useState(false)

  const refresh = useCallback(() => {
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) {
      setHasUnread(false)
      return
    }
    setHasUnread(roomHasUnreadThreads(room, client.getUserId()))
  }, [client, roomId])

  useEffect(() => {
    refresh()
    if (!client) return

    const onTimeline = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onReceipt = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onRedaction = (_e: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== roomId) return
      refresh()
    }
    const onDecrypted = () => refresh()

    client.on(RoomEvent.Timeline, onTimeline)
    client.on(RoomEvent.Receipt, onReceipt)
    client.on(RoomEvent.Redaction, onRedaction)
    client.on(MatrixEventEvent.Decrypted, onDecrypted)
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline)
      client.removeListener(RoomEvent.Receipt, onReceipt)
      client.removeListener(RoomEvent.Redaction, onRedaction)
      client.removeListener(MatrixEventEvent.Decrypted, onDecrypted)
    }
  }, [client, roomId, refresh])

  return hasUnread
}
