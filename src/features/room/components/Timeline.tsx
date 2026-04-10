import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useTimeline } from '../hooks/useTimeline.js'
import { TimelineItem } from './TimelineItem.js'
import { DateSeparator } from './DateSeparator.js'
import { TypingIndicator } from './TypingIndicator.js'
import { Spinner } from '../../../shared/ui/index.js'
import { TimelineScrollContext } from '../context/TimelineScrollContext.js'
import { PinnedMessageBar } from './PinnedMessageBar.js'
import type { TimelineEvent } from '../types.js'
import styles from './Timeline.module.scss'

interface TimelineProps {
  roomId: string
  focusEventId?: string
  onFocusHandled?: () => void
}

interface ListItem {
  type: 'date' | 'event'
  key: string
  event?: TimelineEvent
  timestamp?: number
  showAvatar?: boolean
}

function buildListItems(events: TimelineEvent[]): ListItem[] {
  const items: ListItem[] = []
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const prev = i > 0 ? events[i - 1] : null
    const showDate = !prev || !isSameDay(prev.timestamp, event.timestamp)
    const showAvatar = !prev || prev.sender !== event.sender || showDate

    if (showDate) {
      items.push({ type: 'date', key: `date-${event.timestamp}`, timestamp: event.timestamp })
    }
    items.push({ type: 'event', key: event.eventId, event, showAvatar })
  }
  return items
}

const START_INDEX = 100_000

export function Timeline({ roomId, focusEventId, onFocusHandled }: TimelineProps) {
  const { events, loading, paginateBack, prependCount } = useTimeline(roomId)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const focusHandledRef = useRef<string | null>(null)
  const paginateBackRef = useRef(paginateBack)

  const listItems = useMemo(() => buildListItems(events), [events])

  const dateItemsInPrepend = useMemo(() => {
    if (prependCount === 0 || events.length === 0) return 0
    let count = 0
    for (let i = 0; i < Math.min(prependCount, events.length); i++) {
      const prev = i > 0 ? events[i - 1] : null
      if (!prev || !isSameDay(prev.timestamp, events[i].timestamp)) {
        count++
      }
    }
    return count
  }, [prependCount, events])

  const firstItemIndex = START_INDEX - prependCount - dateItemsInPrepend

  useEffect(() => {
    paginateBackRef.current = paginateBack
  }, [paginateBack])

  useEffect(() => {
    focusHandledRef.current = null
  }, [roomId])

  const focusIndex = useMemo(() => {
    if (!focusEventId || listItems.length === 0) return -1
    return listItems.findIndex((item) => item.key === focusEventId)
  }, [focusEventId, listItems])

  useEffect(() => {
    if (!focusEventId || focusIndex === -1) return
    if (focusHandledRef.current === focusEventId) return

    focusHandledRef.current = focusEventId

    const highlightTimer = setTimeout(() => {
      setHighlightedEventId(focusEventId)
    }, 200)

    const clearTimer = setTimeout(() => {
      setHighlightedEventId(null)
      onFocusHandled?.()
    }, 2500)

    return () => {
      clearTimeout(highlightTimer)
      clearTimeout(clearTimer)
    }
  }, [focusEventId, focusIndex, onFocusHandled])

  const scrollToEvent = useCallback((eventId: string) => {
    const index = listItems.findIndex((item) => item.key === eventId)
    if (index === -1) return
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
    setHighlightedEventId(eventId)
    setTimeout(() => setHighlightedEventId(null), 2000)
  }, [listItems])

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
      <div className={styles.container} role="log" aria-live="polite">
        <Virtuoso
          key={roomId}
          ref={virtuosoRef}
          data={listItems}
          computeItemKey={(_, item) => item.key}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={focusIndex >= 0 ? focusIndex : listItems.length - 1}
          alignToBottom
          followOutput="smooth"
          startReached={handleStartReached}
          increaseViewportBy={{ top: 1500, bottom: 0 }}
          itemContent={(_, item) => {
            if (item.type === 'date') {
              return <DateSeparator timestamp={item.timestamp!} />
            }
            return (
              <TimelineItem
                event={item.event!}
                showAvatar={item.showAvatar!}
                isHighlighted={highlightedEventId === item.event!.eventId}
              />
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
