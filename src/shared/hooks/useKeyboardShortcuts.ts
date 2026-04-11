import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useRoomListStore } from '../../features/room-list/store/roomListStore.js'

/**
 * Global keyboard shortcuts:
 * - Ctrl+K / Cmd+K → focus search
 * - Esc → close active modal/menu
 * - Alt+↑/↓ → previous/next room
 * - Ctrl+, → settings
 */
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate()
  const rooms = useRoomListStore((s) => s.rooms)
  const selectedRoomId = useRoomListStore((s) => s.selectedRoomId)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement | null
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      // Ctrl+K / Cmd+K → focus search
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"]',
        )
        searchInput?.focus()
        return
      }

      // Ctrl+, → settings
      if (meta && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }

      // Alt+↑/↓ → switch rooms (only outside input)
      if (e.altKey && !inInput && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const currentIdx = rooms.findIndex((r) => r.roomId === selectedRoomId)
        if (currentIdx === -1) return
        const nextIdx =
          e.key === 'ArrowDown'
            ? (currentIdx + 1) % rooms.length
            : (currentIdx - 1 + rooms.length) % rooms.length
        const nextRoom = rooms[nextIdx]
        if (nextRoom) {
          setSelectedRoom(nextRoom.roomId)
          navigate(`/rooms/${encodeURIComponent(nextRoom.roomId)}`)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, rooms, selectedRoomId, setSelectedRoom])
}
