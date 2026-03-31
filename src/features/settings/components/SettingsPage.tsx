import { NavLink, Route, Routes, Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ProfileSettings } from './ProfileSettings.js'
import { AppearanceSettings } from './AppearanceSettings.js'
import { DevicesSettings } from './DevicesSettings.js'
import { LanguageSettings } from './LanguageSettings.js'
import styles from './SettingsPage.module.scss'

export default function SettingsPage() {
  const { t } = useTranslation()

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
          to="/settings/language"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {t('settings.language')}
        </NavLink>
      </nav>
      <div className={styles.content}>
        <Routes>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="appearance" element={<AppearanceSettings />} />
          <Route path="devices" element={<DevicesSettings />} />
          <Route path="language" element={<LanguageSettings />} />
        </Routes>
      </div>
    </div>
  )
}
