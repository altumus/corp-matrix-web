import {
  createNewMatrixCall,
  type MatrixCall,
} from 'matrix-js-sdk'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'

/**
 * Create an outbound 1:1 call (voice or video) to a specific user.
 * Returns null if client unavailable or call cannot be created.
 */
export function createOutboundCall(roomId: string, inviteeUserId: string): MatrixCall | null {
  const client = getMatrixClient()
  if (!client) return null

  const call = createNewMatrixCall(client, roomId, {
    invitee: inviteeUserId,
  } as never)

  return call
}

/**
 * Get TURN servers from homeserver if available.
 * Returns empty array if no TURN servers configured.
 */
export async function getTurnServers(): Promise<RTCIceServer[]> {
  const client = getMatrixClient()
  if (!client) return []
  try {
    const turn = client.getTurnServers() as Array<{ urls: string[]; username?: string; credential?: string }>
    return turn.map((t) => ({
      urls: t.urls,
      username: t.username,
      credential: t.credential,
    }))
  } catch {
    return []
  }
}
