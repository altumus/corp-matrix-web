import { create } from 'zustand'
import {
  GroupCall,
  GroupCallEvent,
  GroupCallIntent,
  GroupCallState,
  GroupCallType,
} from 'matrix-js-sdk'
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed.js'
import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { toast } from '../../../shared/ui/Toast/toastService.js'

export type GroupCallStatus = 'idle' | 'joining' | 'joined' | 'error'

export interface Participant {
  userId: string
  deviceId?: string
  name: string
  avatarUrl: string | null
  audioMuted: boolean
  videoMuted: boolean
  speaking: boolean
  stream: MediaStream | null
}

interface GroupCallStore {
  groupCall: GroupCall | null
  status: GroupCallStatus
  participants: Participant[]
  localStream: MediaStream | null
  micMuted: boolean
  videoMuted: boolean
  screenSharing: boolean
  error: string | null

  startGroupCall: (roomId: string, type: 'voice' | 'video') => Promise<void>
  joinGroupCall: (groupCall: GroupCall, withVideo: boolean) => Promise<void>
  leave: () => void
  toggleMic: () => void
  toggleVideo: () => void
  toggleScreenShare: () => Promise<void>
}

function updateParticipants(groupCall: GroupCall): Participant[] {
  const feeds: CallFeed[] = [...(groupCall.userMediaFeeds || [])]
  return feeds.map((feed) => ({
    userId: feed.userId,
    deviceId: (feed as any).deviceId || undefined,
    name: feed.getMember()?.name || feed.userId,
    avatarUrl: feed.getMember()?.getMxcAvatarUrl() ?? null,
    audioMuted: feed.isAudioMuted(),
    videoMuted: feed.isVideoMuted(),
    speaking: feed.isSpeaking(),
    stream: feed.stream,
  }))
}

const attachedGroupCalls = new WeakSet<GroupCall>()

function attachGroupCallListeners(
  groupCall: GroupCall,
  set: (s: Partial<GroupCallStore>) => void,
) {
  if (attachedGroupCalls.has(groupCall)) return
  attachedGroupCalls.add(groupCall)
  groupCall.on(GroupCallEvent.ParticipantsChanged, () => {
    set({ participants: updateParticipants(groupCall) })
  })

  groupCall.on(GroupCallEvent.UserMediaFeedsChanged, () => {
    set({ participants: updateParticipants(groupCall) })
  })

  groupCall.on(GroupCallEvent.LocalMuteStateChanged, (audioMuted: boolean, videoMuted: boolean) => {
    set({ micMuted: audioMuted, videoMuted })
  })

  groupCall.on(GroupCallEvent.GroupCallStateChanged, (newState: GroupCallState) => {
    if (newState === GroupCallState.Entered) {
      set({ status: 'joined' })
    } else if (newState === GroupCallState.Ended) {
      set({
        status: 'idle',
        groupCall: null,
        participants: [],
        localStream: null,
        micMuted: false,
        videoMuted: false,
        screenSharing: false,
        error: null,
      })
    }
  })

  groupCall.on(GroupCallEvent.Error, (err: Error) => {
    toast(`Ошибка группового звонка: ${err.message}`, 'error')
    set({ status: 'error', error: err.message })
  })
}

export const useGroupCallStore = create<GroupCallStore>((set, get) => ({
  groupCall: null,
  status: 'idle',
  participants: [],
  localStream: null,
  micMuted: false,
  videoMuted: false,
  screenSharing: false,
  error: null,

  startGroupCall: async (roomId, type) => {
    const client = getMatrixClient()
    if (!client) {
      toast('Matrix-клиент не инициализирован', 'error')
      return
    }

    const room = client.getRoom(roomId)
    if (!room) {
      toast('Комната не найдена', 'error')
      return
    }

    set({ status: 'joining', error: null })

    try {
      const groupCall = new GroupCall(
        client,
        room,
        type === 'video' ? GroupCallType.Video : GroupCallType.Voice,
        false,
        GroupCallIntent.Prompt,
      )

      attachGroupCallListeners(groupCall, set)
      set({ groupCall })

      await groupCall.create()
      await groupCall.enter()

      set({
        status: 'joined',
        participants: updateParticipants(groupCall),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось начать групповой звонок'
      toast(message, 'error')
      set({ status: 'error', error: message, groupCall: null })
    }
  },

  joinGroupCall: async (groupCall, _withVideo) => {
    set({ status: 'joining', error: null, groupCall })

    try {
      attachGroupCallListeners(groupCall, set)
      await groupCall.enter()

      set({
        status: 'joined',
        participants: updateParticipants(groupCall),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось присоединиться к звонку'
      toast(message, 'error')
      set({ status: 'error', error: message, groupCall: null })
    }
  },

  leave: () => {
    const { groupCall } = get()
    if (groupCall) {
      try {
        groupCall.leave()
      } catch {
        /* already left */
      }
    }
    set({
      status: 'idle',
      groupCall: null,
      participants: [],
      localStream: null,
      micMuted: false,
      videoMuted: false,
      screenSharing: false,
      error: null,
    })
  },

  toggleMic: () => {
    const { groupCall, micMuted } = get()
    if (!groupCall) return
    const next = !micMuted
    groupCall.setMicrophoneMuted(next)
    set({ micMuted: next })
  },

  toggleVideo: () => {
    const { groupCall, videoMuted } = get()
    if (!groupCall) return
    const next = !videoMuted
    groupCall.setLocalVideoMuted(next)
    set({ videoMuted: next })
  },

  toggleScreenShare: async () => {
    const { groupCall, screenSharing } = get()
    if (!groupCall) return

    try {
      await groupCall.setScreensharingEnabled(!screenSharing)
      set({ screenSharing: !screenSharing })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось включить демонстрацию экрана'
      toast(message, 'error')
    }
  },
}))
