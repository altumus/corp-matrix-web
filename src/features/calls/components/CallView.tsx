import { useState, useEffect, useRef } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Button } from '../../../shared/ui/index.js'
import styles from './CallView.module.scss'

interface CallViewProps {
  roomId: string
  onEnd: () => void
}

export function CallView({ roomId, onEnd }: CallViewProps) {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    void roomId

    const timer = setTimeout(() => {
      setCallState('connected')
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [roomId])

  const handleToggleMute = () => setIsMuted((v) => !v)
  const handleToggleVideo = () => setIsVideoOff((v) => !v)

  const handleEndCall = () => {
    setCallState('ended')
    onEnd()
  }

  return (
    <div className={styles.container}>
      <div className={styles.videos}>
        <video
          ref={remoteVideoRef}
          className={styles.remoteVideo}
          autoPlay
          playsInline
        />
        <video
          ref={localVideoRef}
          className={styles.localVideo}
          autoPlay
          playsInline
          muted
        />
      </div>

      <div className={styles.status}>
        {callState === 'connecting' && 'Подключение...'}
        {callState === 'connected' && 'Звонок активен'}
        {callState === 'ended' && 'Звонок завершён'}
      </div>

      <div className={styles.controls}>
        <Button
          variant={isMuted ? 'danger' : 'secondary'}
          onClick={handleToggleMute}
        >
          {isMuted ? '🔇' : '🎤'}
        </Button>
        <Button
          variant={isVideoOff ? 'danger' : 'secondary'}
          onClick={handleToggleVideo}
        >
          {isVideoOff ? '📵' : '📹'}
        </Button>
        <Button variant="danger" onClick={handleEndCall}>
          📞 Завершить
        </Button>
      </div>
    </div>
  )
}
