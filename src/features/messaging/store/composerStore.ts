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
  replyTarget: Record<string, ReplyTarget | null>
  editTarget: Record<string, EditTarget | null>
  drafts: Record<string, string>
  setReplyTarget: (scope: string, target: ReplyTarget | null) => void
  setEditTarget: (scope: string, target: EditTarget | null) => void
  clearReply: (scope: string) => void
  clearEdit: (scope: string) => void
  setDraft: (scope: string, text: string) => void
  getDraft: (scope: string) => string
  clearDraft: (scope: string) => void
  loadDraftFromServer: (scope: string) => void
  cleanupStaleDrafts: () => void
}

const DRAFT_LS_PREFIX = 'corp-matrix-draft:'

// Per-scope sync timers to avoid one scope's timer overwriting another
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()

function isThreadScope(scope: string): boolean {
  return scope.includes(':')
}

function saveDraftToLocalStorage(scope: string, text: string) {
  try {
    if (text) {
      localStorage.setItem(`${DRAFT_LS_PREFIX}${scope}`, text)
    } else {
      localStorage.removeItem(`${DRAFT_LS_PREFIX}${scope}`)
    }
  } catch { /* quota exceeded — best-effort */ }
}

function loadDraftFromLocalStorage(scope: string): string {
  try {
    return localStorage.getItem(`${DRAFT_LS_PREFIX}${scope}`) || ''
  } catch {
    return ''
  }
}

function syncDraftToServer(scope: string, text: string) {
  // Thread drafts are localStorage-only; do not sync to room account data.
  if (isThreadScope(scope)) return

  const existing = syncTimers.get(scope)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    syncTimers.delete(scope)
    const client = getMatrixClient()
    if (!client) return
    client.setRoomAccountData(scope, 'org.matrix.draft' as never, { body: text } as never).catch(() => {
      // Server sync failed — localStorage fallback already saved
    })
  }, 2000)

  syncTimers.set(scope, timer)
}

export const useComposerStore = create<ComposerStore>((set, get) => ({
  replyTarget: {},
  editTarget: {},
  drafts: {},

  setReplyTarget: (scope, target) =>
    set((s) => ({
      replyTarget: { ...s.replyTarget, [scope]: target },
      editTarget: { ...s.editTarget, [scope]: null },
    })),

  setEditTarget: (scope, target) =>
    set((s) => ({
      editTarget: { ...s.editTarget, [scope]: target },
      replyTarget: { ...s.replyTarget, [scope]: null },
    })),

  clearReply: (scope) =>
    set((s) => ({ replyTarget: { ...s.replyTarget, [scope]: null } })),

  clearEdit: (scope) =>
    set((s) => ({ editTarget: { ...s.editTarget, [scope]: null } })),

  setDraft: (scope, text) => {
    set((s) => ({ drafts: { ...s.drafts, [scope]: text } }))
    saveDraftToLocalStorage(scope, text)
    syncDraftToServer(scope, text)
  },

  getDraft: (scope) => get().drafts[scope] || '',

  clearDraft: (scope) => {
    set((s) => {
      const drafts = { ...s.drafts }
      delete drafts[scope]
      return { drafts }
    })
    saveDraftToLocalStorage(scope, '')
    syncDraftToServer(scope, '')
  },

  loadDraftFromServer: (scope) => {
    const client = getMatrixClient()
    if (!client) return

    // Threads: localStorage-only.
    if (!isThreadScope(scope)) {
      const room = client.getRoom(scope)
      if (room) {
        try {
          const data = room.getAccountData('org.matrix.draft')
          const body = data?.getContent()?.body as string
          if (body) {
            set((s) => ({ drafts: { ...s.drafts, [scope]: body } }))
            return
          }
        } catch {
          // no draft saved on server
        }
      }
    }

    // Fallback to localStorage (also primary path for thread scopes)
    const local = loadDraftFromLocalStorage(scope)
    if (local) {
      set((s) => ({ drafts: { ...s.drafts, [scope]: local } }))
    }
  },

  cleanupStaleDrafts: () => {
    const client = getMatrixClient()
    if (!client) return

    const drafts = get().drafts
    const cleaned: Record<string, string> = {}

    for (const [scope, text] of Object.entries(drafts)) {
      const roomId = scope.split(':')[0]
      const room = client.getRoom(roomId)
      if (room && room.getMyMembership() === 'join') {
        cleaned[scope] = text
      } else {
        // Clean up localStorage too
        saveDraftToLocalStorage(scope, '')
      }
    }

    set({ drafts: cleaned })
  },
}))
