import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import { useRoomListStore } from '../../room-list/store/roomListStore.js'
import { useRoom } from '../hooks/useRoom.js'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { MediaUploader } from '../../media/components/MediaUploader.js'
import { RoomHeader } from './RoomHeader.js'
import { Timeline } from './Timeline.js'
import { MentionNavigator } from './MentionNavigator.js'
import { MessageComposer } from '../../messaging/components/MessageComposer.js'
import { RoomDetailsPanel } from './RoomDetailsPanel.js'
import { ThreadPanel } from './ThreadPanel.js'
import { Spinner } from '../../../shared/ui/index.js'
import { RightPanelCtx, type RightPanel } from '../context/RightPanelContext.js'
import { useIsTouchDevice } from '../../../shared/hooks/useMediaQuery.js'
import styles from './RoomView.module.scss'

const SESSION_KEY = 'app_navigated'

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const redirected = useRef(false)
  const isTouch = useIsTouchDevice()

  useEffect(() => {
    if (isTouch) return
    if (redirected.current) return
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      redirected.current = true
      navigate('/rooms', { replace: true })
    }
  }, [navigate, isTouch])

  const { room, loading } = useRoom(roomId)
  const { uploadFiles } = useMediaUpload(roomId ?? '')
  const focusEventId = searchParams.get('eventId') || undefined
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)

  useEffect(() => {
    if (roomId) {
      setSelectedRoom(roomId)
    }
  }, [roomId, setSelectedRoom])

  const clearFocusEvent = () => {
    if (searchParams.has('eventId')) {
      setSearchParams({}, { replace: true })
    }
  }

  const ctx = {
    panel: rightPanel,
    openDetails: () => setRightPanel({ type: 'details' }),
    openThread: (threadRootId: string) => setRightPanel({ type: 'thread', threadRootId }),
    closePanel: () => setRightPanel(null),
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
            <RoomHeader room={room} />
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
        </div>
      </MediaUploader>
    </RightPanelCtx.Provider>
  )
}
