import { useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import { RoomMemberEvent } from 'matrix-js-sdk'
import type { MatrixEvent, RoomMember } from 'matrix-js-sdk'
import styles from './TypingIndicator.module.scss'

interface TypingIndicatorProps {
  roomId: string
}

export function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const client = useMatrixClient()
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  useEffect(() => {
    if (!client) return

    const onTyping = (_event: MatrixEvent, member: RoomMember) => {
      if (member.roomId !== roomId) return
      const room = client.getRoom(roomId)
      if (!room) return

      const members = room.currentState.getMembers()
      const typing = members
        .filter((m) => m.typing && m.userId !== client.getUserId())
        .map((m) => m.name)
      setTypingUsers(typing)
    }

    client.on(RoomMemberEvent.Typing, onTyping)
    return () => {
      client.removeListener(RoomMemberEvent.Typing, onTyping)
    }
  }, [roomId, client])

  if (typingUsers.length === 0) return null

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} печатает...`
      : `${typingUsers.join(', ')} печатают...`

  return (
    <div className={styles.indicator}>
      <div className={styles.dots}>
        <span />
        <span />
        <span />
      </div>
      <span className={styles.text}>{text}</span>
    </div>
  )
}
