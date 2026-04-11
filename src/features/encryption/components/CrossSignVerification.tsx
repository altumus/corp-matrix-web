import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { VerificationRequestEvent } from 'matrix-js-sdk/lib/crypto-api/verification.js'
import type { VerificationRequest } from 'matrix-js-sdk/lib/crypto-api/index.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { requestOwnUserVerification } from '../services/cryptoService.js'
import { useAuthStore } from '../../auth/store/authStore.js'
import { Button, Spinner } from '../../../shared/ui/index.js'
import styles from './CrossSignVerification.module.scss'

interface CrossSignVerificationProps {
  onBack: () => void
}

type Phase = 'waiting' | 'qr' | 'done' | 'error'

export function CrossSignVerification({ onBack }: CrossSignVerificationProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const completeKeyRestore = useAuthStore((s) => s.completeKeyRestore)
  const [phase, setPhase] = useState<Phase>('waiting')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const requestRef = useRef<VerificationRequest | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function start() {
      try {
        const crypto = client?.getCrypto()
        if (!crypto || !client) {
          setErrorMsg(t('encryption.verificationFailed'))
          setPhase('error')
          return
        }

        const userId = client.getUserId()
        if (userId) {
          await crypto.getUserDeviceInfo([userId])
        }

        const request = await requestOwnUserVerification()
        requestRef.current = request

        request.on(VerificationRequestEvent.Change, async () => {
          // Ready = 2: other device accepted
          if (request.phase === 2) {
            try {
              const qrBytes = await request.generateQRCode()

              if (!qrBytes) {
                setErrorMsg(t('encryption.qrNotSupported'))
                setPhase('error')
                return
              }

              const dataUrl = await QRCode.toDataURL(
                [{ data: qrBytes, mode: 'byte' as const }],
                { width: 256, margin: 2, errorCorrectionLevel: 'L' },
              )

              setQrDataUrl(dataUrl)
              setPhase('qr')
            } catch (err) {
              setErrorMsg(err instanceof Error ? err.message : t('encryption.verificationFailed'))
              setPhase('error')
            }
          }

          // Done = 4
          if (request.phase === 4) {
            const crypto2 = client?.getCrypto()
            if (crypto2) {
              try { await crypto2.checkKeyBackupAndEnable() } catch { /* best-effort */ }
            }
            setPhase('done')
            setTimeout(() => completeKeyRestore(), 1500)
          }

          // Cancelled = 5
          if (request.phase === 5) {
            setErrorMsg(t('encryption.verificationCancelled'))
            setPhase('error')
          }
        })
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('encryption.verificationFailed'))
        setPhase('error')
      }
    }

    start()
  }, [t, completeKeyRestore, client])

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
