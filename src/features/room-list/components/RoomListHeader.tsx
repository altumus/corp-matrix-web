import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bookmark, Plus, Settings, LayoutGrid, Search } from 'lucide-react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { CreateRoomDialog } from './CreateRoomDialog.js'
import { SpacesDrawer } from '../../spaces/components/SpacesDrawer.js'
import { Modal } from '../../../shared/ui/index.js'
import { SearchPanel } from '../../search/components/SearchPanel.js'
import styles from './RoomListHeader.module.scss'

export function RoomListHeader() {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [showCreate, setShowCreate] = useState(false)
  const [showSpaces, setShowSpaces] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Ctrl+K / Cmd+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const rooms = useRoomListStore((s) => s.rooms)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)

  const openSavedMessages = useCallback(async () => {
    if (!client) return
    const myUserId = client.getUserId()!

    // 1. Check rooms list store first
    const fromStore = rooms.find((r) => r.isSavedMessages)
    if (fromStore) {
      setSelectedRoom(fromStore.roomId)
      navigate(`/rooms/${encodeURIComponent(fromStore.roomId)}`)
      return
    }

    // 2. Check ALL rooms in client (not only loaded in store) — find self-DM
    const allRooms = client.getRooms()
    for (const room of allRooms) {
      const members = room.getJoinedMembers()
      if (members.length === 1 && members[0].userId === myUserId) {
        // Self-DM
        setSelectedRoom(room.roomId)
        navigate(`/rooms/${encodeURIComponent(room.roomId)}`)
        return
      }
    }

    // 3. Check m.direct account_data for self-mapping
    try {
      const directData = client.getAccountData('m.direct' as any)
      const directMap = (directData?.getContent() as Record<string, string[]> | undefined) || {}
      const selfRooms = directMap[myUserId]
      if (selfRooms && selfRooms.length > 0) {
        const roomId = selfRooms[0]
        // Verify room still exists and we're joined
        const room = client.getRoom(roomId)
        if (room && room.getMyMembership() === 'join') {
          setSelectedRoom(roomId)
          navigate(`/rooms/${encodeURIComponent(roomId)}`)
          return
        }
      }
    } catch { /* ignore */ }

    // 4. None found — create a new one and store mapping in m.direct
    try {
      const { room_id } = await client.createRoom({
        is_direct: true,
        invite: [myUserId],
        preset: 'trusted_private_chat' as never,
        name: 'Saved Messages',
      })

      // Update m.direct so subsequent lookups find this room
      try {
        const directData = client.getAccountData('m.direct' as any)
        const directMap = (directData?.getContent() as Record<string, string[]> | undefined) || {}
        directMap[myUserId] = [...(directMap[myUserId] || []), room_id]
        await client.setAccountData('m.direct' as any, directMap as any)
      } catch { /* ignore */ }

      setSelectedRoom(room_id)
      navigate(`/rooms/${encodeURIComponent(room_id)}`)
    } catch { /* ignore */ }
  }, [rooms, navigate, setSelectedRoom, client])

  return (
    <div className={styles.header}>
      {isMobile && (
        <button
          className={styles.spacesBtn}
          onClick={() => setShowSpaces(true)}
          title={t('spaces.title', 'Пространства')}
        >
          <LayoutGrid size={18} />
        </button>
      )}
      <h1 className={styles.title}>
        {t('rooms.title')}
        <span className={styles.version}>v{__APP_VERSION__}</span>
      </h1>
      <div className={styles.actions}>
        <button
          className={styles.searchBtn}
          onClick={() => setShowSearch(true)}
          title={t('search.title', { defaultValue: 'Поиск' }) + ' (Ctrl+K)'}
          aria-label={t('search.title', { defaultValue: 'Поиск' })}
        >
          <Search size={18} />
        </button>
        <button
          className={styles.savedBtn}
          onClick={openSavedMessages}
          title={t('rooms.savedMessages')}
        >
          <Bookmark size={18} />
        </button>
        <button
          className={styles.createBtn}
          onClick={() => setShowCreate(true)}
          title={t('rooms.create')}
        >
          <Plus size={18} />
        </button>
        <button
          className={styles.settingsBtn}
          onClick={() => navigate('/settings')}
          title={t('settings.title')}
        >
          <Settings size={18} />
        </button>
      </div>
      {showCreate && <CreateRoomDialog onClose={() => setShowCreate(false)} />}
      {showSpaces && <SpacesDrawer onClose={() => setShowSpaces(false)} />}
      {showSearch && (
        <Modal
          open
          onClose={() => setShowSearch(false)}
          title={t('search.title', { defaultValue: 'Поиск' })}
        >
          <SearchPanel />
        </Modal>
      )}
    </div>
  )
}
