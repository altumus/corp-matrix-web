import { useState, useCallback, useEffect } from 'react'
import { AtSign } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { NotificationCountType } from 'matrix-js-sdk'
import { useTimelineScroll } from '../context/TimelineScrollContext.js'
import styles from './MentionNavigator.module.scss'

interface MentionNavigatorProps {
  roomId: string
}

/** Find all event IDs in room where the current user is mentioned */
function findMentionEventIds(roomId: string): string[] {
  const client = getMatrixClient()
  if (!client) return []

  const room = client.getRoom(roomId)
  if (!room) return []

  const myUserId = client.getUserId()
  if (!myUserId) return []

  const highlightCount = room.getRoomUnreadNotificationCount(NotificationCountType.Highlight)
  if (!highlightCount) return []

  const timeline = room.getLiveTimeline().getEvents()
  const mentionIds: string[] = []
  const encodedId = encodeURIComponent(myUserId)

  for (const ev of timeline) {
    if (ev.getSender() === myUserId) continue
    if (ev.isRedacted()) continue

    const content = ev.getContent()

    // Check m.mentions spec field
    const mentions = content['m.mentions'] as { user_ids?: string[]; room?: boolean } | undefined
    if (mentions?.user_ids?.includes(myUserId) || mentions?.room) {
      mentionIds.push(ev.getId()!)
      continue
    }

    // Check formatted_body for matrix.to mention pills
    const html = (content.formatted_body as string) || ''
    if (html.includes(`matrix.to/#/${encodedId}`) || html.includes(`matrix.to/#/${myUserId}`)) {
      mentionIds.push(ev.getId()!)
    }
  }

  return mentionIds
}

export function MentionNavigator({ roomId }: MentionNavigatorProps) {
  const { scrollToEvent } = useTimelineScroll()
  const [, setSearchParams] = useSearchParams()
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const ids = findMentionEventIds(roomId)
    setMentionIds(ids)
    setCurrentIndex(0)
  }, [roomId])

  const handleClick = useCallback(() => {
    if (mentionIds.length === 0) return

    const targetId = mentionIds[currentIndex]
    // Update URL so reload / share keeps the position
    setSearchParams({ eventId: targetId }, { replace: true })
    scrollToEvent(targetId)
    setCurrentIndex((i) => (i + 1) % mentionIds.length)
  }, [mentionIds, currentIndex, scrollToEvent, setSearchParams])

  if (mentionIds.length === 0) return null

  return (
    <button
      className={styles.button}
      onClick={handleClick}
      title={`${mentionIds.length} упоминаний — нажмите для навигации`}
      aria-label={`${mentionIds.length} упоминаний`}
    >
      <AtSign size={18} />
      {mentionIds.length > 1 && (
        <span className={styles.count}>{mentionIds.length}</span>
      )}
    </button>
  )
}
