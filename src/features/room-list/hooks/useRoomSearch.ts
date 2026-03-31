import { useRoomListStore } from '../store/roomListStore.js'

export function useRoomSearch() {
  const { searchQuery, setSearchQuery } = useRoomListStore()

  return { searchQuery, setSearchQuery }
}
