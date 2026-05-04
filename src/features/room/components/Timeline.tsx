import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react'
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

// Scroll thresholds.
// "At bottom" if within 64px — small enough that the FAB only appears when
// the user has actually scrolled away.
const SCROLL_BOTTOM_THRESHOLD = 64
// Trigger paginate-back when the user is within 800px of the top — that's
// roughly two screenfuls on desktop, giving us a comfortable head start
// before they reach the actual top.
const SCROLL_PAGINATE_THRESHOLD = 800

export function Timeline({ roomId, focusEventId, onFocusHandled }: TimelineProps) {
  const isAtBottomRef = useRef(true)
  const { events, loading, paginating, paginateBack } = useTimeline(roomId, isAtBottomRef)

  // DOM refs.
  // `scrollerRef` is the overflow box the user actually scrolls.
  // `contentRef` is its only child and the ResizeObserver target — splitting
  // them lets us measure content height changes independently of the
  // scroller's clientHeight.
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Local UI state.
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newMessageCount, setNewMessageCount] = useState(0)

  // Refs for cross-callback signalling.
  const focusHandledRef = useRef<string | null>(null)
  const paginateBackRef = useRef(paginateBack)
  const lastEventIdRef = useRef<string | null>(null)
  const scrollHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // While `Date.now() < interactiveScrollUntilRef.current`, the auto-anchor
  // ResizeObserver bails so it doesn't fight an in-progress smooth scroll
  // (e.g. scrollIntoView triggered by scrollToEvent).
  const interactiveScrollUntilRef = useRef(0)
  // Track whether we've already applied the per-room initial scroll. Reset
  // on roomId change so a new room re-anchors.
  const initialScrollDoneRef = useRef<string | null>(null)
  // Scroll-position snapshot taken at the moment paginate-back is
  // triggered. The layout effect below restores the user to the same
  // visual offset once the new (older) events commit. Element/FluffyChat
  // do this same `scrollTop = oldScrollTop + (newHeight - oldHeight)`
  // trick — it's deterministic where CSS `overflow-anchor` is fragile
  // (notably at `scrollTop = 0`, where the browser has no anchor below
  // the prepended content and stops compensating).
  const beforePaginateHeightRef = useRef<number | null>(null)
  const beforePaginateTopRef = useRef<number | null>(null)
  const prevFirstEventIdRef = useRef<string | null>(null)

  useEffect(() => {
    paginateBackRef.current = paginateBack
  }, [paginateBack])

  useEffect(() => {
    initialScrollDoneRef.current = null
    focusHandledRef.current = null
  }, [roomId])

  // Save scroll position on unmount / room change so a return visit can
  // resume where the user left off (handled in the initial-scroll layout
  // effect below).
  useEffect(() => {
    return () => {
      const el = scrollerRef.current
      if (el) useRoomListStore.getState().setScrollState(roomId, el.scrollTop)
    }
  }, [roomId])

  const listItems = useMemo(() => buildListItems(events), [events])

  // ---- Initial scroll (one of three cases) ----
  // useLayoutEffect: runs after DOM commit, before paint. The user's first
  // visible frame is already at the right position — no flash from
  // top-of-list to wherever-we-want.
  useLayoutEffect(() => {
    if (loading || events.length === 0) return
    if (initialScrollDoneRef.current === roomId) return
    const el = scrollerRef.current
    if (!el) return
    initialScrollDoneRef.current = roomId

    // Case 1: focus deep-link — scroll the matching DOM node into view.
    if (focusEventId) {
      const node = el.querySelector(`[data-event-id="${cssEscape(focusEventId)}"]`)
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ block: 'center', behavior: 'auto' })
        return
      }
      // Not found — fall through to bottom; the focusEventId useEffect
      // below uses scrollToEvent's retry loop to backfill and land.
    }

    // Case 2: saved scrollTop from a previous visit.
    const saved = useRoomListStore.getState().scrollStates[roomId] as number | undefined
    if (typeof saved === 'number') {
      el.scrollTop = saved
      return
    }

    // Case 3: default — bottom.
    el.scrollTop = el.scrollHeight
  }, [roomId, loading, events.length === 0, focusEventId])

  // ---- ResizeObserver: at-bottom auto-anchor ----
  // For non-bottom cases (paginate-back, image-load above viewport, etc.),
  // CSS `overflow-anchor: auto` on `.scroller` does the right thing
  // natively: the browser picks an in-viewport anchor element and adjusts
  // scrollTop to keep that anchor visually stable as content above grows
  // or shrinks. Manual `scrollTop` math would actually be wrong when
  // content BELOW the viewport changes (e.g. an off-screen image at the
  // bottom finishing download); CSS anchoring correctly leaves scrollTop
  // alone in that case.
  //
  // What CSS anchoring doesn't do is "follow the new content": if the
  // user is at the bottom and a new message lands or the bottom item
  // grows, we want the viewport to scroll along. That's this observer's
  // sole job.
  //
  // Re-binds on roomId because the scroller div is `key={roomId}` and
  // remounts cleanly — the old observer is torn down with its DOM.
  // Live "is paginating" mirror so the ResizeObserver callback (which
  // can't depend on the React state directly without re-binding the RO
  // each render) can read current state.
  const paginatingStateRef = useRef(paginating)
  useEffect(() => {
    paginatingStateRef.current = paginating
  }, [paginating])

  useEffect(() => {
    const content = contentRef.current
    const scroller = scrollerRef.current
    if (!content || !scroller) return
    const ro = new ResizeObserver(() => {
      // While a paginate is in flight, keep the captured "before" height
      // and top up to date with any layout change that bumps scrollHeight
      // — image/avatar loads on EXISTING (already-rendered) events happen
      // invisibly to scroll-event-driven capture and would otherwise leave
      // heightBefore stale by the size of the load, producing a small but
      // visible drift in the prepend-effect's restored position.
      if (paginatingStateRef.current) {
        beforePaginateHeightRef.current = scroller.scrollHeight
        beforePaginateTopRef.current = scroller.scrollTop
        return
      }
      // Don't fight an in-flight smooth scroll triggered by scrollToEvent.
      if (interactiveScrollUntilRef.current > Date.now()) return
      if (isAtBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight
      }
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [roomId])

  // Scroll handler — at-bottom detection + near-top pagination trigger.
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom < SCROLL_BOTTOM_THRESHOLD
    if (atBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = atBottom
      setIsAtBottom(atBottom)
      if (atBottom) setNewMessageCount(0)
    }
    // While paginating, keep the capture fresh on every scroll tick. The
    // user typically keeps scrolling during the ~600ms paginate window;
    // by the time React commits the new events the captured-at-trigger
    // values are stale by hundreds of pixels, and a stale topBefore
    // produces a visible jerk in the prepend-effect's restored position.
    if (paginating) {
      beforePaginateHeightRef.current = el.scrollHeight
      beforePaginateTopRef.current = el.scrollTop
    }
    if (
      el.scrollTop < SCROLL_PAGINATE_THRESHOLD &&
      !paginating &&
      events.length > 0
    ) {
      // Initial snapshot at trigger.
      beforePaginateHeightRef.current = el.scrollHeight
      beforePaginateTopRef.current = el.scrollTop
      paginateBackRef.current()
    }
  }, [paginating, events.length])

  // Restore scroll position after a paginate-back commits new items at
  // the top. Triggered by a change in the first event id (i.e. a real
  // prepend, not a bottom append). useLayoutEffect runs after DOM commit
  // but before paint, so the user never sees an intermediate frame at
  // scrollTop=0 (the cascade source).
  //
  // The captured `before*` refs intentionally persist across multiple
  // commits during a single pagination — paginateBack runs a multi-step
  // loop, and stray refresh paths (decryption-debounce, grace expiry)
  // can also flush partial event lists mid-loop. Each intermediate
  // commit re-applies `topBefore + (currentHeight - heightBefore)`, which
  // remains the correct "preserve visual offset" formula no matter how
  // many sub-renders happen. They're cleared once `paginating` flips
  // back to false (separate effect below).
  useLayoutEffect(() => {
    const newFirstId = events[0]?.eventId ?? null
    const prevFirstId = prevFirstEventIdRef.current
    prevFirstEventIdRef.current = newFirstId
    if (prevFirstId == null) return // first render with content; nothing to restore against
    if (newFirstId === prevFirstId) return // no prepend; ignore (bottom append, edit, etc.)

    const heightBefore = beforePaginateHeightRef.current
    const topBefore = beforePaginateTopRef.current
    if (heightBefore == null || topBefore == null) return // prepend wasn't user-triggered (e.g. backfill before first paint)

    const el = scrollerRef.current
    if (!el) return
    const heightDelta = el.scrollHeight - heightBefore
    if (heightDelta <= 0) return
    el.scrollTop = topBefore + heightDelta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  // Clear the pagination capture when paginating flips false, so a
  // subsequent trigger captures fresh geometry.
  useEffect(() => {
    if (!paginating) {
      beforePaginateHeightRef.current = null
      beforePaginateTopRef.current = null
    }
  }, [paginating])

  // On room change, reset the prepend tracker so the next room's first
  // commit isn't compared against the previous room's last first event.
  useEffect(() => {
    prevFirstEventIdRef.current = null
    beforePaginateHeightRef.current = null
    beforePaginateTopRef.current = null
  }, [roomId])

  // ---- Announce new messages and bump unread counter ----
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

  // ---- focusEventId pulse highlight (URL deep-link UX) ----
  // The actual scroll-into-view for focusEventId happens in the initial
  // layout effect above. This effect just runs the pulse-highlight timer
  // alongside it, matching the previous behavior (200ms→2500ms).
  const focusFound = useMemo(
    () => (focusEventId ? listItems.some((it) => it.key === focusEventId) : false),
    [focusEventId, listItems],
  )
  useEffect(() => {
    if (!focusEventId || !focusFound) return
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
  }, [focusEventId, focusFound, onFocusHandled])

  // ---- scrollToEvent (consumed by mention links, pinned message clicks,
  // matrix.to anchors) ----
  const tryFindAndScroll = useCallback((eventId: string): boolean => {
    const scroller = scrollerRef.current
    if (!scroller) return false
    const node = scroller.querySelector(`[data-event-id="${cssEscape(eventId)}"]`)
    if (!(node instanceof HTMLElement)) return false
    isAtBottomRef.current = false
    setIsAtBottom(false)
    interactiveScrollUntilRef.current = Date.now() + 800
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightedEventId(eventId)
    if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current)
    scrollHighlightTimerRef.current = setTimeout(() => {
      setHighlightedEventId(null)
      scrollHighlightTimerRef.current = null
    }, 10000)
    return true
  }, [])

  const scrollToEvent = useCallback(async (eventId: string) => {
    if (tryFindAndScroll(eventId)) return
    // CSS overflow-anchor on .scroller keeps the visible position stable
    // across each retry's pagination, so we don't need manual scroll math
    // here.
    const maxAttempts = 10
    for (let i = 0; i < maxAttempts; i++) {
      await paginateBackRef.current()
      await new Promise<void>((r) => setTimeout(r, 200))
      if (tryFindAndScroll(eventId)) return
    }
  }, [tryFindAndScroll])

  useEffect(() => {
    return () => {
      if (scrollHighlightTimerRef.current) clearTimeout(scrollHighlightTimerRef.current)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    interactiveScrollUntilRef.current = Date.now() + 800
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setNewMessageCount(0)
  }, [])

  const scrollApi = useMemo<TimelineScrollApi>(
    () => ({ scrollToEvent, scrollToBottom }),
    [scrollToEvent, scrollToBottom],
  )

  // Loading state: full-area spinner while useTimeline backfills + decrypts.
  if (loading) {
    return (
      <TimelineScrollContext.Provider value={scrollApi}>
        <PinnedMessageBar roomId={roomId} />
        <div className={styles.loading}>
          <Spinner size={28} />
        </div>
      </TimelineScrollContext.Provider>
    )
  }

  if (events.length === 0) {
    return (
      <TimelineScrollContext.Provider value={scrollApi}>
        <PinnedMessageBar roomId={roomId} />
        <div className={styles.empty}>Нет сообщений</div>
      </TimelineScrollContext.Provider>
    )
  }

  return (
    <TimelineScrollContext.Provider value={scrollApi}>
      <PinnedMessageBar roomId={roomId} />
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      <div className={styles.container}>
        <div
          key={roomId}
          ref={scrollerRef}
          className={styles.scroller}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Лента сообщений"
          onScroll={handleScroll}
        >
          <div ref={contentRef} className={styles.content}>
            {paginating && (
              <div className={styles.paginationLoader}>
                <Spinner size={20} />
              </div>
            )}
            {listItems.map((item) =>
              item.type === 'date' ? (
                <DateSeparator key={item.key} timestamp={item.timestamp!} />
              ) : (
                <TimelineItem
                  key={item.key}
                  event={item.event!}
                  showAvatar={item.showAvatar!}
                  isHighlighted={highlightedEventId === item.event!.eventId}
                />
              ),
            )}
            <TypingIndicator roomId={roomId} />
          </div>
        </div>
        <ScrollToBottomFab
          visible={!isAtBottom}
          newCount={newMessageCount}
          onClick={scrollToBottom}
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

// CSS.escape polyfill for older targets — Matrix event IDs include `$` and
// other characters that aren't valid in unescaped CSS attribute selectors.
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}
