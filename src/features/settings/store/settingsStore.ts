import { create } from 'zustand'

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

export const useSettingsStore = create<SettingsState>((set) => {
  const initialTheme = getInitialTheme()
  applyTheme(initialTheme)

  return {
    theme: initialTheme,
    language: localStorage.getItem('language') || 'ru',

    setTheme: (theme) => {
      applyTheme(theme)
      set({ theme })
    },

    setLanguage: (lang) => {
      localStorage.setItem('language', lang)
      set({ language: lang })
    },
  }
})
