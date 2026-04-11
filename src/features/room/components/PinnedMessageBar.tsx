import { useEffect, useState, useCallback } from 'react'
import { Pin, ChevronUp, ChevronDown, X } from 'lucide-react'
import { RoomStateEvent } from 'matrix-js-sdk'
import type { MatrixEvent } from 'matrix-js-sdk'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useTimelineScroll } from '../context/TimelineScrollContext.js'
import styles from './PinnedMessageBar.module.scss'

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
  const scrollToEvent = useTimelineScroll()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMsg[]>([])

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
      let body = ''
      let sender = ''

      const cached = room.findEventById(eventId)
      if (cached) {
        if (cached.isRedacted()) continue // skip deleted pinned messages
        body = (cached.getContent().body as string) || ''
        const member = room.getMember(cached.getSender()!)
        sender = member?.name || cached.getSender()!
      } else {
        try {
          const fetched = await client.fetchRoomEvent(roomId, eventId)
          body = (fetched?.content?.body as string) || ''
          sender = (fetched?.sender as string) || ''
          if (sender) {
            const member = room.getMember(sender)
            if (member) sender = member.name || sender
          }
        } catch {
          continue
        }
      }

      if (body) {
        msgs.push({ eventId, body, sender })
      }
    }
    setPinnedMessages(msgs)
  }, [roomId, client])

  useEffect(() => {
    setDismissed(false)
    setCurrentIndex(0)
    loadPinned()

    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return

    // Listen for state event changes (pin/unpin)
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

  if (pinnedMessages.length === 0 || dismissed) return null

  const current = pinnedMessages[currentIndex] || pinnedMessages[0]

  const handlePrev = () => {
    setCurrentIndex((i) => (i - 1 + pinnedMessages.length) % pinnedMessages.length)
  }

  const handleNext = () => {
    setCurrentIndex((i) => (i + 1) % pinnedMessages.length)
  }

  const handleClick = () => {
    scrollToEvent(current.eventId)
  }

  return (
    <div className={styles.bar}>
      <Pin size={16} className={styles.pinIcon} />
      <button className={styles.content} onClick={handleClick}>
        <span className={styles.sender}>{current.sender}</span>
        <span className={styles.body}>{current.body}</span>
      </button>
      {pinnedMessages.length > 1 && (
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={handlePrev}>
            <ChevronUp size={16} />
          </button>
          <span className={styles.counter}>{currentIndex + 1}/{pinnedMessages.length}</span>
          <button className={styles.navBtn} onClick={handleNext}>
            <ChevronDown size={16} />
          </button>
        </div>
      )}
      <button className={styles.closeBtn} onClick={() => setDismissed(true)}>
        <X size={14} />
      </button>
    </div>
  )
}
