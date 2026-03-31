import type { UserResult } from '../hooks/useUserSearch.js'
import { Avatar } from '../../../shared/ui/index.js'
import styles from './UserSearch.module.scss'

interface UserSearchProps {
  users: UserResult[]
}

export function UserSearch({ users }: UserSearchProps) {
  if (users.length === 0) return null

  return (
    <div className={styles.list}>
      {users.map((user) => (
        <div key={user.userId} className={styles.item}>
          <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
          <div className={styles.info}>
            <span className={styles.name}>{user.displayName}</span>
            <span className={styles.userId}>{user.userId}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
