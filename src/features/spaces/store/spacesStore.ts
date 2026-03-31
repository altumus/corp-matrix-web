import { create } from 'zustand'

export interface SpaceEntry {
  roomId: string
  name: string
  avatarUrl: string | null
  childRoomIds: string[]
}

interface SpacesState {
  spaces: SpaceEntry[]
  activeSpaceId: string | null
  setSpaces: (spaces: SpaceEntry[]) => void
  setActiveSpace: (spaceId: string | null) => void
}

export const useSpacesStore = create<SpacesState>((set) => ({
  spaces: [],
  activeSpaceId: null,
  setSpaces: (spaces) => set({ spaces }),
  setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId }),
}))
