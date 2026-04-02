import { create } from 'zustand'
import type { RoomListEntry } from '../types.js'

interface RoomListState {
  rooms: RoomListEntry[]
  searchQuery: string
  selectedRoomId: string | null
  initialLoading: boolean

  setRooms: (rooms: RoomListEntry[]) => void
  setSearchQuery: (query: string) => void
  setSelectedRoom: (roomId: string | null) => void
  setInitialLoading: (loading: boolean) => void
  updateRoom: (roomId: string, partial: Partial<RoomListEntry>) => void
}

export const useRoomListStore = create<RoomListState>((set) => ({
  rooms: [],
  searchQuery: '',
  selectedRoomId: null,
  initialLoading: true,

  setRooms: (rooms) => set({ rooms }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedRoom: (roomId) => set({ selectedRoomId: roomId }),

  setInitialLoading: (loading) => set({ initialLoading: loading }),

  updateRoom: (roomId, partial) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.roomId === roomId ? { ...r, ...partial } : r,
      ),
    })),
}))
