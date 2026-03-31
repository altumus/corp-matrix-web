import 'matrix-js-sdk'

declare module 'matrix-js-sdk' {
  interface RoomAccountDataEvents {
    'corp.notification_level': {
      level: string
    }
  }
}
