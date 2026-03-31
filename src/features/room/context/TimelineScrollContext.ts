import { createContext, useContext } from 'react'

type ScrollToEvent = (eventId: string) => void

export const TimelineScrollContext = createContext<ScrollToEvent>(() => {})

export function useTimelineScroll(): ScrollToEvent {
  return useContext(TimelineScrollContext)
}
