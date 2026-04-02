import { useRef, useCallback, useState, useEffect } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useTimeline } from '../hooks/useTimeline.js'
import { TimelineItem } from './TimelineItem.js'
import { DateSeparator } from './DateSeparator.js'
import { TypingIndicator } from './TypingIndicator.js'
import { Spinner } from '../../../shared/ui/index.js'
import { TimelineScrollContext } from '../context/TimelineScrollContext.js'
import styles from './Timeline.module.scss'

interface TimelineProps {
  roomId: string
}

const START_INDEX = 100_000

export function Timeline({ roomId }: TimelineProps) {
  const { events, loading, paginating, canPaginateBack, paginateBack } = useTimeline(roomId)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX)
  const prevFirstEventIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (events.length === 0) {
      prevFirstEventIdRef.current = null
      return
    }
    const prevFirstId = prevFirstEventIdRef.current
    const currentFirstId = events[0]?.eventId
    if (prevFirstId && currentFirstId !== prevFirstId) {
      const oldIndex = events.findIndex((e) => e.eventId === prevFirstId)
      if (oldIndex > 0) {
        setFirstItemIndex((prev) => prev - oldIndex)
      }
    }
    prevFirstEventIdRef.current = currentFirstId
  }, [events])

  const scrollToEvent = useCallback((eventId: string) => {
    const index = events.findIndex((e) => e.eventId === eventId)
    if (index === -1) return
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
    setHighlightedEventId(eventId)
    setTimeout(() => setHighlightedEventId(null), 2000)
  }, [events])

  const handleStartReached = useCallback(() => {
    if (canPaginateBack && !paginating) {
      paginateBack()
    }
  }, [canPaginateBack, paginating, paginateBack])

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} />
      </div>
    )
  }

  if (events.length === 0) {
    return <div className={styles.empty}>Нет сообщений</div>
  }

  return (
    <TimelineScrollContext.Provider value={scrollToEvent}>
      <div className={styles.container}>
        <Virtuoso
          ref={virtuosoRef}
          data={events}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={events.length - 1}
          followOutput="smooth"
          startReached={handleStartReached}
          itemContent={(index, event) => {
            const arrayIndex = index - firstItemIndex
            const prev = arrayIndex > 0 ? events[arrayIndex - 1] : null
            const showDate = !prev || !isSameDay(prev.timestamp, event.timestamp)
            const showAvatar = !prev || prev.sender !== event.sender || showDate

            return (
              <>
                {showDate && <DateSeparator timestamp={event.timestamp} />}
                <TimelineItem
                  event={event}
                  showAvatar={showAvatar}
                  isHighlighted={highlightedEventId === event.eventId}
                />
              </>
            )
          }}
          components={{
            Header: () =>
              paginating ? (
                <div className={styles.paginationLoader}>
                  <Spinner size={20} />
                </div>
              ) : null,
            Footer: () => <TypingIndicator roomId={roomId} />,
          }}
        />
      </div>
    </TimelineScrollContext.Provider>
  )
}

function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}
