import { useMemo } from 'react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './ReadReceipts.module.scss'

interface ReadReceiptsProps {
  eventId: string
}

interface ReceiptUser {
  userId: string
  name: string
  avatarUrl: string | null
}

export function ReadReceipts({ eventId }: ReadReceiptsProps) {
  const users = useMemo<ReceiptUser[]>(() => {
    const client = getMatrixClient()
    if (!client) return []

    void eventId
    return []
  }, [eventId])

  if (users.length === 0) return null

  return (
    <div className={styles.receipts}>
      {users.slice(0, 3).map((u) => (
        <Avatar key={u.userId} src={u.avatarUrl} name={u.name} size="xs" />
      ))}
      {users.length > 3 && (
        <span className={styles.more}>+{users.length - 3}</span>
      )}
    </div>
  )
}
