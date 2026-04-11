import { createPortal } from 'react-dom'
import { useCallStore } from '../store/callStore.js'
import { CallView } from './CallView.js'
import { IncomingCallDialog } from './IncomingCallDialog.js'
import { useIncomingCall } from '../hooks/useIncomingCall.js'

/**
 * Renders the active call UI (CallView) and incoming call dialog at the
 * application root level so they're visible from any screen.
 */
export function CallContainer() {
  const activeCall = useCallStore((s) => s.activeCall)
  const isVideo = useCallStore((s) => s.isVideo)
  const status = useCallStore((s) => s.status)
  const micMuted = useCallStore((s) => s.micMuted)
  const videoMuted = useCallStore((s) => s.videoMuted)
  const endCall = useCallStore((s) => s.end)
  const toggleMic = useCallStore((s) => s.toggleMic)
  const toggleVideo = useCallStore((s) => s.toggleVideo)
  const acceptIncoming = useCallStore((s) => s.acceptIncoming)

  const { incoming, dismiss } = useIncomingCall()

  // Don't show incoming dialog if there's already an active call
  const showIncoming = incoming && !activeCall

  return (
    <>
      {showIncoming && createPortal(
        <IncomingCallDialog
          call={incoming}
          onAccept={(withVideo) => {
            acceptIncoming(incoming, withVideo)
            dismiss()
          }}
          onReject={() => {
            try { incoming.reject() } catch { /* ignore */ }
            dismiss()
          }}
        />,
        document.body,
      )}

      {activeCall && status !== 'idle' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: '#111',
        }}>
          <CallView
            call={activeCall}
            isVideo={isVideo}
            status={status}
            micMuted={micMuted}
            videoMuted={videoMuted}
            onEnd={endCall}
            onToggleMic={toggleMic}
            onToggleVideo={toggleVideo}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
