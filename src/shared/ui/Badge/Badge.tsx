import styles from './Badge.module.scss'

interface BadgeProps {
  count: number
  highlight?: boolean
  className?: string
}

export function Badge({ count, highlight = false, className = '' }: BadgeProps) {
  if (count <= 0) return null

  const display = count > 99 ? '99+' : String(count)

  return (
    <span
      className={`${styles.badge} ${highlight ? styles.highlight : ''} ${className}`}
      aria-label={`${count} непрочитанных`}
    >
      {display}
    </span>
  )
}
