import { createContext, useContext } from 'react'

export type RightPanel =
  | { type: 'details' }
  | { type: 'thread'; threadRootId: string }
  | { type: 'threads-list' }
  | null

export interface RightPanelContext {
  panel: RightPanel
  openDetails: () => void
  openThread: (threadRootId: string) => void
  openThreadsList: () => void
  closePanel: () => void
}

export const RightPanelCtx = createContext<RightPanelContext>({
  panel: null,
  openDetails: () => {},
  openThread: () => {},
  openThreadsList: () => {},
  closePanel: () => {},
})

export function useRightPanel() {
  return useContext(RightPanelCtx)
}
