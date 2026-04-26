export interface RoomListEntry {
  roomId: string
  name: string
  avatarUrl: string | null
  lastMessage: string
  lastMessageSender: string
  lastMessageSenderId: string
  lastMessageTs: number
  lastMessageInThread: boolean
  hasUnreadThreads: boolean
  unreadCount: number
  highlightCount: number
  isDirect: boolean
  isInvite: boolean
  isEncrypted: boolean
  isSavedMessages: boolean
  isPinned: boolean
  isArchived: boolean
}
