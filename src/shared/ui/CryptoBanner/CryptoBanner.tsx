import { useCryptoStatus } from '../../hooks/useCryptoStatus.js'
import styles from './CryptoBanner.module.scss'

export function CryptoBanner() {
  const cryptoReady = useCryptoStatus()

  if (cryptoReady) return null

  return (
    <div className={styles.banner}>
      <span className={styles.icon}>&#x26A0;</span>
      <span className={styles.text}>
        Шифрование недоступно. Сообщения могут быть небезопасны.
      </span>
    </div>
  )
}
