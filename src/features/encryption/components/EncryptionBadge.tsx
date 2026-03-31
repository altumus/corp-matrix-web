import styles from './EncryptionBadge.module.scss'

interface EncryptionBadgeProps {
  verified: boolean
}

export function EncryptionBadge({ verified }: EncryptionBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${verified ? styles.verified : styles.unverified}`}
      title={verified ? 'Проверено' : 'Не проверено'}
    >
      {verified ? '🔒' : '⚠️'}
    </span>
  )
}
