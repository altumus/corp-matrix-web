import { useCallback, useRef } from 'react'
import { marked } from 'marked'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { sendTextMessage, sendTypingIndicator } from '../services/messageService.js'

marked.setOptions({
  breaks: true,
  gfm: true,
})

function hasMarkdown(text: string): boolean {
  return /(\*\*.+?\*\*|__.+?__|_.+?_|\*.+?\*|~~.+?~~|`.+?`|```[\s\S]+?```|^#{1,6}\s|^[-*+]\s|^\d+\.\s|^\|.+\||\[.+\]\(.+\))/m.test(text)
}

function buildMentionFormats(body: string, roomId: string): { body: string; formattedBody: string | undefined } {
  const client = getMatrixClient()
  if (!client) return { body, formattedBody: undefined }

  const room = client.getRoom(roomId)
  if (!room) return { body, formattedBody: undefined }

  const members = room.getJoinedMembers()
  let plainBody = body
  let html = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let hasMention = false

  for (const member of members) {
    const name = member.name || member.userId
    const mention = `@${name}`
    if (!plainBody.includes(mention)) continue

    hasMention = true
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pillHtml = `<a href="https://matrix.to/#/${encodeURIComponent(member.userId)}">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a>`
    const escapedMention = mention.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    html = html.replace(new RegExp(escapedMention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), pillHtml)
    plainBody = plainBody.replace(new RegExp(`@${escapedName}`, 'g'), `${name}`)
  }

  return {
    body: plainBody,
    formattedBody: hasMention ? html : undefined,
  }
}

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false }) as string
  return html
    .replace(/^<p>/, '')
    .replace(/<\/p>\s*$/, '')
    .trim()
}

export function useSendMessage(roomId: string) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback(
    async (body: string, replyToEventId?: string, quotedText?: string, quotedSender?: string, threadRootId?: string) => {
      if (!body.trim()) return

      let finalBody = body.trim()
      let formattedBody: string | undefined

      const mentionResult = buildMentionFormats(finalBody, roomId)
      finalBody = mentionResult.body
      formattedBody = mentionResult.formattedBody

      if (!formattedBody && hasMarkdown(finalBody)) {
        formattedBody = renderMarkdown(finalBody)
      }

      if (quotedText) {
        const senderLine = quotedSender ? `${quotedSender}:\n` : ''
        const quotedLines = (senderLine + quotedText).split('\n').map((l) => `> ${l}`).join('\n')
        finalBody = `${quotedLines}\n\n${finalBody}`
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
        const senderHtml = quotedSender ? `<strong>${esc(quotedSender)}</strong><br/>` : ''
        const bodyHtml = formattedBody || esc(body.trim())
        formattedBody = `<blockquote>${senderHtml}${esc(quotedText)}</blockquote>${bodyHtml}`
      }

      await sendTextMessage({ roomId, body: finalBody, formattedBody, replyToEventId, threadRootId })
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
