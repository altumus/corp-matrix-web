import { useEffect, useState } from 'react'
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js'
import type { GroupCall } from 'matrix-js-sdk'
import { GroupCallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/groupCallEventHandler.js'

export function useActiveGroupCall(roomId: string): GroupCall | null {
  const client = useMatrixClient()
  const [activeCall, setActiveCall] = useState<GroupCall | null>(null)

  useEffect(() => {
    if (!client) return
    const room = client.getRoom(roomId)
    if (!room) return

    // Check for existing group call in room
    const existing = client.getGroupCallForRoom(roomId)
    setActiveCall(existing ?? null)

    // Listen for new group calls
    const onIncoming = (call: GroupCall) => {
      if (call.room.roomId === roomId) setActiveCall(call)
    }

    const onEnded = (call: GroupCall) => {
      if (call.room.roomId === roomId) setActiveCall(null)
    }

    client.on(GroupCallEventHandlerEvent.Incoming, onIncoming)
    client.on(GroupCallEventHandlerEvent.Ended, onEnded)

    return () => {
      client.removeListener(GroupCallEventHandlerEvent.Incoming, onIncoming)
      client.removeListener(GroupCallEventHandlerEvent.Ended, onEnded)
    }
  }, [client, roomId])

  return activeCall
}
