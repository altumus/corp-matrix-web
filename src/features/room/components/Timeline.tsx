import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useTimeline } from '../hooks/useTimeline.js'
import { TimelineItem } from './TimelineItem.js'
import { DateSeparator } from './DateSeparator.js'
import { TypingIndicator } from './TypingIndicator.js'
import { ScrollToBottomFab } from './ScrollToBottomFab.js'
import { Spinner } from '../../../shared/ui/index.js'
import { TimelineScrollContext } from '../context/TimelineScrollContext.js'
import { PinnedMessageBar } from './PinnedMessageBar.js'
import type { TimelineEvent } from '../types.js'
import type { TimelineScrollApi } from '../context/TimelineScrollContext.js'
import { useRoomListStore } from '../../../features/room-list/store/roomListStore.js'
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
  const isAtBottomRef = useRef(true)
  const { events, loading, paginateBack, prependCount } = useTimeline(roomId, isAtBottomRef)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const focusHandledRef = useRef<string | null>(null)
  const paginateBackRef = useRef(paginateBack)
  const lastEventIdRef = useRef<string | null>(null)

  // Mask Virtuoso's brief empty paint after key={roomId} forces a remount.
  // Without this, rapid chat switches expose a frame of dark, item-less viewport
  // (timeline picks up cached events synchronously, so loading=false, but
  // Virtuoso hasn't measured its items yet for the new mount).
  const [trackedRoomId, setTrackedRoomId] = useState(roomId)
  const [virtuosoReady, setVirtuosoReady] = useState(true)
  if (trackedRoomId !== roomId) {
    setTrackedRoomId(roomId)
    setVirtuosoReady(false)
  }
  useEffect(() => {
    setVirtuosoReady(true)
  }, [roomId])

  const setScrollState = useRoomListStore((s) => s.setScrollState)

  // Save/restore scroll position on room switch.
  // We only persist scrollTop (a plain number) because full Virtuoso snapshots
  // break when the item list changes between save and restore (different
  // firstItemIndex after pagination causes Virtuoso to access undefined items).
  const savedScrollTop = useMemo(
    () => useRoomListStore.getState().scrollStates[roomId] as number | undefined,
    [roomId],
  )
  const scrollRestoredRef = useRef(false)

  // Save scroll position on unmount / room change
  useEffect(() => {
    const ref = virtuosoRef
    return () => {
      ref.current?.getState((snapshot) => {
        setScrollState(roomId, snapshot.scrollTop)
      })
    }
  }, [roomId, setScrollState])

  const listItems = useMemo(() => buildListItems(events), [events])
  const listItemsRef = useRef(listItems)
  listItemsRef.current = listItems

  useEffect(() => {
    scrollRestoredRef.current = false
  }, [roomId])

  // Restore scroll position once items are rendered
  useEffect(() => {
    if (scrollRestoredRef.current || savedScrollTop === undefined) return
    if (listItems.length === 0) return
    scrollRestoredRef.current = true
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollTo({ top: savedScrollTop })
    })
  }, [savedScrollTop, listItems.length])

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

  // Announce new messages to screen readers
  useEffect(() => {
    if (events.length === 0) return
    const last = events[events.length - 1]
    if (lastEventIdRef.current && lastEventIdRef.current !== last.eventId) {
      const body = (last.content?.body as string) || ''
      const preview = body.slice(0, 80)
      setAnnouncement(`Новое сообщение от ${last.senderName}: ${preview}`)
      if (!isAtBottomRef.current) {
        setNewMessageCount((c) => c + 1)
      }
    }
    lastEventIdRef.current = last.eventId
  }, [events])

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

  const scrollHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const highlightAndScroll = useCallback((eventId: string, items: ListItem[]) => {
    const index = items.findIndex((item) => item.key === eventId)
    if (index === -1) return false
    isAtBottomRef.current = false
    setIsAtBottom(false)
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
    setHighlightedEventId(eventId)
    if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current)
    scrollHighlightTimerRef.current = setTimeout(() => {
      setHighlightedEventId(null)
      scrollHighlightTimerRef.current = null
    }, 10000)
    return true
  }, [])

  const waitForRender = useCallback(() =>
    new Promise<void>((r) => setTimeout(r, 200)), [])

  const scrollToEvent = useCallback(async (eventId: string) => {
    // Try to scroll immediately
    if (highlightAndScroll(eventId, listItemsRef.current)) return

    // Event not in loaded timeline — paginate back until found
    const maxAttempts = 10
    for (let i = 0; i < maxAttempts; i++) {
      await paginateBackRef.current()
      // Wait for React to re-render with new listItems
      await waitForRender()
      // Check latest listItems via ref
      if (highlightAndScroll(eventId, listItemsRef.current)) return
    }
  }, [highlightAndScroll, waitForRender])

  // Cleanup scrollToEvent timer on unmount
  useEffect(() => {
    return () => {
      if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })
    setNewMessageCount(0)
  }, [])

  const scrollApi = useMemo<TimelineScrollApi>(() => ({ scrollToEvent, scrollToBottom }), [scrollToEvent, scrollToBottom])

  const handleStartReached = useCallback(() => {
    paginateBackRef.current()
  }, [])

  if (loading || !virtuosoReady) {
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
    <TimelineScrollContext.Provider value={scrollApi}>
      <PinnedMessageBar roomId={roomId} />
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      <div
        className={styles.container}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Лента сообщений"
      >
        <Virtuoso
          key={roomId}
          ref={virtuosoRef}
          data={listItems}
          computeItemKey={(_, item) => item.key}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={
            focusIndex >= 0 ? focusIndex
            : savedScrollTop !== undefined ? undefined
            : listItems.length - 1
          }
          alignToBottom
          atBottomStateChange={(atBottom) => {
            isAtBottomRef.current = atBottom
            setIsAtBottom(atBottom)
            if (atBottom) setNewMessageCount(0)
          }}
          followOutput={(isAtB) => {
            isAtBottomRef.current = isAtB
            return isAtB ? 'auto' : false
          }}
          startReached={handleStartReached}
          increaseViewportBy={{ top: 1500, bottom: 300 }}
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
        <ScrollToBottomFab visible={!isAtBottom} newCount={newMessageCount} onClick={scrollToBottom} />
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
