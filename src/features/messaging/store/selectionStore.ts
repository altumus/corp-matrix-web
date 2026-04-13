import { create } from 'zustand'

interface SelectionState {
  selecting: boolean
  selectedIds: Set<string>
  startSelecting: (eventId?: string) => void
  toggle: (eventId: string) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selecting: false,
  selectedIds: new Set(),

  startSelecting: (eventId) =>
    set({
      selecting: true,
      selectedIds: eventId ? new Set([eventId]) : new Set(),
    }),

  toggle: (eventId) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      if (next.size === 0) {
        return { selecting: false, selectedIds: next }
      }
      return { selectedIds: next }
    }),

  clear: () =>
    set({ selecting: false, selectedIds: new Set() }),
}))
