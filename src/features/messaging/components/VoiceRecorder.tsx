import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './VoiceRecorder.module.scss'

interface VoiceRecorderProps {
  roomId: string
  onCancel: () => void
}

export function VoiceRecorder({ roomId, onCancel }: VoiceRecorderProps) {
  const { upload } = useMediaUpload(roomId)
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        await upload(file)
        onCancel()
      }
      recorder.start()
      recorderRef.current = recorder
      startTimeRef.current = Date.now()
      setRecording(true)
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 250)
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Не удалось получить доступ к микрофону',
        'error',
      )
      onCancel()
    }
  }, [upload, onCancel])

  const stop = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    recorderRef.current?.stop()
    setRecording(false)
  }, [])

  const cancel = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stream.getTracks().forEach((t) => t.stop())
      recorderRef.current.stop()
      // Discard chunks
      chunksRef.current = []
    }
    onCancel()
  }, [onCancel])

  // Auto-start on mount
  if (!recording && !recorderRef.current) {
    start()
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.recorder}>
      <button
        type="button"
        className={styles.cancelBtn}
        onClick={cancel}
        title="Отменить"
        aria-label="Отменить"
      >
        <Trash2 size={18} />
      </button>
      <div className={styles.indicator}>
        <span className={styles.dot} />
        <Mic size={16} />
        <span className={styles.time}>{formatTime(duration)}</span>
      </div>
      <button
        type="button"
        className={styles.sendBtn}
        onClick={stop}
        title="Отправить"
        aria-label="Отправить голосовое"
      >
        <Square size={18} />
      </button>
    </div>
  )
}
