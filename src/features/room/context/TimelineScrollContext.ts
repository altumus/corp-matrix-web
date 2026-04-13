import { createContext, useContext } from 'react'

export interface TimelineScrollApi {
  scrollToEvent: (eventId: string) => void | Promise<void>
  scrollToBottom: () => void
}

const defaultApi: TimelineScrollApi = {
  scrollToEvent: () => {},
  scrollToBottom: () => {},
}

export const TimelineScrollContext = createContext<TimelineScrollApi>(defaultApi)

export function useTimelineScroll(): TimelineScrollApi {
  return useContext(TimelineScrollContext)
}
