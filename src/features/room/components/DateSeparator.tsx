import { useTranslation } from 'react-i18next'
import styles from './DateSeparator.module.scss'

interface DateSeparatorProps {
  timestamp: number
}

export function DateSeparator({ timestamp }: DateSeparatorProps) {
  const { t } = useTranslation()
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let label: string
  if (isSameDay(date, today)) {
    label = t('common.today', { defaultValue: 'Сегодня' })
  } else if (isSameDay(date, yesterday)) {
    label = t('common.yesterday', { defaultValue: 'Вчера' })
  } else {
    label = date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className={styles.separator}>
      <span className={styles.label}>{label}</span>
    </div>
  )
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
