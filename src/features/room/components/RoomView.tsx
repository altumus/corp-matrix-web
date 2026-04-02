import { useState, createContext, useContext } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useRoom } from '../hooks/useRoom.js'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { MediaUploader } from '../../media/components/MediaUploader.js'
import { RoomHeader } from './RoomHeader.js'
import { Timeline } from './Timeline.js'
import { MessageComposer } from '../../messaging/components/MessageComposer.js'
import { RoomDetailsPanel } from './RoomDetailsPanel.js'
import { ThreadPanel } from './ThreadPanel.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './RoomView.module.scss'

type RightPanel = { type: 'details' } | { type: 'thread'; threadRootId: string } | null

interface RightPanelContext {
  panel: RightPanel
  openDetails: () => void
  openThread: (threadRootId: string) => void
  closePanel: () => void
}

const RightPanelCtx = createContext<RightPanelContext>({
  panel: null,
  openDetails: () => {},
  openThread: () => {},
  closePanel: () => {},
})

export function useRightPanel() {
  return useContext(RightPanelCtx)
}

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { room, loading } = useRoom(roomId)
  const { uploadFiles } = useMediaUpload(roomId ?? '')
  const focusEventId = searchParams.get('eventId') || undefined
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)

  const clearFocusEvent = () => {
    if (searchParams.has('eventId')) {
      setSearchParams({}, { replace: true })
    }
  }

  const ctx: RightPanelContext = {
    panel: rightPanel,
    openDetails: () => setRightPanel({ type: 'details' }),
    openThread: (threadRootId) => setRightPanel({ type: 'thread', threadRootId }),
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
            <MessageComposer roomId={room.roomId} />
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
