import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Shield, Settings, ChevronRight, ArrowLeft } from 'lucide-react'
import type { RoomSummary } from '../types.js'
import { Avatar } from '../../../shared/ui/index.js'
import { MemberList } from './MemberList.js'
import { AccessibilitySettings } from './AccessibilitySettings.js'
import { PermissionsSettings } from './PermissionsSettings.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import styles from './RoomDetailsPanel.module.scss'

interface RoomDetailsPanelProps {
  room: RoomSummary
  onClose: () => void
}

type View = 'main' | 'accessibility' | 'permissions'

export function RoomDetailsPanel({ room, onClose }: RoomDetailsPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<View>('main')
  const isMobile = useIsMobile()
  const panelCls = `${styles.panel} ${isMobile ? styles.panelMobile : ''}`

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
          <Avatar src={room.avatarUrl} name={room.name} size="xl" />
          <h3 className={styles.roomName}>{room.name}</h3>
          <span className={styles.memberCount}>{room.memberCount} {t('rooms.members').toLowerCase()}</span>
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
