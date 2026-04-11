import { useEffect, useRef } from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { CallEvent, type MatrixCall } from 'matrix-js-sdk'
import styles from './CallView.module.scss'

interface CallViewProps {
  call: MatrixCall
  isVideo: boolean
  status: 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended'
  micMuted: boolean
  videoMuted: boolean
  onEnd: () => void
  onToggleMic: () => void
  onToggleVideo: () => void
}

export function CallView({
  call,
  isVideo,
  status,
  micMuted,
  videoMuted,
  onEnd,
  onToggleMic,
  onToggleVideo,
}: CallViewProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  // Attach media feeds when they change
  useEffect(() => {
    const updateFeeds = () => {
      try {
        const localFeeds = call.getLocalFeeds()
        const remoteFeeds = call.getRemoteFeeds()

        const localFeed = localFeeds.find((f) => !f.isAudioMuted())
        if (localFeed && localVideoRef.current) {
          localVideoRef.current.srcObject = localFeed.stream
        }

        const remoteFeed = remoteFeeds[0]
        if (remoteFeed) {
          if (isVideo && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteFeed.stream
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteFeed.stream
          }
        }
      } catch {
        // feeds may not be ready
      }
    }

    updateFeeds()
    call.on(CallEvent.FeedsChanged, updateFeeds)
    return () => {
      call.off(CallEvent.FeedsChanged, updateFeeds)
    }
  }, [call, isVideo])

  return (
    <div className={styles.container}>
      <div className={styles.videos}>
        {isVideo ? (
          <>
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
          </>
        ) : (
          <div className={styles.voiceIndicator}>
            <div className={styles.callIcon}>📞</div>
            <div className={styles.callPartner}>
              {call.getOpponentMember()?.name || call.invitee || 'Звонок'}
            </div>
          </div>
        )}
        {/* Audio always rendered, even for video calls */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      <div className={styles.status}>
        {status === 'connecting' && 'Соединение...'}
        {status === 'ringing' && 'Звонок...'}
        {status === 'connected' && 'В разговоре'}
        {status === 'ended' && 'Звонок завершён'}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.controlBtn} ${micMuted ? styles.muted : ''}`}
          onClick={onToggleMic}
          aria-label={micMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        {isVideo && (
          <button
            className={`${styles.controlBtn} ${videoMuted ? styles.muted : ''}`}
            onClick={onToggleVideo}
            aria-label={videoMuted ? 'Включить камеру' : 'Выключить камеру'}
          >
            {videoMuted ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}
        <button
          className={`${styles.controlBtn} ${styles.endBtn}`}
          onClick={onEnd}
          aria-label="Завершить звонок"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}
