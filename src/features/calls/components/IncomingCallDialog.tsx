import { useEffect, useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import type { MatrixCall } from 'matrix-js-sdk'
import { Avatar } from '../../../shared/ui/index.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import styles from './IncomingCallDialog.module.scss'

interface IncomingCallDialogProps {
  call: MatrixCall
  onAccept: (withVideo: boolean) => void
  onReject: () => void
}

export function IncomingCallDialog({ call, onAccept, onReject }: IncomingCallDialogProps) {
  const [callerName, setCallerName] = useState('Звонок')
  const [callerAvatar, setCallerAvatar] = useState<string | null>(null)
  const isVideoOffer = call.type === 'video' || call.type === 'voice' ? false : false

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return
    const opponent = call.getOpponentMember()
    if (opponent) {
      setCallerName(opponent.name || opponent.userId)
      setCallerAvatar(opponent.getMxcAvatarUrl() ?? null)
    } else if (call.invitee) {
      setCallerName(call.invitee)
    }
  }, [call])

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.avatar}>
          <Avatar src={callerAvatar} name={callerName} size="xl" />
        </div>
        <h3 className={styles.name}>{callerName}</h3>
        <p className={styles.label}>
          Входящий {isVideoOffer ? 'видеозвонок' : 'звонок'}...
        </p>
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.reject}`}
            onClick={onReject}
            aria-label="Отклонить"
          >
            <PhoneOff size={24} />
          </button>
          <button
            className={`${styles.btn} ${styles.accept}`}
            onClick={() => onAccept(false)}
            aria-label="Принять"
          >
            <Phone size={24} />
          </button>
          <button
            className={`${styles.btn} ${styles.acceptVideo}`}
            onClick={() => onAccept(true)}
            aria-label="Принять с видео"
          >
            <Video size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}
