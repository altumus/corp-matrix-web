import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Check } from 'lucide-react'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { Modal, Avatar } from '../../../shared/ui/index.js'
import styles from './PollMessage.module.scss'

interface PollAnswer {
  id: string
  text: string
}

interface VoteInfo {
  answerId: string
  userId: string
  name: string
}

interface PollMessageProps {
  eventId: string
  roomId: string
  content: Record<string, unknown>
}

function getText(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return ''
  const o = obj as Record<string, unknown>
  return (o['org.matrix.msc1767.text'] as string)
    || (o['m.text'] as string)
    || (o.body as string)
    || (typeof o.text === 'string' ? o.text : '')
    || ''
}

function extractPoll(content: Record<string, unknown>) {
  return (
    content['org.matrix.msc3381.poll']
    || content['m.poll']
    || content['org.matrix.msc3381.poll.start']
    || content['m.poll.start']
  ) as Record<string, unknown> | null
}

function collectVotes(roomId: string, pollEventId: string): VoteInfo[] {
  const client = getMatrixClient()
  if (!client) return []
  const room = client.getRoom(roomId)
  if (!room) return []

  const votes: VoteInfo[] = []
  const latestByUser = new Map<string, VoteInfo>()

  const allTimelines = room.getUnfilteredTimelineSet().getTimelines()
  for (const tl of allTimelines) {
    for (const ev of tl.getEvents()) {
      const type = ev.getType()
      if (type !== 'org.matrix.msc3381.poll.response' && type !== 'm.poll.response') continue

      const relates = ev.getContent()?.['m.relates_to'] as Record<string, unknown> | undefined
      if (relates?.event_id !== pollEventId) continue

      const response = (ev.getContent()?.['org.matrix.msc3381.poll.response'] || ev.getContent()?.['m.poll.response']) as Record<string, unknown> | undefined
      const answers = response?.answers as string[] | undefined
      if (!answers?.length) continue

      const userId = ev.getSender()!
      const member = room.getMember(userId)
      const name = member?.name || userId

      for (const answerId of answers) {
        latestByUser.set(`${userId}:${answerId}`, { answerId, userId, name })
      }
    }
  }

  for (const vote of latestByUser.values()) {
    votes.push(vote)
  }

  return votes
}

export function PollMessage({ eventId, roomId, content }: PollMessageProps) {
  const { t } = useTranslation()
  const client = useMatrixClient()
  const [myVotes, setMyVotes] = useState<string[]>([])
  const [allVotes, setAllVotes] = useState<VoteInfo[]>([])
  const [showStats, setShowStats] = useState(false)

  const poll = extractPoll(content)

  const question = useMemo(() => {
    if (!poll) return getText(content)
    return getText(poll.question)
  }, [poll, content])

  const maxSelections = (poll?.max_selections as number) || 1

  const answers = useMemo<PollAnswer[]>(() => {
    if (!poll?.answers) return []
    return (poll.answers as Array<Record<string, unknown>>).map((a) => ({
      id: (a.id as string) || '',
      text: getText(a),
    }))
  }, [poll])

  useEffect(() => {
    requestAnimationFrame(() => {
      const votes = collectVotes(roomId, eventId)
      setAllVotes(votes)

      const myUserId = client?.getUserId()
      if (myUserId) {
        const mine = votes.filter((v) => v.userId === myUserId).map((v) => v.answerId)
        setMyVotes(mine)
      }
    })
  }, [roomId, eventId, client])

  const totalVotes = useMemo(() => {
    const voters = new Set(allVotes.map((v) => v.userId))
    return voters.size
  }, [allVotes])

  const totalMembers = useMemo(() => {
    if (!client) return 0
    const room = client.getRoom(roomId)
    return room?.getJoinedMemberCount() || 0
  }, [roomId, client])

  const votesPerAnswer = useMemo(() => {
    const map = new Map<string, VoteInfo[]>()
    for (const v of allVotes) {
      if (!map.has(v.answerId)) map.set(v.answerId, [])
      map.get(v.answerId)!.push(v)
    }
    return map
  }, [allVotes])

  const handleVote = async (answerId: string) => {
    if (!client) return

    let nextVoted: string[]
    if (maxSelections > 1) {
      nextVoted = myVotes.includes(answerId)
        ? myVotes.filter((id) => id !== answerId)
        : [...myVotes, answerId]
    } else {
      if (myVotes.includes(answerId)) return
      nextVoted = [answerId]
    }

    setMyVotes(nextVoted)

    try {
      await client.sendEvent(roomId, 'org.matrix.msc3381.poll.response' as never, {
        'm.relates_to': {
          rel_type: 'm.reference',
          event_id: eventId,
        },
        'org.matrix.msc3381.poll.response': {
          answers: nextVoted,
        },
      } as never)

      const myUserId = client.getUserId()!
      const myName = client.getRoom(roomId)?.getMember(myUserId)?.name || myUserId
      setAllVotes((prev) => {
        const without = prev.filter((v) => v.userId !== myUserId)
        return [...without, ...nextVoted.map((aid) => ({ answerId: aid, userId: myUserId, name: myName }))]
      })
    } catch {
      setMyVotes(myVotes)
    }
  }

  if (!poll || answers.length === 0) {
    const fallback = getText(content) || (content.body as string) || 'Опрос'
    return <p>{fallback}</p>
  }

  const hasVotes = totalVotes > 0

  return (
    <div className={styles.poll}>
      <div className={styles.header}>
        <BarChart3 size={16} />
        <span className={styles.question}>{question}</span>
      </div>
      <div className={styles.answers}>
        {answers.map((answer) => {
          const isVoted = myVotes.includes(answer.id)
          const voters = votesPerAnswer.get(answer.id) || []
          const pct = totalMembers > 0 ? Math.round((voters.length / totalMembers) * 100) : 0

          return (
            <div key={answer.id} className={styles.answerWrap}>
              <button
                className={`${styles.answer} ${isVoted ? styles.voted : ''}`}
                onClick={() => handleVote(answer.id)}
              >
                <div className={styles.answerContent}>
                  <span className={styles.answerText}>{answer.text}</span>
                  {hasVotes && <span className={styles.pct}>{pct}%</span>}
                  {isVoted && <Check size={14} className={styles.check} />}
                </div>
                {hasVotes && (
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progressFill} ${isVoted ? styles.progressVoted : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>
      {hasVotes && (
        <button className={styles.totalVotes} onClick={() => setShowStats(true)}>
          {totalVotes} из {totalMembers} проголосовали
        </button>
      )}
      {!hasVotes && (
        <span className={styles.hint}>{t('messages.vote')}</span>
      )}

      {showStats && (
        <Modal open onClose={() => setShowStats(false)} title={question}>
          <div className={styles.statsModal}>
            {answers.map((answer) => {
              const voters = votesPerAnswer.get(answer.id) || []
              const pct = totalMembers > 0 ? Math.round((voters.length / totalMembers) * 100) : 0

              return (
                <div key={answer.id} className={styles.statSection}>
                  <div className={styles.statHeader}>
                    <span className={styles.statText}>{answer.text}</span>
                    <span className={styles.statPct}>{pct}% ({voters.length})</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {voters.length > 0 ? (
                    <div className={styles.statVoters}>
                      {voters.map((v) => (
                        <div key={v.userId} className={styles.statVoter}>
                          <Avatar src={null} name={v.name} size="xs" />
                          <span>{v.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.statEmpty}>Нет голосов</span>
                  )}
                </div>
              )
            })}
            <div className={styles.statTotal}>
              Проголосовали: {totalVotes} из {totalMembers}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
