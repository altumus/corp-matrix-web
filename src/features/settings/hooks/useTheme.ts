import { useSettingsStore } from '../store/settingsStore.js'

export function useTheme() {
  const { theme, setTheme } = useSettingsStore()
  return { theme, setTheme }
}
