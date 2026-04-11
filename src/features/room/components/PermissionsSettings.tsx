import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './PermissionsSettings.module.scss'

interface PermissionsSettingsProps {
  roomId: string
}

const POWER_OPTIONS = [
  { value: 0, labelKey: 'rooms.user' },
  { value: 50, labelKey: 'rooms.moderator' },
  { value: 100, labelKey: 'rooms.admin' },
]

interface PermField {
  key: string
  labelKey: string
  eventKey?: string
}

const PERM_FIELDS: PermField[] = [
  { key: 'users_default', labelKey: 'rooms.defaultLevel' },
  { key: 'events_default', labelKey: 'rooms.sendMessages' },
  { key: 'kick', labelKey: 'rooms.kickUsers' },
  { key: 'ban', labelKey: 'rooms.banUsers' },
  { key: 'redact', labelKey: 'rooms.redactMessages' },
  { key: 'invite', labelKey: 'rooms.inviteUsers' },
  { key: 'events', labelKey: 'rooms.changeName', eventKey: 'm.room.name' },
  { key: 'events', labelKey: 'rooms.changeAvatar', eventKey: 'm.room.avatar' },
  { key: 'events', labelKey: 'rooms.changePermissions', eventKey: 'm.room.power_levels' },
  { key: 'events', labelKey: 'rooms.changeHistory', eventKey: 'm.room.history_visibility' },
  { key: 'events', labelKey: 'rooms.enableEncryption', eventKey: 'm.room.encryption' },
]

export function PermissionsSettings({ roomId }: PermissionsSettingsProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [saving, setSaving] = useState(false)

  const powerLevels = useMemo(() => {
    const room = client?.getRoom(roomId)
    if (!room) return {}
    return room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() || {}
  }, [roomId, client])

  const getValue = (field: PermField): number => {
    if (field.eventKey) {
      const events = (powerLevels.events || {}) as Record<string, number>
      return events[field.eventKey] ?? (powerLevels.state_default as number) ?? 50
    }
    return (powerLevels[field.key] as number) ?? 0
  }

  const handleChange = async (field: PermField, value: number) => {
    if (!client || saving) return

    setSaving(true)
    try {
      const updated = { ...powerLevels }
      if (field.eventKey) {
        updated.events = { ...(updated.events as Record<string, number> || {}), [field.eventKey]: value }
      } else {
        updated[field.key] = value
      }
      await client.sendStateEvent(roomId, 'm.room.power_levels' as never, updated as never, '')
      toast(t('settings.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className={styles.section}>
      <p className={styles.description}>
        Задайте уровень власти, необходимый для совершения определённых действий в этом чате.
      </p>

      {PERM_FIELDS.map((field) => {
        const current = getValue(field)
        return (
          <div key={field.labelKey} className={styles.row}>
            <span className={styles.label}>{t(field.labelKey)}</span>
            <select
              className={styles.select}
              value={current}
              onChange={(e) => handleChange(field, Number(e.target.value))}
              disabled={saving}
            >
              {POWER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} - {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
