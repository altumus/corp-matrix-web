import { create } from 'zustand'

type MobileView = 'rooms' | 'chat'

interface MobileNavState {
  activeView: MobileView
  setActiveView: (view: MobileView) => void
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  activeView: 'rooms',
  setActiveView: (view) => set({ activeView: view }),
}))
