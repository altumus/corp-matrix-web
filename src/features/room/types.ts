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
  replyTo?: string
  replyToEvent?: {
    sender: string
    body: string
  }
  threadRootId?: string
  threadReplyCount?: number
  reactions: Map<string, Set<string>>
}
