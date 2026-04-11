import { useTranslation } from 'react-i18next'
import styles from './EncryptionBadge.module.scss'

interface EncryptionBadgeProps {
  verified: boolean
}

export function EncryptionBadge({ verified }: EncryptionBadgeProps) {
  const { t } = useTranslation()
  return (
    <span
      className={`${styles.badge} ${verified ? styles.verified : styles.unverified}`}
      title={verified
        ? t('encryption.verified', { defaultValue: 'Проверено' })
        : t('encryption.unverified', { defaultValue: 'Не проверено' })}
    >
      {verified ? '🔒' : '⚠️'}
    </span>
  )
}
