import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSendMessage } from '../hooks/useSendMessage.js'
import styles from './MessageComposer.module.scss'

interface MessageComposerProps {
  roomId: string
}

export function MessageComposer({ roomId }: MessageComposerProps) {
  const { t } = useTranslation()
  const { send, onTyping } = useSendMessage(roomId)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    send(text)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
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

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.inputArea}>
        <button type="button" className={styles.attachBtn} title={t('messages.attachFile')}>
          +
        </button>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            handleInput()
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('messages.placeholder')}
          rows={1}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!text.trim()}
          title={t('messages.send')}
        >
          ➤
        </button>
      </div>
    </form>
  )
}
