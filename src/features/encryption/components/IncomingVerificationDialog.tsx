import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'
import { VerifierEvent } from 'matrix-js-sdk/lib/crypto-api/verification.js'
import type { ShowSasCallbacks, EmojiMapping } from 'matrix-js-sdk/lib/crypto-api/verification.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { waitForBackupAfterVerification } from '../services/cryptoService.js'
import { Modal, Button, Spinner } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './IncomingVerificationDialog.module.scss'

interface IncomingVerificationDialogProps {
  request: VerificationRequest
  onClose: () => void
}

type Phase = 'pending' | 'waiting' | 'emoji' | 'restoring' | 'done'

export function IncomingVerificationDialog({ request, onClose }: IncomingVerificationDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<Phase>('pending')
  const [emojis, setEmojis] = useState<EmojiMapping[]>([])
  const [sasCallbacks, setSasCallbacks] = useState<ShowSasCallbacks | null>(null)

  const handleAccept = useCallback(async () => {
    setLoading(true)
    try {
      await request.accept()
      setPhase('waiting')

      const verifier = await request.startVerification('m.sas.v1')
      if (!verifier) {
        toast('Не удалось начать верификацию', 'error')
        onClose()
        return
      }

      verifier.on(VerifierEvent.ShowSas, (sas: ShowSasCallbacks) => {
        if (sas.sas.emoji) {
          setEmojis(sas.sas.emoji)
          setSasCallbacks(sas)
          setPhase('emoji')
          setLoading(false)
        }
      })

      verifier.verify().then(async () => {
        // After SAS verification succeeds — bootstrap cross-signing so this
        // device gets signed by the user's master key. Without this,
        // FluffyChat/Element will still show "unverified device".
        try {
          const client = getMatrixClient()
          const crypto = client?.getCrypto()
          if (crypto) {
            await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false })
            await crypto.checkKeyBackupAndEnable().catch(() => {})

            const alreadyActive = await crypto.getActiveSessionBackupVersion().catch(() => null)
            if (!alreadyActive) {
              setPhase('restoring')
              const restored = await waitForBackupAfterVerification(30_000)
              if (!restored) {
                toast('Устройство подтверждено, но ключи бэкапа не получены', 'warning')
              }
            }
          }
        } catch { /* best-effort */ }

        setPhase('done')
        toast('Устройство подтверждено', 'success')
        setTimeout(onClose, 1500)
      }).catch(() => {})
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка верификации', 'error')
      onClose()
    }
  }, [request, onClose])

  const handleConfirmEmoji = async () => {
    setLoading(true)
    try {
      await sasCallbacks?.confirm()
    } catch {
      toast('Ошибка подтверждения', 'error')
      onClose()
    }
  }

  const handleMismatch = () => {
    sasCallbacks?.mismatch()
    toast('Верификация отменена', 'error')
    onClose()
  }

  const handleDecline = async () => {
    try {
      await request.cancel()
    } catch {
      // ignore
    }
    onClose()
  }

  return (
    <Modal open onClose={handleDecline} title={t('verification.title', { defaultValue: 'Запрос верификации' })}>
      <div className={styles.content}>
        {phase === 'pending' && (
          <>
            <div className={styles.icon}>
              <ShieldCheck size={48} />
            </div>
            <p className={styles.text}>
              {t('verification.description', { defaultValue: 'Другое устройство запрашивает верификацию. Подтвердите, чтобы установить доверие между устройствами.' })}
            </p>
            <div className={styles.info}>
              <span>{t('verification.from', { defaultValue: 'От' })}: {request.otherUserId}</span>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={handleDecline}>
                {t('verification.decline', { defaultValue: 'Отклонить' })}
              </Button>
              <Button onClick={handleAccept} loading={loading}>
                {t('verification.accept', { defaultValue: 'Подтвердить' })}
              </Button>
            </div>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <div className={styles.icon}>
              <ShieldCheck size={48} />
            </div>
            <p className={styles.text}>{t('verification.waiting', { defaultValue: 'Ожидание ответа от другого устройства...' })}</p>
          </>
        )}

        {phase === 'emoji' && (
          <>
            <p className={styles.emojiTitle}>{t('verification.compareEmoji', { defaultValue: 'Сравните эмодзи' })}</p>
            <div className={styles.emojiGrid}>
              {emojis.map(([emoji, name], i) => (
                <div key={i} className={styles.emojiItem}>
                  <span className={styles.emoji}>{emoji}</span>
                  <span className={styles.emojiName}>{name}</span>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={handleMismatch}>
                {t('verification.mismatch', { defaultValue: 'Не совпадают' })}
              </Button>
              <Button onClick={handleConfirmEmoji} loading={loading}>
                {t('verification.match', { defaultValue: 'Совпадают' })}
              </Button>
            </div>
          </>
        )}

        {phase === 'restoring' && (
          <>
            <div className={styles.icon}>
              <Spinner size={32} />
            </div>
            <p className={styles.text}>Получение ключей шифрования...</p>
          </>
        )}

        {phase === 'done' && (
          <p className={styles.textSuccess}>{t('verification.success', { defaultValue: 'Устройство успешно подтверждено!' })}</p>
        )}
      </div>
    </Modal>
  )
}
