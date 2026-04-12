import { useRef, useEffect } from 'react'
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users } from 'lucide-react'
import { useGroupCallStore, type Participant } from '../store/groupCallStore.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './GroupCallView.module.scss'

export function GroupCallView() {
  const status = useGroupCallStore((s) => s.status)
  const participants = useGroupCallStore((s) => s.participants)
  const micMuted = useGroupCallStore((s) => s.micMuted)
  const videoMuted = useGroupCallStore((s) => s.videoMuted)
  const screenSharing = useGroupCallStore((s) => s.screenSharing)
  const leave = useGroupCallStore((s) => s.leave)
  const toggleMic = useGroupCallStore((s) => s.toggleMic)
  const toggleVideo = useGroupCallStore((s) => s.toggleVideo)
  const toggleScreenShare = useGroupCallStore((s) => s.toggleScreenShare)

  if (status === 'idle') return null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Users size={18} />
        <span>{participants.length} участник(ов)</span>
      </div>

      <div className={styles.grid}>
        {participants.map((p) => (
          <ParticipantTile key={`${p.userId}-${p.deviceId ?? ''}`} participant={p} />
        ))}
        {participants.length === 0 && status === 'joining' && (
          <div className={styles.joining}>Подключение...</div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.controlBtn} ${micMuted ? styles.muted : ''}`}
          onClick={toggleMic}
          title={micMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          className={`${styles.controlBtn} ${videoMuted ? styles.muted : ''}`}
          onClick={toggleVideo}
          title={videoMuted ? 'Включить камеру' : 'Выключить камеру'}
        >
          {videoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button
          className={`${styles.controlBtn} ${screenSharing ? styles.active : ''}`}
          onClick={() => void toggleScreenShare()}
          title={screenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
        >
          <Monitor size={20} />
        </button>
        <button className={styles.endBtn} onClick={leave} title="Покинуть звонок">
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}

function ParticipantTile({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream
    }
  }, [participant.stream])

  return (
    <div className={styles.tile}>
      {participant.stream && !participant.videoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={styles.video}
        />
      ) : (
        <div className={styles.avatar}>
          <Avatar src={participant.avatarUrl} name={participant.name} size="lg" />
        </div>
      )}
      <div className={styles.nameBar}>
        <span className={styles.name}>{participant.name}</span>
        {participant.audioMuted && <MicOff size={14} />}
        {participant.speaking && <span className={styles.speaking}>●</span>}
      </div>
    </div>
  )
}
