import { useEffect, useRef } from 'react'
import data from '@emoji-mart/data'
import styles from './MentionPopup.module.scss'

interface EmojiData {
  emojis: Record<
    string,
    {
      id: string
      skins: { native: string }[]
      keywords?: string[]
    }
  >
}

const emojiData = data as unknown as EmojiData

export interface EmojiCandidate {
  id: string
  native: string
}

export function searchEmoji(query: string, limit = 8): EmojiCandidate[] {
  if (!query) return []
  const q = query.toLowerCase()
  const results: EmojiCandidate[] = []

  for (const [id, em] of Object.entries(emojiData.emojis)) {
    if (
      id.includes(q) ||
      em.keywords?.some((k) => k.includes(q))
    ) {
      results.push({ id, native: em.skins?.[0]?.native || '' })
      if (results.length >= limit) break
    }
  }

  return results
}

interface EmojiAutocompleteProps {
  candidates: EmojiCandidate[]
  selectedIndex: number
  onSelect: (emoji: EmojiCandidate) => void
}

export function EmojiAutocomplete({ candidates, selectedIndex, onSelect }: EmojiAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (candidates.length === 0) return null

  return (
    <div className={styles.popup} ref={listRef}>
      {candidates.map((c, i) => (
        <button
          key={c.id}
          className={`${styles.item} ${i === selectedIndex ? styles.selected : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(c)
          }}
        >
          <span style={{ fontSize: 20 }}>{c.native}</span>
          <div className={styles.info}>
            <span className={styles.name}>:{c.id}:</span>
          </div>
        </button>
      ))}
    </div>
  )
}
