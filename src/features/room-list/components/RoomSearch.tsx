import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Preset } from 'matrix-js-sdk/lib/@types/partials.js'
import { useCombinedSearch } from '../hooks/useCombinedSearch.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Avatar, Spinner } from '../../../shared/ui/index.js'
import styles from './RoomSearch.module.scss'

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className={styles.highlight}>{part}</mark>
      : part,
  )
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function RoomSearch() {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const navigate = useNavigate()
  const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom)
  const setSearchQuery = useRoomListStore((s) => s.setSearchQuery)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const result = useCombinedSearch(query)
  const hasQuery = query.trim().length > 0
  const hasAnyResults = result.rooms.length > 0 || result.users.length > 0 || result.messages.length > 0
  const isLoading = result.loadingUsers || result.loadingMessages

  useEffect(() => {
    setSearchQuery(query.trim())
  }, [query, setSearchQuery])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const handleRoomClick = (roomId: string) => {
    setSelectedRoom(roomId)
    navigate(`/rooms/${encodeURIComponent(roomId)}`)
    setQuery('')
    setOpen(false)
  }

  const handleMessageClick = (roomId: string, eventId: string) => {
    setSelectedRoom(roomId)
    navigate(`/rooms/${encodeURIComponent(roomId)}?eventId=${encodeURIComponent(eventId)}`)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={styles.search}>
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (hasQuery) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={t('rooms.search')}
      />

      {open && hasQuery && (
        <div className={styles.dropdown}>
          {(result.rooms.length > 0 || result.users.length > 0) && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{t('search.chatsAndPeople')}</div>

              {result.rooms.map((room) => (
                <button
                  key={room.roomId}
                  className={styles.resultItem}
                  onClick={() => handleRoomClick(room.roomId)}
                >
                  <Avatar src={room.avatarUrl} name={room.name} size="sm" />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>
                      {highlightText(room.name, query.trim())}
                    </span>
                    {room.lastMessage && (
                      <span className={styles.resultSub}>{room.lastMessage}</span>
                    )}
                  </div>
                </button>
              ))}

              {result.users.map((user) => (
                <button
                  key={user.userId}
                  className={styles.resultItem}
                  onClick={async () => {
                    if (!client) return
                    try {
                      const { room_id } = await client.createRoom({
                        is_direct: true,
                        invite: [user.userId],
                        preset: Preset.TrustedPrivateChat,
                      })
                      setSelectedRoom(room_id)
                      navigate(`/rooms/${encodeURIComponent(room_id)}`)
                    } catch { /* ignore */ }
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>
                      {highlightText(user.displayName, query.trim())}
                    </span>
                    <span className={styles.resultSub}>{user.userId}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {(result.messages.length > 0 || result.loadingMessages) && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{t('search.messagesResults')}</div>

              {result.loadingMessages && result.messages.length === 0 && (
                <div className={styles.loadingRow}>
                  <Spinner size={16} />
                  <span>{t('search.searching')}</span>
                </div>
              )}

              {result.messages.map((msg) => (
                <button
                  key={msg.eventId}
                  className={styles.resultItem}
                  onClick={() => handleMessageClick(msg.roomId, msg.eventId)}
                >
                  <div className={styles.resultInfo}>
                    <div className={styles.msgMeta}>
                      <span className={styles.msgRoom}>{msg.roomName}</span>
                      <span className={styles.msgSender}>{msg.senderName}</span>
                      <time className={styles.msgTime}>{formatDate(msg.timestamp)}</time>
                    </div>
                    <span className={styles.msgBody}>
                      {highlightText(msg.body, query.trim())}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && !hasAnyResults && query.trim().length >= 2 && (
            <div className={styles.noResults}>{t('search.noResults')}</div>
          )}
        </div>
      )}
    </div>
  )
}
