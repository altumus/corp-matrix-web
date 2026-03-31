import { useCallback, useRef } from 'react'
import { sendTextMessage, sendTypingIndicator } from '../services/messageService.js'

export function useSendMessage(roomId: string) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback(
    async (body: string, replyToEventId?: string) => {
      if (!body.trim()) return
      await sendTextMessage({ roomId, body: body.trim(), replyToEventId })
      await sendTypingIndicator(roomId, false)
    },
    [roomId],
  )

  const onTyping = useCallback(() => {
    sendTypingIndicator(roomId, true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(roomId, false)
    }, 5000)
  }, [roomId])

  return { send, onTyping }
}
