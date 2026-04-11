import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Shield, Settings, ChevronRight, ArrowLeft, Edit2, Check } from 'lucide-react'
import type { RoomSummary } from '../types.js'
import { Avatar } from '../../../shared/ui/index.js'
import { MemberList } from './MemberList.js'
import { AccessibilitySettings } from './AccessibilitySettings.js'
import { PermissionsSettings } from './PermissionsSettings.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import styles from './RoomDetailsPanel.module.scss'

interface RoomDetailsPanelProps {
  room: RoomSummary
  onClose: () => void
}

type View = 'main' | 'accessibility' | 'permissions'

export function RoomDetailsPanel({ room, onClose }: RoomDetailsPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('main')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(room.name)
  const [editingTopic, setEditingTopic] = useState(false)
  const [topicValue, setTopicValue] = useState(room.topic || '')
  const isMobile = useIsMobile()
  const panelCls = `${styles.panel} ${isMobile ? styles.panelMobile : ''}`

  // Check if user can edit room name/topic (PL ≥ 50 by default)
  const client = useMatrixClient()
  const matrixRoom = client?.getRoom(room.roomId)
  const myUserId = client?.getUserId()
  const canEdit = !!matrixRoom && !!myUserId && (() => {
    const pl = matrixRoom.currentState.getStateEvents('m.room.power_levels', '')?.getContent() || {}
    const users = (pl.users || {}) as Record<string, number>
    const defaultLevel = (pl.users_default as number) || 0
    const myLevel = users[myUserId] ?? defaultLevel
    return myLevel >= 50
  })()

  const handleSaveName = async () => {
    if (!client || !nameValue.trim() || nameValue === room.name) {
      setEditingName(false)
      setNameValue(room.name)
      return
    }
    try {
      await client.setRoomName(room.roomId, nameValue.trim())
      toast(t('rooms.nameUpdated', { defaultValue: 'Название обновлено' }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
      setNameValue(room.name)
    }
    setEditingName(false)
  }

  const handleSaveTopic = async () => {
    if (!client || topicValue === (room.topic || '')) {
      setEditingTopic(false)
      return
    }
    try {
      await client.setRoomTopic(room.roomId, topicValue.trim())
      toast(t('rooms.topicUpdated', { defaultValue: 'Описание обновлено' }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
      setTopicValue(room.topic || '')
    }
    setEditingTopic(false)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!client || !canEdit) return
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const upload = await client.uploadContent(file, { type: file.type })
      const mxc = (upload as { content_uri: string }).content_uri
      await client.sendStateEvent(room.roomId, 'm.room.avatar' as never, { url: mxc } as never, '')
      toast(t('rooms.avatarUpdated', { defaultValue: 'Аватар обновлён' }), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
    e.target.value = ''
  }

  if (view === 'accessibility') {
    return (
      <div className={panelCls}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView('main')}>
            <ArrowLeft size={18} />
          </button>
          <span className={styles.title}>{t('rooms.accessAndVisibility')}</span>
        </div>
        <div className={styles.scrollable}>
          <AccessibilitySettings roomId={room.roomId} />
        </div>
      </div>
    )
  }

  if (view === 'permissions') {
    return (
      <div className={panelCls}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => setView('main')}>
            <ArrowLeft size={18} />
          </button>
          <span className={styles.title}>{t('rooms.permissions')}</span>
        </div>
        <div className={styles.scrollable}>
          <PermissionsSettings roomId={room.roomId} />
        </div>
      </div>
    )
  }

  return (
    <div className={panelCls}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>
        <span className={styles.title}>{t('rooms.chatDetails')}</span>
      </div>

      <div className={styles.scrollable}>
        <div className={styles.profile}>
          {canEdit ? (
            <label className={styles.avatarUploadLabel} title={t('rooms.changeAvatar', { defaultValue: 'Сменить аватар' })}>
              <Avatar src={room.avatarUrl} name={room.name} size="xl" />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
            </label>
          ) : (
            <Avatar src={room.avatarUrl} name={room.name} size="xl" />
          )}
          {editingName ? (
            <div className={styles.editRow}>
              <input
                className={styles.editInput}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                autoFocus
              />
              <button onClick={handleSaveName} className={styles.editSave}><Check size={16} /></button>
            </div>
          ) : (
            <h3 className={styles.roomName} onClick={() => canEdit && setEditingName(true)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
              {room.name}
              {canEdit && <Edit2 size={14} style={{ marginLeft: 8, opacity: 0.5 }} />}
            </h3>
          )}
          <span className={styles.memberCount}>{room.memberCount} {t('rooms.members').toLowerCase()}</span>

          {(room.topic || canEdit) && (
            editingTopic ? (
              <div className={styles.editRow}>
                <textarea
                  className={styles.editInput}
                  value={topicValue}
                  onChange={(e) => setTopicValue(e.target.value)}
                  rows={2}
                  autoFocus
                />
                <button onClick={handleSaveTopic} className={styles.editSave}><Check size={16} /></button>
              </div>
            ) : (
              <p className={styles.topicText} onClick={() => canEdit && setEditingTopic(true)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                {room.topic || (canEdit ? t('rooms.addTopic', { defaultValue: 'Добавить описание...' }) : '')}
              </p>
            )
          )}
        </div>

        <div className={styles.nav}>
          <button className={styles.navItem} onClick={() => setView('accessibility')}>
            <Shield size={18} className={styles.navIcon} />
            <div className={styles.navContent}>
              <span className={styles.navLabel}>{t('rooms.accessAndVisibility')}</span>
            </div>
            <ChevronRight size={16} className={styles.navArrow} />
          </button>
          <button className={styles.navItem} onClick={() => setView('permissions')}>
            <Settings size={18} className={styles.navIcon} />
            <div className={styles.navContent}>
              <span className={styles.navLabel}>{t('rooms.permissions')}</span>
            </div>
            <ChevronRight size={16} className={styles.navArrow} />
          </button>
        </div>

        <MemberList roomId={room.roomId} />
      </div>
    </div>
  )
}
