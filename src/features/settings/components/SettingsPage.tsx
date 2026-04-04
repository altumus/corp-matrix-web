import { useState } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../auth/store/authStore.js'
import { Modal, Button } from '../../../shared/ui/index.js'
import { ProfileSettings } from './ProfileSettings.js'
import { AppearanceSettings } from './AppearanceSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { EncryptionSettings } from './EncryptionSettings.js'
import { LanguageSettings } from './LanguageSettings.js'
import { NotificationSettings } from '../../notifications/components/NotificationSettings.js'
import styles from './SettingsPage.module.scss'

export default function SettingsPage() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    window.location.href = '/login'
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <h2 className={styles.title}>{t('settings.title')}</h2>
        <NavLink
          to="/settings/profile"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.profile')}
        </NavLink>
        <NavLink
          to="/settings/appearance"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.appearance')}
        </NavLink>
        <NavLink
          to="/settings/devices"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.devices')}
        </NavLink>
        <NavLink
          to="/settings/encryption"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.encryption')}
        </NavLink>
        <NavLink
          to="/settings/language"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.language')}
        </NavLink>
        <NavLink
          to="/settings/notifications"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('notifications.title')}
        </NavLink>

        <div className={styles.spacer} />

        <button className={styles.logoutBtn} onClick={() => setShowLogoutModal(true)}>
          <LogOut size={16} />
          {t('auth.logout')}
        </button>
      </nav>
      <div className={styles.content}>
        <Routes>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="appearance" element={<AppearanceSettings />} />
          <Route path="devices" element={<DevicesSettings />} />
          <Route path="encryption" element={<EncryptionSettings />} />
          <Route path="language" element={<LanguageSettings />} />
          <Route path="notifications" element={<NotificationSettings />} />
        </Routes>
      </div>

      {showLogoutModal && (
        <Modal open onClose={() => setShowLogoutModal(false)} title={t('auth.logout')}>
          <div className={styles.logoutModal}>
            <p className={styles.logoutText}>Вы уверены, что хотите выйти из аккаунта?</p>
            <div className={styles.logoutActions}>
              <Button variant="secondary" onClick={() => setShowLogoutModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={handleLogout} loading={loggingOut}>
                {t('auth.logout')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
