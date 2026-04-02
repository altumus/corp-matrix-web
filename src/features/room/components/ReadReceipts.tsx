import { useMemo, useState } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './ReadReceipts.module.scss'

interface ReadReceiptsProps {
  eventId: string
  roomId: string
}

interface ReceiptUser {
  userId: string
  name: string
  avatarUrl: string | null
  ts: number
}

export function ReadReceipts({ eventId, roomId }: ReadReceiptsProps) {
  const [showPopup, setShowPopup] = useState(false)

  const users = useMemo<ReceiptUser[]>(() => {
    const client = getMatrixClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const matrixEvent = room.findEventById(eventId)
    if (!matrixEvent) return []

    const myUserId = client.getUserId()
    const receipts = room.getReceiptsForEvent(matrixEvent)

    return receipts
      .filter((r) => r.userId !== myUserId)
      .map((r) => {
        const member = room.getMember(r.userId)
        return {
          userId: r.userId,
          name: member?.name || r.userId,
          avatarUrl: member?.getMxcAvatarUrl() ?? null,
          ts: r.data.ts,
        }
      })
      .sort((a, b) => b.ts - a.ts)
  }, [eventId, roomId])

  if (users.length === 0) return null

  return (
    <div className={styles.container}>
      <button
        className={styles.receipts}
        onClick={() => setShowPopup((v) => !v)}
        title={`${users.length} просмотров`}
      >
        {users.slice(0, 3).map((u) => (
          <div key={u.userId} className={styles.avatarWrap}>
            <Avatar src={u.avatarUrl} name={u.name} size="xs" />
          </div>
        ))}
        {users.length > 3 && (
          <span className={styles.more}>+{users.length - 3}</span>
        )}
      </button>

      {showPopup && (
        <div className={styles.popup}>
          <div className={styles.popupHeader}>
            {users.length} просмотров
          </div>
          {users.map((u) => (
            <div key={u.userId} className={styles.popupItem}>
              <Avatar src={u.avatarUrl} name={u.name} size="sm" />
              <div className={styles.popupInfo}>
                <span className={styles.popupName}>{u.name}</span>
                <span className={styles.popupTime}>{formatReceiptTime(u.ts)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatReceiptTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isToday) return time

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `вчера в ${time}`
  }

  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} в ${time}`
}
