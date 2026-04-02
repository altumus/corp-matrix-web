import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Check } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import styles from './PollMessage.module.scss'

interface PollAnswer {
  id: string
  text: string
}

interface PollMessageProps {
  eventId: string
  roomId: string
  content: Record<string, unknown>
}

export function PollMessage({ eventId, roomId, content }: PollMessageProps) {
  const { t } = useTranslation()
  const [voted, setVoted] = useState<string | null>(null)

  const poll = (content['org.matrix.msc3381.poll'] || content['m.poll']) as {
    question?: { 'org.matrix.msc1767.text'?: string; body?: string }
    answers?: Array<{ id: string; 'org.matrix.msc1767.text'?: string; body?: string }>
  } | undefined

  const question = poll?.question?.['org.matrix.msc1767.text'] || poll?.question?.body || ''
  const answers = useMemo<PollAnswer[]>(() => {
    if (!poll?.answers) return []
    return poll.answers.map((a) => ({
      id: a.id,
      text: a['org.matrix.msc1767.text'] || a.body || '',
    }))
  }, [poll?.answers])

  const handleVote = async (answerId: string) => {
    const client = getMatrixClient()
    if (!client || voted) return

    setVoted(answerId)
    try {
      await client.sendEvent(roomId, 'org.matrix.msc3381.poll.response' as never, {
        'm.relates_to': {
          rel_type: 'm.reference',
          event_id: eventId,
        },
        'org.matrix.msc3381.poll.response': {
          answers: [answerId],
        },
      } as never)
    } catch {
      setVoted(null)
    }
  }

  if (!poll || answers.length === 0) {
    return <p>{(content.body as string) || 'Опрос'}</p>
  }

  return (
    <div className={styles.poll}>
      <div className={styles.header}>
        <BarChart3 size={16} />
        <span className={styles.question}>{question}</span>
      </div>
      <div className={styles.answers}>
        {answers.map((answer) => {
          const isVoted = voted === answer.id
          return (
            <button
              key={answer.id}
              className={`${styles.answer} ${isVoted ? styles.voted : ''}`}
              onClick={() => handleVote(answer.id)}
              disabled={!!voted}
            >
              <span className={styles.answerText}>{answer.text}</span>
              {isVoted && <Check size={16} className={styles.check} />}
            </button>
          )
        })}
      </div>
      {!voted && (
        <span className={styles.hint}>{t('messages.vote')}</span>
      )}
    </div>
  )
}
