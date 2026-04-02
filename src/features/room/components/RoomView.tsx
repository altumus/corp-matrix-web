import { useParams, useSearchParams } from 'react-router'
import { useRoom } from '../hooks/useRoom.js'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { MediaUploader } from '../../media/components/MediaUploader.js'
import { RoomHeader } from './RoomHeader.js'
import { Timeline } from './Timeline.js'
import { MessageComposer } from '../../messaging/components/MessageComposer.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './RoomView.module.scss'

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { room, loading } = useRoom(roomId)
  const { uploadFiles } = useMediaUpload(roomId ?? '')
  const focusEventId = searchParams.get('eventId') || undefined

  const clearFocusEvent = () => {
    if (searchParams.has('eventId')) {
      setSearchParams({}, { replace: true })
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size={32} />
      </div>
    )
  }

  if (!room) {
    return <div className={styles.empty}>Комната не найдена</div>
  }

  return (
    <MediaUploader onFiles={uploadFiles}>
      <div className={styles.container}>
        <RoomHeader room={room} />
        <Timeline
          roomId={room.roomId}
          focusEventId={focusEventId}
          onFocusHandled={clearFocusEvent}
        />
        <MessageComposer roomId={room.roomId} />
      </div>
    </MediaUploader>
  )
}
