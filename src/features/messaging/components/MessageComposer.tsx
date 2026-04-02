import { useRef, useState, useCallback, useEffect, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSendMessage } from '../hooks/useSendMessage.js'
import { useMediaUpload } from '../../media/hooks/useMediaUpload.js'
import { useMentions, type MentionCandidate } from '../hooks/useMentions.js'
import { ImagePreviewDialog } from '../../media/components/ImagePreviewDialog.js'
import { MentionPopup } from './MentionPopup.js'
import { useComposerStore } from '../store/composerStore.js'
import styles from './MessageComposer.module.scss'

interface MessageComposerProps {
  roomId: string
}

function getMentionContext(text: string, cursorPos: number): { query: string; start: number } | null {
  const before = text.slice(0, cursorPos)
  const match = before.match(/@([^\s@]*)$/)
  if (!match) return null
  return { query: match[1], start: before.length - match[0].length }
}

export function MessageComposer({ roomId }: MessageComposerProps) {
  const { t } = useTranslation()
  const { send, onTyping } = useSendMessage(roomId)
  const { upload, uploading } = useMediaUpload(roomId)
  const { candidates, active: mentionActive, open: openMention, close: closeMention, setQuery: setMentionQuery } = useMentions(roomId)
  const replyTarget = useComposerStore((s) => s.replyTarget)
  const clearReply = useComposerStore((s) => s.clearReply)
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const mentionStartRef = useRef<number>(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus()
    }
  }, [replyTarget])

  const insertMention = useCallback((candidate: MentionCandidate) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = mentionStartRef.current
    if (start === -1) return

    const before = text.slice(0, start)
    const after = text.slice(textarea.selectionStart)
    const mention = `@${candidate.displayName} `
    const newText = before + mention + after
    setText(newText)
    closeMention()
    setMentionIndex(0)
    mentionStartRef.current = -1

    requestAnimationFrame(() => {
      const pos = before.length + mention.length
      textarea.setSelectionRange(pos, pos)
      textarea.focus()
    })
  }, [text, closeMention])

  const handleTextChange = useCallback((value: string) => {
    setText(value)
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const ctx = getMentionContext(value, cursorPos)

    if (ctx) {
      mentionStartRef.current = ctx.start
      openMention(ctx.query)
      setMentionIndex(0)
    } else {
      closeMention()
      mentionStartRef.current = -1
    }
  }, [openMention, closeMention])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    send(text, replyTarget?.eventId, replyTarget?.quotedText, replyTarget?.quotedText ? replyTarget.sender : undefined)
    setText('')
    clearReply()
    closeMention()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (mentionActive && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(candidates[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMention()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInput = () => {
    onTyping()
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const named = new File([file], `paste-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type: file.type })
          setPendingFile(named)
        }
        return
      }
    }
  }, [])

  const handleConfirmSend = useCallback(async () => {
    if (!pendingFile) return
    const file = pendingFile
    setPendingFile(null)
    await upload(file)
  }, [pendingFile, upload])

  const handleCancelSend = useCallback(() => {
    setPendingFile(null)
  }, [])

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    const file = files[0]
    if (file.type.startsWith('image/')) {
      setPendingFile(file)
    } else {
      upload(file)
    }

    e.target.value = ''
  }, [upload])

  return (
    <>
      <form className={styles.composer} onSubmit={handleSubmit}>
        {replyTarget && (
          <div className={styles.replyPreview}>
            <div className={styles.replyInfo}>
              <span className={styles.replyLabel}>↩ {replyTarget.sender}</span>
              {replyTarget.quotedText ? (
                <span className={styles.replyQuote}>{replyTarget.quotedText}</span>
              ) : (
                <span className={styles.replyBody}>{replyTarget.body}</span>
              )}
            </div>
            <button
              type="button"
              className={styles.replyCancelBtn}
              onClick={clearReply}
              title={t('common.cancel')}
            >
              ✕
            </button>
          </div>
        )}

        {mentionActive && candidates.length > 0 && (
          <MentionPopup
            candidates={candidates}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}

        <div className={styles.inputArea}>
          <button
            type="button"
            className={styles.attachBtn}
            title={t('messages.attachFile')}
            onClick={handleAttachClick}
            disabled={uploading}
          >
            +
          </button>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => {
              handleTextChange(e.target.value)
              handleInput()
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={uploading ? t('messages.uploading') : t('messages.placeholder')}
            rows={1}
            disabled={uploading}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!text.trim() || uploading}
            title={t('messages.send')}
          >
            ➤
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.hiddenInput}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={handleFileChange}
        />
      </form>

      {pendingFile && (
        <ImagePreviewDialog
          file={pendingFile}
          onConfirm={handleConfirmSend}
          onCancel={handleCancelSend}
        />
      )}
    </>
  )
}
