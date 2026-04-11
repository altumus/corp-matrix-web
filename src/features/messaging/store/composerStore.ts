import { create } from 'zustand'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

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
  drafts: Record<string, string>
  setReplyTarget: (target: ReplyTarget | null) => void
  setEditTarget: (target: EditTarget | null) => void
  clearReply: () => void
  clearEdit: () => void
  setDraft: (roomId: string, text: string) => void
  getDraft: (roomId: string) => string
  clearDraft: (roomId: string) => void
  loadDraftFromServer: (roomId: string) => void
  cleanupStaleDrafts: () => void
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null

function syncDraftToServer(roomId: string, text: string) {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    const client = getMatrixClient()
    if (!client) return
    client.setRoomAccountData(roomId, 'org.matrix.draft' as never, { body: text } as never).catch(() => {})
  }, 2000)
}

export const useComposerStore = create<ComposerStore>((set, get) => ({
  replyTarget: null,
  editTarget: null,
  drafts: {},
  setReplyTarget: (target) => set({ replyTarget: target, editTarget: null }),
  setEditTarget: (target) => set({ editTarget: target, replyTarget: null }),
  clearReply: () => set({ replyTarget: null }),
  clearEdit: () => set({ editTarget: null }),

  setDraft: (roomId, text) => {
    set((s) => ({ drafts: { ...s.drafts, [roomId]: text } }))
    syncDraftToServer(roomId, text)
  },

  getDraft: (roomId) => get().drafts[roomId] || '',

  clearDraft: (roomId) => {
    set((s) => {
      const drafts = { ...s.drafts }
      delete drafts[roomId]
      return { drafts }
    })
    syncDraftToServer(roomId, '')
  },

  loadDraftFromServer: (roomId) => {
    const client = getMatrixClient()
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return
    try {
      const data = room.getAccountData('org.matrix.draft')
      const body = data?.getContent()?.body as string
      if (body) {
        set((s) => ({ drafts: { ...s.drafts, [roomId]: body } }))
      }
    } catch {
      // no draft saved
    }
  },

  cleanupStaleDrafts: () => {
    const client = getMatrixClient()
    if (!client) return

    const drafts = get().drafts
    const cleaned: Record<string, string> = {}

    for (const [roomId, text] of Object.entries(drafts)) {
      const room = client.getRoom(roomId)
      if (room && room.getMyMembership() === 'join') {
        cleaned[roomId] = text
      }
      // Otherwise drop — room left/deleted
    }

    set({ drafts: cleaned })
  },
}))
