import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useDebounce } from '../../../shared/hooks/useDebounce.js'
import styles from './RoomSearchBar.module.scss'

interface RoomSearchBarProps {
  roomId: string
  onClose: () => void
  onNavigate: (eventId: string) => void
}

interface Match {
  eventId: string
  body: string
}

function searchInRoom(roomId: string, term: string): Match[] {
  const client = getMatrixClient()
  if (!client) return []
  const room = client.getRoom(roomId)
  if (!room) return []

  const lowerTerm = term.toLowerCase()
  const results: Match[] = []
  const seen = new Set<string>()

  let timelines
  try {
    timelines = room.getUnfilteredTimelineSet()?.getTimelines()
  } catch { return [] }
  if (!timelines) return []

  for (const tl of timelines) {
    for (const ev of tl.getEvents()) {
      const type = ev.getType()
      if (type !== 'm.room.message' && type !== 'm.room.encrypted') continue
      if (ev.isRedacted()) continue
      const id = ev.getId()!
      if (seen.has(id)) continue
      seen.add(id)

      const body = (ev.getContent()?.body as string) || ''
      if (!body || !body.toLowerCase().includes(lowerTerm)) continue
      results.push({ eventId: id, body })
    }
  }

  return results
}

export function RoomSearchBar({ roomId, onClose, onNavigate }: RoomSearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 250)
  const [matches, setMatches] = useState<Match[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMatches([])
      setCurrentIndex(0)
      return
    }
    const results = searchInRoom(roomId, debouncedQuery.trim())
    setMatches(results)
    setCurrentIndex(0)
    if (results.length > 0) {
      onNavigate(results[0].eventId)
    }
  }, [debouncedQuery, roomId])

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index)
    if (matches[index]) {
      onNavigate(matches[index].eventId)
    }
  }, [matches, onNavigate])

  const goPrev = useCallback(() => {
    if (matches.length === 0) return
    const next = currentIndex > 0 ? currentIndex - 1 : matches.length - 1
    goTo(next)
  }, [currentIndex, matches.length, goTo])

  const goNext = useCallback(() => {
    if (matches.length === 0) return
    const next = currentIndex < matches.length - 1 ? currentIndex + 1 : 0
    goTo(next)
  }, [currentIndex, matches.length, goTo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) goPrev()
      else goNext()
    }
  }

  return (
    <div className={styles.bar}>
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('search.inRoom', { defaultValue: 'Поиск по чату...' })}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div className={styles.nav}>
          <span className={styles.count}>
            {currentIndex + 1} / {matches.length}
          </span>
          <button className={styles.navBtn} onClick={goPrev} title="Предыдущий">
            <ChevronUp size={16} />
          </button>
          <button className={styles.navBtn} onClick={goNext} title="Следующий">
            <ChevronDown size={16} />
          </button>
        </div>
      )}
      {query && matches.length === 0 && debouncedQuery && (
        <span className={styles.count}>{t('search.noResults', { defaultValue: 'Не найдено' })}</span>
      )}
      <button className={styles.closeBtn} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}
