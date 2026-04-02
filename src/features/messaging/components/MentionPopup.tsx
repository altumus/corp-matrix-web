import { useEffect, useRef } from 'react'
import type { MentionCandidate } from '../hooks/useMentions.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './MentionPopup.module.scss'

interface MentionPopupProps {
  candidates: MentionCandidate[]
  selectedIndex: number
  onSelect: (candidate: MentionCandidate) => void
}

export function MentionPopup({ candidates, selectedIndex, onSelect }: MentionPopupProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (candidates.length === 0) return null

  return (
    <div className={styles.popup} ref={listRef}>
      {candidates.map((c, i) => (
        <button
          key={c.userId}
          className={`${styles.item} ${i === selectedIndex ? styles.selected : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(c)
          }}
        >
          <Avatar src={c.avatarUrl} name={c.displayName} size="xs" />
          <div className={styles.info}>
            <span className={styles.name}>{c.displayName}</span>
            <span className={styles.userId}>{c.userId}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
