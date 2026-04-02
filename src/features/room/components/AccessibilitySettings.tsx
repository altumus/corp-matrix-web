import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './AccessibilitySettings.module.scss'

interface AccessibilitySettingsProps {
  roomId: string
}

type HistoryVisibility = 'invited' | 'joined' | 'shared' | 'world_readable'
type JoinRule = 'public' | 'knock' | 'invite'

export function AccessibilitySettings({ roomId }: AccessibilitySettingsProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const { historyVisibility, joinRule, roomVersion } = useMemo(() => {
    const client = getMatrixClient()
    const room = client?.getRoom(roomId)
    if (!room) return { historyVisibility: 'shared' as HistoryVisibility, joinRule: 'invite' as JoinRule, roomVersion: '' }

    const hv = room.currentState.getStateEvents('m.room.history_visibility', '')?.getContent()?.history_visibility as HistoryVisibility || 'shared'
    const jr = room.currentState.getStateEvents('m.room.join_rules', '')?.getContent()?.join_rule as JoinRule || 'invite'
    const ver = room.currentState.getStateEvents('m.room.create', '')?.getContent()?.room_version as string || ''

    return { historyVisibility: hv, joinRule: jr, roomVersion: ver }
  }, [roomId])

  const handleHistoryChange = async (value: HistoryVisibility) => {
    const client = getMatrixClient()
    if (!client || saving) return
    setSaving(true)
    try {
      await client.sendStateEvent(roomId, 'm.room.history_visibility' as never, { history_visibility: value } as never, '')
      toast(t('settings.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleJoinRuleChange = async (value: JoinRule) => {
    const client = getMatrixClient()
    if (!client || saving) return
    setSaving(true)
    try {
      await client.sendStateEvent(roomId, 'm.room.join_rules' as never, { join_rule: value } as never, '')
      toast(t('settings.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast('Скопировано', 'success')
  }

  const historyOptions: { value: HistoryVisibility; label: string }[] = [
    { value: 'invited', label: t('rooms.historyInvited') },
    { value: 'joined', label: t('rooms.historyJoined') },
    { value: 'shared', label: t('rooms.historyShared') },
    { value: 'world_readable', label: t('rooms.historyWorldReadable') },
  ]

  const joinOptions: { value: JoinRule; label: string }[] = [
    { value: 'public', label: t('rooms.joinPublic') },
    { value: 'knock', label: t('rooms.joinKnock') },
    { value: 'invite', label: t('rooms.joinInvite') },
  ]

  return (
    <div className={styles.section}>
      <h4 className={styles.heading}>{t('rooms.historyVisibility')}</h4>
      <div className={styles.radioGroup}>
        {historyOptions.map((opt) => (
          <label key={opt.value} className={styles.radio}>
            <input
              type="radio"
              name="history"
              checked={historyVisibility === opt.value}
              onChange={() => handleHistoryChange(opt.value)}
              disabled={saving}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <h4 className={styles.heading}>{t('rooms.joinRules')}</h4>
      <div className={styles.radioGroup}>
        {joinOptions.map((opt) => (
          <label key={opt.value} className={styles.radio}>
            <input
              type="radio"
              name="joinRule"
              checked={joinRule === opt.value}
              onChange={() => handleJoinRuleChange(opt.value)}
              disabled={saving}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <div className={styles.infoBlock}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t('rooms.roomId')}</span>
          <div className={styles.infoValue}>
            <code>{roomId}</code>
            <button className={styles.copyBtn} onClick={copyRoomId}><Copy size={14} /></button>
          </div>
        </div>
        {roomVersion && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('rooms.roomVersion')}</span>
            <span>{roomVersion}</span>
          </div>
        )}
      </div>
    </div>
  )
}
