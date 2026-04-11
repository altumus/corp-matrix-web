import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/index.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { useAuthStore } from '../../auth/store/authStore.js'
import { getIdleTimeout, setIdleTimeout } from '../../../shared/hooks/useIdleLogout.js'
import styles from './PrivacySettings.module.scss'

const READ_RECEIPTS_KEY = 'corp-matrix-send-read-receipts'
const TYPING_KEY = 'corp-matrix-send-typing'

export function getSendReadReceipts(): boolean {
  return localStorage.getItem(READ_RECEIPTS_KEY) !== 'false'
}

export function getSendTyping(): boolean {
  return localStorage.getItem(TYPING_KEY) !== 'false'
}

export function PrivacySettings() {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const logout = useAuthStore((s) => s.logout)
  const [readReceipts, setReadReceipts] = useState(getSendReadReceipts())
  const [typing, setTyping] = useState(getSendTyping())
  const [idleTimeoutMin, setIdleTimeoutMinState] = useState(0)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    setIdleTimeoutMinState(Math.round(getIdleTimeout() / 60000))
  }, [])

  const handleReadReceipts = (value: boolean) => {
    setReadReceipts(value)
    localStorage.setItem(READ_RECEIPTS_KEY, String(value))
  }

  const handleTyping = (value: boolean) => {
    setTyping(value)
    localStorage.setItem(TYPING_KEY, String(value))
  }

  const handleIdleTimeout = (minutes: number) => {
    setIdleTimeoutMinState(minutes)
    setIdleTimeout(minutes * 60 * 1000)
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      if (!client) throw new Error('Client not initialized')
      await client.deactivateAccount({
        type: 'm.login.dummy' as never,
      } as never, true)
      toast(t('privacy.accountDeactivated', { defaultValue: 'Аккаунт удалён' }), 'success')
      await logout()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        {t('privacy.title', { defaultValue: 'Приватность' })}
      </h3>

      <div className={styles.option}>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={readReceipts}
            onChange={(e) => handleReadReceipts(e.target.checked)}
          />
          <span>{t('privacy.sendReadReceipts', { defaultValue: 'Отправлять отметки о прочтении' })}</span>
        </label>
        <p className={styles.hint}>
          {t('privacy.sendReadReceiptsHint', {
            defaultValue: 'Другие участники видят, что вы прочитали их сообщения',
          })}
        </p>
      </div>

      <div className={styles.option}>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={typing}
            onChange={(e) => handleTyping(e.target.checked)}
          />
          <span>{t('privacy.sendTyping', { defaultValue: 'Отправлять "печатает..."' })}</span>
        </label>
        <p className={styles.hint}>
          {t('privacy.sendTypingHint', {
            defaultValue: 'Другие участники видят, когда вы набираете сообщение',
          })}
        </p>
      </div>

      <div className={styles.option}>
        <label className={styles.label}>
          <span>{t('privacy.idleLogout', { defaultValue: 'Авто-выход через (минут)' })}</span>
          <select
            value={idleTimeoutMin}
            onChange={(e) => handleIdleTimeout(Number(e.target.value))}
            className={styles.select}
          >
            <option value={0}>{t('privacy.idleDisabled', { defaultValue: 'Отключено' })}</option>
            <option value={5}>5</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </label>
      </div>

      <div className={styles.dangerSection}>
        <h4 className={styles.dangerHeading}>
          {t('privacy.dangerZone', { defaultValue: 'Опасная зона' })}
        </h4>
        {!showDeactivate ? (
          <Button variant="danger" onClick={() => setShowDeactivate(true)}>
            {t('privacy.deactivateAccount', { defaultValue: 'Удалить аккаунт' })}
          </Button>
        ) : (
          <div className={styles.confirmBlock}>
            <p>
              {t('privacy.deactivateConfirm', {
                defaultValue: 'Удаление аккаунта необратимо. Все ваши данные будут потеряны.',
              })}
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setShowDeactivate(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={handleDeactivate} loading={deactivating}>
                {t('privacy.deactivateConfirmBtn', { defaultValue: 'Да, удалить навсегда' })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
