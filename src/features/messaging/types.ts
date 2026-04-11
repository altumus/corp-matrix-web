export interface ComposerState {
  text: string
  replyToEventId: string | null
  editingEventId: string | null
}

export interface SendMessageOptions {
  roomId: string
  body: string
  formattedBody?: string
  replyToEventId?: string
  threadRootId?: string
  roomMention?: boolean
}
