import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../store/settingsStore.js'
import styles from './LanguageSettings.module.scss'

const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

export function LanguageSettings() {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useSettingsStore()

  const handleChange = (code: string) => {
    setLanguage(code)
    i18n.changeLanguage(code)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t('settings.language')}</h3>
      <div className={styles.options}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            className={`${styles.option} ${language === lang.code ? styles.selected : ''}`}
            onClick={() => handleChange(lang.code)}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  )
}
