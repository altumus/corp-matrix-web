import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import styles from './EmojiPicker.module.scss'

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function EmojiPicker({ onSelect, onClose, anchorRef }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!containerRef.current || !anchorRef?.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const el = containerRef.current
    const pickerH = 435
    const pickerW = 352

    let top = anchor.top - pickerH - 8
    let left = anchor.right - pickerW

    if (top < 8) {
      top = anchor.bottom + 8
    }
    if (left < 8) {
      left = 8
    }
    if (left + pickerW > window.innerWidth - 8) {
      left = window.innerWidth - pickerW - 8
    }

    el.style.top = `${top}px`
    el.style.left = `${left}px`
  }, [anchorRef])

  const picker = (
    <div ref={containerRef} className={styles.picker}>
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          onSelect(emoji.native)
          onClose()
        }}
        theme="auto"
        locale="ru"
        previewPosition="none"
        skinTonePosition="search"
        perLine={8}
        maxFrequentRows={2}
        navPosition="bottom"
        searchPosition="sticky"
      />
    </div>
  )

  return createPortal(picker, document.body)
}
