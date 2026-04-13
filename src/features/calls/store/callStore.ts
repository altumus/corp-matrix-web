import { create } from 'zustand'
import { CallEvent, type MatrixCall } from 'matrix-js-sdk'
import { CallState } from 'matrix-js-sdk/lib/webrtc/call.js'
import { createOutboundCall } from '../services/callService.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'
import { playOutgoingRingback, stopRingtone } from '../services/ringtoneService.js'

export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended'

interface CallStore {
  activeCall: MatrixCall | null
  status: CallStatus
  isVideo: boolean
  micMuted: boolean
  videoMuted: boolean

  startVoice: (roomId: string, inviteeUserId: string) => Promise<void>
  startVideo: (roomId: string, inviteeUserId: string) => Promise<void>
  acceptIncoming: (call: MatrixCall, withVideo: boolean) => Promise<void>
  end: () => void
  toggleMic: () => void
  toggleVideo: () => void
}

const attachedCalls = new WeakSet<MatrixCall>()

function attachListeners(call: MatrixCall, set: (s: Partial<CallStore>) => void) {
  if (attachedCalls.has(call)) return
  attachedCalls.add(call)

  call.on(CallEvent.State, (state: CallState) => {
    let status: CallStatus = 'connecting'
    if (state === CallState.Ringing) status = 'ringing'
    else if (state === CallState.Connected) {
      status = 'connected'
      stopRingtone()
    } else if (state === CallState.Ended) {
      status = 'ended'
      stopRingtone()
      setTimeout(() => {
        set({ activeCall: null, status: 'idle' })
      }, 1500)
    }
    set({ status })
  })

  call.on(CallEvent.Hangup, () => {
    stopRingtone()
    set({ status: 'ended' })
    setTimeout(() => {
      set({ activeCall: null, status: 'idle' })
    }, 1500)
  })

  call.on(CallEvent.Error, (err: Error) => {
    toast(`Ошибка звонка: ${err.message}`, 'error')
    set({ activeCall: null, status: 'idle' })
  })
}

export const useCallStore = create<CallStore>((set, get) => ({
  activeCall: null,
  status: 'idle',
  isVideo: false,
  micMuted: false,
  videoMuted: false,

  startVoice: async (roomId, inviteeUserId) => {
    const call = createOutboundCall(roomId, inviteeUserId)
    if (!call) {
      toast('Не удалось создать звонок', 'error')
      return
    }
    set({ activeCall: call, isVideo: false, status: 'connecting', micMuted: false, videoMuted: false })
    attachListeners(call, set)
    try {
      await call.placeVoiceCall()
      playOutgoingRingback()
    } catch (err) {
      stopRingtone()
      toast(err instanceof Error ? err.message : 'Не удалось начать звонок', 'error')
      set({ activeCall: null, status: 'idle' })
    }
  },

  startVideo: async (roomId, inviteeUserId) => {
    const call = createOutboundCall(roomId, inviteeUserId)
    if (!call) {
      toast('Не удалось создать видеозвонок', 'error')
      return
    }
    set({ activeCall: call, isVideo: true, status: 'connecting', micMuted: false, videoMuted: false })
    attachListeners(call, set)
    try {
      await call.placeVideoCall()
      playOutgoingRingback()
    } catch (err) {
      stopRingtone()
      toast(err instanceof Error ? err.message : 'Не удалось начать звонок', 'error')
      set({ activeCall: null, status: 'idle' })
    }
  },

  acceptIncoming: async (call, withVideo) => {
    set({ activeCall: call, isVideo: withVideo, status: 'connecting', micMuted: false, videoMuted: false })
    attachListeners(call, set)
    try {
      await call.answer(true, withVideo)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось принять звонок', 'error')
      set({ activeCall: null, status: 'idle' })
    }
  },

  end: () => {
    const call = get().activeCall
    if (!call) return
    stopRingtone()
    try {
      call.hangup('user_hangup' as never, false)
    } catch { /* already ended */ }
    set({ status: 'ended' })
    setTimeout(() => {
      set({ activeCall: null, status: 'idle' })
    }, 1500)
  },

  toggleMic: () => {
    const call = get().activeCall
    if (!call) return
    const next = !get().micMuted
    set({ micMuted: next })
    try { call.setMicrophoneMuted(next) } catch { /* ignore */ }
  },

  toggleVideo: () => {
    const call = get().activeCall
    if (!call) return
    const next = !get().videoMuted
    set({ videoMuted: next })
    try { call.setLocalVideoMuted(next) } catch { /* ignore */ }
  },
}))
