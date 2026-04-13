import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import { useAuthenticatedMedia } from '../../../shared/hooks/useAuthenticatedMedia.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './VoiceMessage.module.scss'

interface VoiceMessageProps {
  mxcUrl: string
  duration?: number // seconds, from content.info.duration (ms in matrix spec)
}

const BAR_COUNT = 32

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceMessage({ mxcUrl, duration: hintDuration }: VoiceMessageProps) {
  const src = useAuthenticatedMedia(mxcUrl)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(hintDuration ?? 0)
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.2 + Math.random() * 0.6),
  )
  const waveformDecoded = useRef(false)
  const animFrameRef = useRef(0)

  // Decode audio to generate waveform when src is ready
  useEffect(() => {
    if (!src || waveformDecoded.current) return
    waveformDecoded.current = true

    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const ctx = new AudioContext()
        return ctx.decodeAudioData(buf).finally(() => ctx.close())
      })
      .then((audioBuffer) => {
        const raw = audioBuffer.getChannelData(0)
        const blockSize = Math.floor(raw.length / BAR_COUNT)
        const bars: number[] = []
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0
          const start = i * blockSize
          for (let j = start; j < start + blockSize; j++) {
            sum += Math.abs(raw[j])
          }
          bars.push(sum / blockSize)
        }
        // Normalize to 0..1
        const max = Math.max(...bars, 0.01)
        setWaveform(bars.map((v) => Math.max(0.08, v / max)))
        if (!hintDuration) setDuration(audioBuffer.duration)
      })
      .catch(() => {
        // keep random waveform
      })
  }, [src, hintDuration])

  const tick = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    if (!audio.paused) {
      animFrameRef.current = requestAnimationFrame(tick)
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
      setPlaying(true)
      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      audio.pause()
      setPlaying(false)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [tick])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    setCurrentTime(0)
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration)
    }
  }, [])

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || !duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      audio.currentTime = ratio * duration
      setCurrentTime(audio.currentTime)
    },
    [duration],
  )

  const progress = duration > 0 ? currentTime / duration : 0

  if (!src) {
    return (
      <div className={styles.container}>
        <Spinner size={20} />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button className={styles.playBtn} onClick={toggle} type="button">
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className={styles.body}>
        <div className={styles.waveform} onClick={handleBarClick}>
          {waveform.map((h, i) => {
            const filled = i / BAR_COUNT < progress
            return (
              <div
                key={i}
                className={`${styles.bar} ${filled ? styles.barFilled : ''}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            )
          })}
        </div>
        <span className={styles.time}>
          {playing || currentTime > 0
            ? formatTime(currentTime)
            : formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
