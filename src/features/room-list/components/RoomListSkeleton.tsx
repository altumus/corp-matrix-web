import styles from './RoomListSkeleton.module.scss'

export function RoomListSkeleton() {
  return (
    <div className={styles.skeleton}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.avatar} />
          <div className={styles.lines}>
            <div className={styles.line} style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className={styles.line} style={{ width: `${40 + Math.random() * 40}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
