import { useCallback, useRef } from 'react'
import { marked } from 'marked'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { sanitizeHtml } from '../../../shared/lib/sanitizeHtml.js'
import { sendTextMessage, sendTypingIndicator } from '../services/messageService.js'
import { enqueueMessage } from '../services/sendQueue.js'
import { processSlashCommand } from '../services/slashCommands.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { getSendTyping } from '../../settings/components/PrivacySettings.js'
import { useTimelineScroll } from '../../room/context/TimelineScrollContext.js'

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

function highlightHashtags(html: string): { html: string; hasHashtags: boolean } {
  const hashtagRegex = /(^|\s)(#[а-яА-ЯёЁa-zA-Z0-9_]+)/g
  let hasHashtags = false
  const result = html.replace(hashtagRegex, (_, prefix, tag) => {
    hasHashtags = true
    return `${prefix}<span class="hashtag">${tag}</span>`
  })
  return { html: result, hasHashtags }
}

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false }) as string
  return sanitizeHtml(
    html
      .replace(/^<p>/, '')
      .replace(/<\/p>\s*$/, '')
      .trim(),
  )
}

export function useSendMessage(roomId: string) {
  const { scrollToBottom } = useTimelineScroll()
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback(
    async (body: string, replyToEventId?: string, quotedText?: string, quotedSender?: string, threadRootId?: string): Promise<boolean> => {
      if (!body.trim()) return false

      let finalBody = body.trim()
      let formattedBody: string | undefined
      let isEmote = false

      // Slash commands
      const slashResult = processSlashCommand(finalBody)
      if (slashResult) {
        finalBody = slashResult.body
        isEmote = !!slashResult.emote
      }
      void isEmote

      const mentionResult = buildMentionFormats(finalBody, roomId)
      finalBody = mentionResult.body
      formattedBody = mentionResult.formattedBody

      if (!formattedBody && hasMarkdown(finalBody)) {
        formattedBody = renderMarkdown(finalBody)
      }

      // Highlight #hashtags
      const hashtagSource = formattedBody || finalBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const hashtagResult = highlightHashtags(hashtagSource)
      if (hashtagResult.hasHashtags) {
        formattedBody = hashtagResult.html
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

      // Check if @room was used
      const hasRoomMention = body.includes('@room')

      const messageOpts = { roomId, body: finalBody, formattedBody, replyToEventId, threadRootId, roomMention: hasRoomMention }
      try {
        await sendTextMessage(messageOpts)
        await sendTypingIndicator(roomId, false)
        scrollToBottom()
        return true
      } catch (err) {
        // If offline or network error — enqueue for retry
        if (!navigator.onLine || (err instanceof Error && /network|fetch|connection/i.test(err.message))) {
          await enqueueMessage(messageOpts)
          toast('Сообщение отправлено в очередь — будет доставлено при появлении сети', 'info')
          return true // Treat as success for UI purposes
        }
        toast(err instanceof Error ? err.message : 'Не удалось отправить сообщение', 'error')
        return false
      }
    },
    [roomId, scrollToBottom],
  )

  const onTyping = useCallback(() => {
    if (!getSendTyping()) return // privacy: typing disabled

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
