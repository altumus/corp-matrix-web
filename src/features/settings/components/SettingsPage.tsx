import { useState } from 'react'
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../auth/store/authStore.js'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery.js'
import { Modal, Button } from '../../../shared/ui/index.js'
import { ProfileSettings } from './ProfileSettings.js'
import { AppearanceSettings } from './AppearanceSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { EncryptionSettings } from './EncryptionSettings.js'
import { LanguageSettings } from './LanguageSettings.js'
import { NotificationSettings } from '../../notifications/components/NotificationSettings.js'
import { PrivacySettings } from './PrivacySettings.js'
import styles from './SettingsPage.module.scss'

export default function SettingsPage() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const isSubPage = location.pathname !== '/settings' && location.pathname !== '/settings/'

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    window.location.href = '/login'
  }

  const showNav = !isMobile || !isSubPage
  const showContent = !isMobile || isSubPage

  return (
    <div className={`${styles.page} ${isMobile ? styles.pageMobile : ''}`}>
      {showNav && (
        <nav className={`${styles.nav} ${isMobile ? styles.navMobile : ''}`}>
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
          <NavLink
            to="/settings/privacy"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            {t('privacy.title', { defaultValue: 'Приватность' })}
          </NavLink>

          <div className={styles.spacer} />

          <button className={styles.logoutBtn} onClick={() => setShowLogoutModal(true)}>
            <LogOut size={16} />
            {t('auth.logout')}
          </button>
        </nav>
      )}
      {showContent && (
        <div className={`${styles.content} ${isMobile ? styles.contentMobile : ''}`}>
          {isMobile && isSubPage && (
            <button className={styles.backBtn} onClick={() => navigate('/settings')}>
              <ArrowLeft size={20} />
              <span>{t('settings.title')}</span>
            </button>
          )}
          <Routes>
            <Route index element={isMobile ? null : <Navigate to="profile" replace />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="appearance" element={<AppearanceSettings />} />
            <Route path="devices" element={<DevicesSettings />} />
            <Route path="encryption" element={<EncryptionSettings />} />
            <Route path="language" element={<LanguageSettings />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="privacy" element={<PrivacySettings />} />
          </Routes>
        </div>
      )}

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
