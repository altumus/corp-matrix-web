import styles from './Skeleton.module.scss'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  circle?: boolean
  className?: string
}

export function Skeleton({ width, height, circle = false, className = '' }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${circle ? styles.circle : ''} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
