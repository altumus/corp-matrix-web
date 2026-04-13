import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { VerificationRequestEvent, VerifierEvent, VerificationPhase } from 'matrix-js-sdk/lib/crypto-api/verification.js'
import type { VerificationRequest, ShowSasCallbacks, EmojiMapping } from 'matrix-js-sdk/lib/crypto-api/verification.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { requestOwnUserVerification, waitForBackupAfterVerification } from '../services/cryptoService.js'
import { useAuthStore } from '../../auth/store/authStore.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { Button, Spinner } from '../../../shared/ui/index.js'
import styles from './CrossSignVerification.module.scss'

interface CrossSignVerificationProps {
  onBack: () => void
  onComplete?: () => void
}

type Phase = 'waiting' | 'qr' | 'emoji' | 'restoring' | 'done' | 'error'

export function CrossSignVerification({ onBack, onComplete }: CrossSignVerificationProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const completeKeyRestore = useAuthStore((s) => s.completeKeyRestore)
  const [phase, setPhase] = useState<Phase>('waiting')
  const phaseRef = useRef<Phase>('waiting')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [emojis, setEmojis] = useState<EmojiMapping[]>([])
  const [sasCallbacks, setSasCallbacks] = useState<ShowSasCallbacks | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestRef = useRef<VerificationRequest | null>(null)
  const startedRef = useRef(false)

  const updatePhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const finishVerification = useCallback(async () => {
    const crypto = client?.getCrypto()
    if (crypto) {
      try { await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false }) } catch { /* best-effort */ }
      try { await crypto.checkKeyBackupAndEnable() } catch { /* best-effort */ }

      // Check if backup is already active (e.g. keys were cached locally)
      const alreadyActive = await crypto.getActiveSessionBackupVersion().catch(() => null)
      if (!alreadyActive) {
        // Wait for the verified device to gossip the backup decryption key
        updatePhase('restoring')
        const restored = await waitForBackupAfterVerification(30_000)
        if (!restored) {
          toast('Устройство подтверждено, но ключи бэкапа не получены. Старые сообщения могут быть недоступны.', 'warning')
        }
      }
    }
    updatePhase('done')
    toast('Устройство подтверждено', 'success')
    if (onComplete) {
      setTimeout(() => onComplete(), 1500)
    } else {
      setTimeout(() => completeKeyRestore(), 1500)
    }
  }, [client, completeKeyRestore, onComplete, updatePhase])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function start() {
      try {
        const crypto = client?.getCrypto()
        if (!crypto || !client) {
          setErrorMsg(t('encryption.verificationFailed'))
          updatePhase('error')
          return
        }

        const userId = client.getUserId()
        if (userId) {
          await crypto.getUserDeviceInfo([userId])
        }

        const request = await requestOwnUserVerification()
        requestRef.current = request

        request.on(VerificationRequestEvent.Change, async () => {
          // Ready: other device accepted → try QR first, fallback to SAS emoji
          if (request.phase === VerificationPhase.Ready) {
            // Try QR code first
            try {
              const qrBytes = await request.generateQRCode()
              if (qrBytes) {
                const dataUrl = await QRCode.toDataURL(
                  [{ data: qrBytes, mode: 'byte' as const }],
                  { width: 256, margin: 2, errorCorrectionLevel: 'L' },
                )
                setQrDataUrl(dataUrl)
                updatePhase('qr')
              }
            } catch { /* QR not available, continue to SAS */ }

            // Start SAS (emoji) verification — works alongside QR as fallback
            try {
              const verifier = await request.startVerification('m.sas.v1')
              if (verifier) {
                verifier.on(VerifierEvent.ShowSas, (sas: ShowSasCallbacks) => {
                  if (sas.sas.emoji) {
                    setEmojis(sas.sas.emoji)
                    setSasCallbacks(sas)
                    updatePhase('emoji')
                  }
                })

                verifier.verify().then(async () => {
                  await finishVerification()
                }).catch(() => {})
              }
            } catch {
              // If both QR and SAS fail — use ref to avoid stale closure
              if (phaseRef.current !== 'qr') {
                setErrorMsg('Не удалось начать верификацию')
                updatePhase('error')
              }
            }
          }

          // Done (from QR scan)
          if (request.phase === VerificationPhase.Done) {
            await finishVerification()
          }

          // Cancelled
          if (request.phase === VerificationPhase.Cancelled) {
            setErrorMsg(t('encryption.verificationCancelled'))
            updatePhase('error')
          }
        })
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('encryption.verificationFailed'))
        updatePhase('error')
      }
    }

    start()
  }, [t, finishVerification, client, updatePhase])

  const handleConfirmEmoji = async () => {
    setLoading(true)
    try {
      await sasCallbacks?.confirm()
    } catch {
      toast('Ошибка подтверждения', 'error')
    }
  }

  const handleMismatch = () => {
    sasCallbacks?.mismatch()
    toast('Верификация отменена', 'error')
    onBack()
  }

  const handleBack = useCallback(() => {
    try { requestRef.current?.cancel() } catch { /* best-effort */ }
    onBack()
  }, [onBack])

  return (
    <div className={styles.container}>
      {phase === 'waiting' && (
        <div className={styles.centered}>
          <Spinner size={32} />
          <p className={styles.text}>{t('encryption.waitingForDevice')}</p>
          <p className={styles.qrHint}>{t('encryption.waitingForDeviceHint')}</p>
        </div>
      )}

      {phase === 'qr' && qrDataUrl && (
        <div className={styles.centered}>
          <div className={styles.qrWrapper}>
            <img src={qrDataUrl} alt="QR code" className={styles.qrImage} />
          </div>
          <p className={styles.qrHint}>{t('encryption.scanQrHint')}</p>
          <p className={styles.qrHint} style={{ fontSize: 'var(--font-size-xs)', marginTop: 8 }}>
            Ожидание emoji-подтверждения...
          </p>
        </div>
      )}

      {phase === 'emoji' && (
        <div className={styles.centered}>
          <p className={styles.text}>Сравните эмодзи на обоих устройствах</p>
          <div className={styles.emojiGrid}>
            {emojis.map(([emoji, name], i) => (
              <div key={i} className={styles.emojiItem}>
                <span className={styles.emoji}>{emoji}</span>
                <span className={styles.emojiName}>{name}</span>
              </div>
            ))}
          </div>
          <div className={styles.backRow}>
            <Button variant="secondary" onClick={handleMismatch}>
              Не совпадают
            </Button>
            <Button onClick={handleConfirmEmoji} loading={loading}>
              Совпадают
            </Button>
          </div>
        </div>
      )}

      {phase === 'restoring' && (
        <div className={styles.centered}>
          <Spinner size={32} />
          <p className={styles.text}>Получение ключей шифрования...</p>
          <p className={styles.qrHint}>Ожидаем передачу ключей от другого устройства для расшифровки истории сообщений</p>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.centered}>
          <span className={styles.successIcon}>✓</span>
          <p className={styles.successText}>{t('encryption.verificationSuccess')}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.centered}>
          <p className={styles.errorText}>{errorMsg}</p>
          <Button variant="secondary" onClick={handleBack}>
            {t('encryption.back')}
          </Button>
        </div>
      )}

      {(phase === 'waiting' || phase === 'qr') && (
        <div className={styles.backRow}>
          <Button variant="secondary" onClick={handleBack}>
            {t('encryption.back')}
          </Button>
        </div>
      )}
    </div>
  )
}
