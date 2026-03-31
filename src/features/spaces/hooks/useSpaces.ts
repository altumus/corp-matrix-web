import { useCallback, useEffect } from 'react'
import { getMatrixClient, mxcToHttp } from '../../../shared/lib/matrixClient.js'
import { ClientEvent } from 'matrix-js-sdk'
import { useSpacesStore, type SpaceEntry } from '../store/spacesStore.js'

export function useSpaces() {
  const { spaces, activeSpaceId, setSpaces, setActiveSpace } = useSpacesStore()

  const refresh = useCallback(() => {
    const client = getMatrixClient()
    if (!client) return

    const allRooms = client.getRooms()
    const spaceRooms = allRooms.filter((room) => {
      const createEvent = room.currentState.getStateEvents('m.room.create', '')
      const type = createEvent?.getContent()?.type
      return type === 'm.space'
    })

    const entries: SpaceEntry[] = spaceRooms.map((room) => {
      const childEvents = room.currentState.getStateEvents('m.space.child') || []
      const childRoomIds = childEvents
        .filter((e) => e.getContent()?.via)
        .map((e) => e.getStateKey()!)

      return {
        roomId: room.roomId,
        name: room.name || room.roomId,
        avatarUrl: mxcToHttp(room.getAvatarUrl(client.baseUrl, 32, 32, 'crop') ?? null, 32, 32),
        childRoomIds,
      }
    })

    setSpaces(entries)
  }, [setSpaces])

  useEffect(() => {
    const client = getMatrixClient()
    if (!client) return

    refresh()
    client.on(ClientEvent.Sync, refresh)
    return () => {
      client.removeListener(ClientEvent.Sync, refresh)
    }
  }, [refresh])

  return { spaces, activeSpaceId, setActiveSpace, refresh }
}
