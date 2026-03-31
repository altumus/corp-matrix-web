import { useCallback, useRef, type DragEvent } from 'react'
import { useState } from 'react'
import styles from './MediaUploader.module.scss'

interface MediaUploaderProps {
  onFiles: (files: FileList) => void
  children: React.ReactNode
}

export function MediaUploader({ onFiles, children }: MediaUploaderProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      dragCounter.current = 0
      if (e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files)
      }
    },
    [onFiles],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        const dt = new DataTransfer()
        files.forEach((f) => dt.items.add(f))
        onFiles(dt.files)
      }
    },
    [onFiles],
  )

  return (
    <div
      className={`${styles.uploader} ${dragging ? styles.dragging : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        className={styles.hidden}
        multiple
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      {dragging && (
        <div className={styles.dropOverlay}>
          <span>Перетащите файлы сюда</span>
        </div>
      )}
    </div>
  )
}
