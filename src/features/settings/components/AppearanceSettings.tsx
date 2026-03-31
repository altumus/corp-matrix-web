import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme.js'
import type { ThemeMode } from '../store/settingsStore.js'
import styles from './AppearanceSettings.module.scss'

const THEMES: { value: ThemeMode; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
]

export function AppearanceSettings() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t('settings.appearance')}</h3>
      <div className={styles.group}>
        <label className={styles.label}>{t('settings.theme')}</label>
        <div className={styles.options}>
          {THEMES.map((option) => (
            <button
              key={option.value}
              className={`${styles.option} ${theme === option.value ? styles.selected : ''}`}
              onClick={() => setTheme(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
