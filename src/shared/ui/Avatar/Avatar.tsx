import styles from './Avatar.module.scss'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  src?: string | null
  name: string
  size?: AvatarSize
  online?: boolean
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function stringToColor(str: string): string {
  const colors = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
    '#3949ab', '#1e88e5', '#039be5', '#00acc1',
    '#00897b', '#43a047', '#7cb342', '#c0ca33',
    '#fdd835', '#ffb300', '#fb8c00', '#f4511e',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ src, name, size = 'md', online, className = '' }: AvatarProps) {
  const cls = [styles.avatar, styles[size], className].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {src ? (
        <img src={src} alt={name} className={styles.image} />
      ) : (
        <span
          className={styles.initials}
          style={{ backgroundColor: stringToColor(name) }}
        >
          {getInitials(name)}
        </span>
      )}
      {online !== undefined && (
        <span className={`${styles.status} ${online ? styles.online : styles.offline}`} />
      )}
    </div>
  )
}
