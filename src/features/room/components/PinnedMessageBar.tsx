import { useEffect, useState, useCallback } from 'react'
import { Pin, ChevronUp, ChevronDown } from 'lucide-react'
import { RoomStateEvent, MatrixEvent as MatrixEventClass } from 'matrix-js-sdk'
import type { MatrixEvent } from 'matrix-js-sdk'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useTimelineScroll } from '../context/TimelineScrollContext.js'
import { sanitizeHtml } from '../../../shared/lib/sanitizeHtml.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './PinnedMessageBar.module.scss'

/**
 * Resolve a pinned event: try local timeline first, then fetch + decrypt from server.
 * This mirrors the FluffyChat approach — always fetch & decrypt so encrypted rooms work.
 */
async function resolveEvent(
  client: import('matrix-js-sdk').MatrixClient,
  room: import('matrix-js-sdk').Room,
  eventId: string,
): Promise<MatrixEvent | null> {
  // 1. Try local timeline (already decrypted)
  const cached = room.findEventById(eventId)
  if (cached && !cached.isRedacted() && (cached.getContent().body as string)) {
    return cached
  }

  // 2. Fetch from server and decrypt if needed
  try {
    const raw = await client.fetchRoomEvent(room.roomId, eventId)
    if (!raw) return null
    const matrixEvent = new MatrixEventClass(raw)
    if (matrixEvent.isRedacted()) return null
    if (matrixEvent.isEncrypted()) {
      await client.decryptEventIfNeeded(matrixEvent)
    }
    return matrixEvent
  } catch {
    return null
  }
}

interface PinnedMessageBarProps {
  roomId: string
}

interface PinnedMsg {
  eventId: string
  body: string
  sender: string
}

export function PinnedMessageBar({ roomId }: PinnedMessageBarProps) {
  const client = useMatrixClient()
  const { scrollToEvent } = useTimelineScroll()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMsg[]>([])
  const [navigating, setNavigating] = useState(false)

  const loadPinned = useCallback(async () => {
    if (!client) return

    const room = client.getRoom(roomId)
    if (!room) return

    const pinEvent = room.currentState.getStateEvents('m.room.pinned_events', '')
    const pinned = (pinEvent?.getContent()?.pinned as string[]) || []
    if (pinned.length === 0) {
      setPinnedMessages([])
      return
    }

    const msgs: PinnedMsg[] = []
    for (const eventId of pinned) {
      try {
        const ev = await resolveEvent(client, room, eventId)
        if (!ev) continue
        const body = (ev.getContent().body as string) || ''
        if (!body) continue
        const member = room.getMember(ev.getSender()!)
        const sender = member?.name || ev.getSender()!
        msgs.push({ eventId, body, sender })
      } catch {
        continue
      }
    }
    setPinnedMessages(msgs)
  }, [roomId, client])

  useEffect(() => {
    setCurrentIndex(0)
    loadPinned()

    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return

    const onStateEvent = (event: MatrixEvent) => {
      if (event.getType() === 'm.room.pinned_events' && event.getRoomId() === roomId) {
        loadPinned()
      }
    }
    room.currentState.on(RoomStateEvent.Events, onStateEvent)

    return () => {
      room.currentState.removeListener(RoomStateEvent.Events, onStateEvent)
    }
  }, [roomId, loadPinned, client])

  if (pinnedMessages.length === 0) return null

  const current = pinnedMessages[currentIndex] || pinnedMessages[0]

  const handlePrev = () => {
    setCurrentIndex((i) => (i - 1 + pinnedMessages.length) % pinnedMessages.length)
  }

  const handleNext = () => {
    setCurrentIndex((i) => (i + 1) % pinnedMessages.length)
  }

  const handleClick = async () => {
    if (navigating) return
    setNavigating(true)
    try {
      await scrollToEvent(current.eventId)
    } finally {
      setNavigating(false)
    }
  }

  return (
    <div className={`${styles.bar} ${navigating ? styles.barLoading : ''}`}>
      {navigating ? (
        <Spinner size={16} />
      ) : (
        <Pin size={16} className={styles.pinIcon} />
      )}
      <button className={styles.content} onClick={handleClick} disabled={navigating}>
        <span className={styles.sender}>{current.sender}</span>
        <span
          className={styles.body}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(
              current.body
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, ' ')
            ),
          }}
        />
      </button>
      {pinnedMessages.length > 1 && (
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={handlePrev} disabled={navigating}>
            <ChevronUp size={16} />
          </button>
          <span className={styles.counter}>{currentIndex + 1}/{pinnedMessages.length}</span>
          <button className={styles.navBtn} onClick={handleNext} disabled={navigating}>
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
