import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useDebounce } from '../../../shared/hooks/useDebounce.js'
import { Modal, Avatar } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './InviteToRoomDialog.module.scss'

interface UserResult {
  userId: string
  displayName: string
  avatarUrl: string | null
}

interface InviteToRoomDialogProps {
  roomId: string
  onClose: () => void
}

export function InviteToRoomDialog({ roomId, onClose }: InviteToRoomDialogProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)

  const searchUsers = useCallback(async (term: string) => {
    if (!client || !term.trim()) {
      setUsers([])
      return
    }
    setLoading(true)
    try {
      const res = await client.searchUserDirectory({ term, limit: 10 })
      setUsers(
        (res.results || []).map((u) => ({
          userId: u.user_id,
          displayName: u.display_name || u.user_id,
          avatarUrl: u.avatar_url ?? null,
        })),
      )
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [client])

  useState(() => {
    if (debouncedQuery.length >= 2) searchUsers(debouncedQuery)
  })

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.trim().length >= 2) {
      searchUsers(val.trim())
    } else {
      setUsers([])
    }
  }

  const handleInvite = async (userId: string) => {
    if (!client || inviting) return
    setInviting(userId)
    try {
      await client.invite(roomId, userId)
      toast(`${userId} приглашён`, 'success')
      setUsers((prev) => prev.filter((u) => u.userId !== userId))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setInviting(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('rooms.inviteUser')}>
      <div className={styles.container}>
        <input
          className={styles.search}
          type="text"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoFocus
        />
        <div className={styles.list}>
          {users.map((user) => (
            <button
              key={user.userId}
              className={styles.userItem}
              onClick={() => handleInvite(user.userId)}
              disabled={inviting === user.userId}
            >
              <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.displayName}</span>
                <span className={styles.userId}>{user.userId}</span>
              </div>
            </button>
          ))}
          {!loading && query.trim().length >= 2 && users.length === 0 && (
            <div className={styles.empty}>{t('search.noResults')}</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
