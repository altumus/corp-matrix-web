import { create } from 'zustand'
import i18n from '../../../shared/i18n/index.js'

export type ThemeMode = 'light' | 'dark' | 'system'

interface SettingsState {
  theme: ThemeMode
  language: string
  setTheme: (theme: ThemeMode) => void
  setLanguage: (lang: string) => void
}

function getInitialTheme(): ThemeMode {
  return (localStorage.getItem('theme') as ThemeMode) || 'system'
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
  localStorage.setItem('theme', theme)
}

function getInitialLanguage(): string {
  return localStorage.getItem('language') || 'en'
}

function applyLanguage(lang: string) {
  i18n.changeLanguage(lang)
  localStorage.setItem('language', lang)
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initialTheme = getInitialTheme()
  applyTheme(initialTheme)

  const initialLanguage = getInitialLanguage()
  applyLanguage(initialLanguage)

  return {
    theme: initialTheme,
    language: initialLanguage,

    setTheme: (theme) => {
      applyTheme(theme)
      set({ theme })
    },

    setLanguage: (lang) => {
      applyLanguage(lang)
      set({ language: lang })
    },
  }
})
