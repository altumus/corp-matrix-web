import { createContext, useContext } from 'react'

export type RightPanel = { type: 'details' } | { type: 'thread'; threadRootId: string } | null

export interface RightPanelContext {
  panel: RightPanel
  openDetails: () => void
  openThread: (threadRootId: string) => void
  closePanel: () => void
}

export const RightPanelCtx = createContext<RightPanelContext>({
  panel: null,
  openDetails: () => {},
  openThread: () => {},
  closePanel: () => {},
})

export function useRightPanel() {
  return useContext(RightPanelCtx)
}
