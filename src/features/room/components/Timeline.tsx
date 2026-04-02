import { useRef, useCallback, useState, useEffect } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useTimeline } from '../hooks/useTimeline.js'
import { TimelineItem } from './TimelineItem.js'
import { DateSeparator } from './DateSeparator.js'
import { TypingIndicator } from './TypingIndicator.js'
import { Spinner } from '../../../shared/ui/index.js'
import { TimelineScrollContext } from '../context/TimelineScrollContext.js'
import { PinnedMessageBar } from './PinnedMessageBar.js'
import styles from './Timeline.module.scss'

interface TimelineProps {
  roomId: string
  focusEventId?: string
  onFocusHandled?: () => void
}

const START_INDEX = 100_000

export function Timeline({ roomId, focusEventId, onFocusHandled }: TimelineProps) {
  const { events, loading, paginateBack } = useTimeline(roomId)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const focusHandledRef = useRef<string | null>(null)
  const paginateBackRef = useRef(paginateBack)

  const [indexState, setIndexState] = useState({
    trackedRoomId: roomId,
    baseCount: 0,
  })

  if (indexState.trackedRoomId !== roomId) {
    setIndexState({ trackedRoomId: roomId, baseCount: 0 })
  }

  let baseCount = indexState.baseCount
  if (baseCount === 0 && events.length > 0) {
    baseCount = events.length
    setIndexState({ trackedRoomId: roomId, baseCount })
  }

  const grown = events.length > baseCount ? events.length - baseCount : 0
  const firstItemIndex = START_INDEX - grown

  useEffect(() => {
    paginateBackRef.current = paginateBack
  }, [paginateBack])

  useEffect(() => {
    focusHandledRef.current = null
  }, [roomId])


  useEffect(() => {
    if (!focusEventId || events.length === 0) return
    if (focusHandledRef.current === focusEventId) return

    const index = events.findIndex((e) => e.eventId === focusEventId)
    if (index === -1) return

    focusHandledRef.current = focusEventId

    const scrollTimer = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
    }, 100)

    const highlightTimer = setTimeout(() => {
      setHighlightedEventId(focusEventId)
    }, 400)

    const clearTimer = setTimeout(() => {
      setHighlightedEventId(null)
      onFocusHandled?.()
    }, 2500)

    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(highlightTimer)
      clearTimeout(clearTimer)
    }
  }, [focusEventId, events, onFocusHandled])

  const scrollToEvent = useCallback((eventId: string) => {
    const index = events.findIndex((e) => e.eventId === eventId)
    if (index === -1) return
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
    setHighlightedEventId(eventId)
    setTimeout(() => setHighlightedEventId(null), 2000)
  }, [events])

  const handleStartReached = useCallback(() => {
    paginateBackRef.current()
  }, [])


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
      <PinnedMessageBar roomId={roomId} />
      <div className={styles.container}>
        <Virtuoso
          key={roomId}
          ref={virtuosoRef}
          data={events}
          computeItemKey={(index) => {
            const arrayIndex = index - firstItemIndex
            return events[arrayIndex]?.eventId ?? `idx-${index}`
          }}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={events.length - 1}
          followOutput="smooth"
          startReached={handleStartReached}
          increaseViewportBy={{ top: 800, bottom: 0 }}
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
