export interface RoomListEntry {
  roomId: string
  name: string
  avatarUrl: string | null
  lastMessage: string
  lastMessageSender: string
  lastMessageTs: number
  unreadCount: number
  highlightCount: number
  isDirect: boolean
  isInvite: boolean
  isEncrypted: boolean
  isSavedMessages: boolean
}
