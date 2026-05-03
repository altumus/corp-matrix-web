export interface RoomSummary {
  roomId: string
  name: string
  avatarUrl: string | null
  topic?: string
  isDirect: boolean
  isEncrypted: boolean
  memberCount: number
}

export interface TimelineEvent {
  eventId: string
  roomId: string
  type: string
  sender: string
  senderName: string
  senderAvatar: string | null
  timestamp: number
  content: Record<string, unknown>
  isEdited: boolean
  isRedacted: boolean
  isDecryptionFailure: boolean
  /**
   * True when the event is still encrypted but within a short grace period
   * after first being observed. UI should render a neutral "decrypting…"
   * placeholder rather than a failure label so messages don't visibly flip
   * from "не удалось расшифровать" to their real content as the rust-crypto
   * backend catches up.
   */
  decryptionPending: boolean
  replyTo?: string
  replyToEvent?: {
    sender: string
    body: string
  }
  threadRootId?: string
  threadReplyCount?: number
  reactions: Map<string, Set<string>>
  stateKey?: string
  targetName?: string
  prevContent?: Record<string, unknown>
}
