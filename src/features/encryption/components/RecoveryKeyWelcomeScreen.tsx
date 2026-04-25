import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Copy, Download, Check } from 'lucide-react'
import { useAuthStore } from '../../auth/store/authStore.js'
import { Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './RecoveryKeyWelcomeScreen.module.scss'

export function RecoveryKeyWelcomeScreen() {
  const { t } = useTranslation()
  const recoveryKey = useAuthStore((s) => s.pendingRecoveryKey)
  const acknowledge = useAuthStore((s) => s.acknowledgeRecoveryKey)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [continuing, setContinuing] = useState(false)

  if (!recoveryKey) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
      toast(t('encryption.welcome.copiedToast'), 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('encryption.welcome.copyFailed'), 'error')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([recoveryKey], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'corp-matrix-recovery-key.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleContinue = async () => {
    setContinuing(true)
    await acknowledge()
  }

  return (
    <div className={styles.layout}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.icon}>
            <ShieldCheck size={36} />
          </span>
          <h1 className={styles.title}>{t('encryption.welcome.title')}</h1>
          <p className={styles.description}>{t('encryption.welcome.description')}</p>
        </div>

        <div className={styles.warning}>
          <strong>{t('encryption.welcome.warningTitle')}</strong>
          <span>{t('encryption.welcome.warningBody')}</span>
        </div>

        <code className={styles.keyBox}>{recoveryKey}</code>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={handleCopy}
            fullWidth
            icon={copied ? <Check size={16} /> : <Copy size={16} />}
          >
            {copied ? t('encryption.welcome.copied') : t('encryption.welcome.copy')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownload}
            fullWidth
            icon={<Download size={16} />}
          >
            {t('encryption.welcome.download')}
          </Button>
        </div>

        <label className={styles.confirmCheckbox}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{t('encryption.welcome.confirmCheckbox')}</span>
        </label>

        <Button
          onClick={handleContinue}
          disabled={!confirmed}
          loading={continuing}
          fullWidth
          size="lg"
        >
          {t('encryption.welcome.continue')}
        </Button>
      </div>
    </div>
  )
}
