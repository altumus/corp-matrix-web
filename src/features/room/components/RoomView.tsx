import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useRoomListStore } from '../../room-list/store/roomListStore.js'
import { useRoom } from '../hooks/useRoom.js'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { MediaUploader } from '../../media/components/MediaUploader.js'
import { RoomHeader } from './RoomHeader.js'
import { GroupCallView } from '../../calls/components/GroupCallView.js'
import { Timeline } from './Timeline.js'
import { MentionNavigator } from './MentionNavigator.js'
import { MessageComposer } from '../../messaging/components/MessageComposer.js'
import { RoomDetailsPanel } from './RoomDetailsPanel.js'
import { ThreadPanel } from './ThreadPanel.js'
import { ThreadsListPanel } from './ThreadsListPanel.js'
import { RoomSearchBar } from './RoomSearchBar.js'
import { Spinner } from '../../../shared/ui/index.js'
import { RightPanelCtx, type RightPanel } from '../context/RightPanelContext.js'
import styles from './RoomView.module.scss'

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const { room, loading } = useRoom(roomId)
  const { uploadFiles } = useMediaUpload(roomId ?? '')
  const focusEventId = searchParams.get('eventId') || undefined
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [showSearch, setShowSearch] = useState(false)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)

  useEffect(() => {
    if (roomId) {
      setSelectedRoom(roomId)
    }
    setRightPanel(null)
    setShowSearch(false)
  }, [roomId, setSelectedRoom])

  // Ctrl+F opens in-room search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowSearch((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSearchNavigate = useCallback((eventId: string) => {
    setSearchParams({ eventId }, { replace: true })
  }, [setSearchParams])

  const clearFocusEvent = () => {
    if (searchParams.has('eventId')) {
      setSearchParams({}, { replace: true })
    }
  }

  const setActiveThread = useRoomListStore((s) => s.setActiveThread)

  const ctx = {
    panel: rightPanel,
    openDetails: () => { setRightPanel({ type: 'details' }); setActiveThread(null) },
    openThread: (threadRootId: string) => { setRightPanel({ type: 'thread', threadRootId }); setActiveThread(threadRootId) },
    openThreadsList: () => { setRightPanel({ type: 'threads-list' }); setActiveThread(null) },
    closePanel: () => { setRightPanel(null); setActiveThread(null) },
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size={32} />
      </div>
    )
  }

  if (!room) {
    return <div className={styles.empty}>Выберите чат</div>
  }

  return (
    <RightPanelCtx.Provider value={ctx}>
      <MediaUploader onFiles={uploadFiles}>
        <div className={styles.wrapper}>
          <div className={styles.container}>
            <RoomHeader room={room} onSearchToggle={() => setShowSearch((v) => !v)} />
            {showSearch && (
              <RoomSearchBar
                roomId={room.roomId}
                onClose={() => setShowSearch(false)}
                onNavigate={handleSearchNavigate}
              />
            )}
            <GroupCallView />
            <Timeline
              roomId={room.roomId}
              focusEventId={focusEventId}
              onFocusHandled={clearFocusEvent}
            />
            <div style={{ position: 'relative' }}>
              <MentionNavigator roomId={room.roomId} />
              <MessageComposer roomId={room.roomId} />
            </div>
          </div>

          {rightPanel?.type === 'details' && (
            <RoomDetailsPanel room={room} onClose={() => setRightPanel(null)} />
          )}

          {rightPanel?.type === 'thread' && (
            <ThreadPanel
              roomId={room.roomId}
              threadRootId={rightPanel.threadRootId}
              onClose={() => setRightPanel(null)}
            />
          )}

          {rightPanel?.type === 'threads-list' && (
            <ThreadsListPanel
              roomId={room.roomId}
              onClose={() => setRightPanel(null)}
            />
          )}
        </div>
      </MediaUploader>
    </RightPanelCtx.Provider>
  )
}
