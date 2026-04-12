import { create } from 'zustand'
import type { RoomListEntry } from '../types.js'

export type RoomListTab = 'all' | 'unread' | 'dms'

interface RoomListState {
  rooms: RoomListEntry[]
  searchQuery: string
  selectedRoomId: string | null
  initialLoading: boolean
  activeTab: RoomListTab
  scrollStates: Record<string, unknown>

  setRooms: (rooms: RoomListEntry[]) => void
  setSearchQuery: (query: string) => void
  setSelectedRoom: (roomId: string | null) => void
  setInitialLoading: (loading: boolean) => void
  setActiveTab: (tab: RoomListTab) => void
  updateRoom: (roomId: string, partial: Partial<RoomListEntry>) => void
  setScrollState: (roomId: string, state: unknown) => void
  getScrollState: (roomId: string) => unknown | undefined
}

export const useRoomListStore = create<RoomListState>((set, get) => ({
  rooms: [],
  searchQuery: '',
  selectedRoomId: null,
  initialLoading: true,
  activeTab: 'all',
  scrollStates: {},

  setRooms: (rooms) => set({ rooms }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedRoom: (roomId) => set({ selectedRoomId: roomId }),

  setInitialLoading: (loading) => set({ initialLoading: loading }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  updateRoom: (roomId, partial) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.roomId === roomId ? { ...r, ...partial } : r,
      ),
    })),

  setScrollState: (roomId, state) =>
    set((s) => ({
      scrollStates: { ...s.scrollStates, [roomId]: state },
    })),

  getScrollState: (roomId) => get().scrollStates[roomId],
}))
