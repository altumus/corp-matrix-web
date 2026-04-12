import { ArrowDown } from 'lucide-react'
import styles from './ScrollToBottomFab.module.scss'

interface ScrollToBottomFabProps {
  visible: boolean
  newCount: number
  onClick: () => void
}

export function ScrollToBottomFab({ visible, newCount, onClick }: ScrollToBottomFabProps) {
  if (!visible) return null
  return (
    <button className={styles.fab} onClick={onClick} aria-label="Scroll to bottom">
      <ArrowDown size={18} />
      {newCount > 0 && <span className={styles.badge}>{newCount}</span>}
    </button>
  )
}
