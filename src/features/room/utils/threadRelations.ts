import type { MatrixEvent } from 'matrix-js-sdk'

// In encrypted rooms matrix-js-sdk lifts `m.relates_to` out of the encrypted
// plaintext into the wire content (cleartext top-level) per spec, so the server
// can aggregate threads without decrypting. After decryption `getContent()`
// returns only the decrypted plaintext — without `m.relates_to`. Checking
// `getContent()` for thread relations therefore silently fails for E2EE rooms
// and thread replies leak into the main timeline.
//
// `event.threadRootId` is the canonical SDK getter that checks wire content,
// the SDK-assigned `Thread`, an explicit `threadId`, and unsigned bundled
// aggregation — covering encrypted and unencrypted events uniformly. The
// `getContent()` fallback catches the non-spec-compliant case where a sender
// put the relation only in the encrypted plaintext.
export function getThreadRootId(e: MatrixEvent): string | undefined {
  const sdkRoot = e.threadRootId
  if (sdkRoot && sdkRoot !== e.getId()) return sdkRoot

  const decryptedRel = e.getContent()?.['m.relates_to'] as
    | { rel_type?: string; event_id?: string }
    | undefined
  if (decryptedRel?.rel_type === 'm.thread' && typeof decryptedRel.event_id === 'string') {
    return decryptedRel.event_id
  }

  return undefined
}

export function isThreadReply(e: MatrixEvent): boolean {
  return getThreadRootId(e) !== undefined
}
