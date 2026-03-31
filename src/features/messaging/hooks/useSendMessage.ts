import { useCallback, useRef } from 'react'
import { sendTextMessage, sendTypingIndicator } from '../services/messageService.js'

export function useSendMessage(roomId: string) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback(
    async (body: string, replyToEventId?: string, quotedText?: string, quotedSender?: string) => {
      if (!body.trim()) return

      let finalBody = body.trim()
      let formattedBody: string | undefined

      if (quotedText) {
        const senderLine = quotedSender ? `${quotedSender}:\n` : ''
        const quotedLines = (senderLine + quotedText).split('\n').map((l) => `> ${l}`).join('\n')
        finalBody = `${quotedLines}\n\n${finalBody}`
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
        const senderHtml = quotedSender ? `<strong>${esc(quotedSender)}</strong><br/>` : ''
        formattedBody = `<blockquote>${senderHtml}${esc(quotedText)}</blockquote>${body.trim()}`
      }

      await sendTextMessage({ roomId, body: finalBody, formattedBody, replyToEventId })
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
