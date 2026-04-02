import { create } from 'zustand'

interface ReplyTarget {
  eventId: string
  sender: string
  body: string
  quotedText?: string
}

interface EditTarget {
  eventId: string
  body: string
}

interface ComposerStore {
  replyTarget: ReplyTarget | null
  editTarget: EditTarget | null
  setReplyTarget: (target: ReplyTarget | null) => void
  setEditTarget: (target: EditTarget | null) => void
  clearReply: () => void
  clearEdit: () => void
}

export const useComposerStore = create<ComposerStore>((set) => ({
  replyTarget: null,
  editTarget: null,
  setReplyTarget: (target) => set({ replyTarget: target, editTarget: null }),
  setEditTarget: (target) => set({ editTarget: target, replyTarget: null }),
  clearReply: () => set({ replyTarget: null }),
  clearEdit: () => set({ editTarget: null }),
}))
