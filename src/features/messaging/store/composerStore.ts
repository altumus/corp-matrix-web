import { create } from 'zustand'

interface ReplyTarget {
  eventId: string
  sender: string
  body: string
}

interface ComposerStore {
  replyTarget: ReplyTarget | null
  setReplyTarget: (target: ReplyTarget | null) => void
  clearReply: () => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  replyTarget: null,
  setReplyTarget: (target) => set({ replyTarget: target }),
  clearReply: () => set({ replyTarget: null }),
}))
