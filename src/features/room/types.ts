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
  replyTo?: string
  replyToEvent?: {
    sender: string
    body: string
  }
  threadRootId?: string
  reactions: Map<string, Set<string>>
}
