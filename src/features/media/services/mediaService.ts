import { getMatrixClient } from '../../../shared/lib/matrixClient.js'
import { MsgType } from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events.js'
import type { ImageInfo } from 'matrix-js-sdk/lib/@types/media.js'
import type { UploadProgress } from '../types.js'

export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const response = await client.uploadContent(file, {
    progressHandler: (progress: { loaded: number; total: number }) => {
      onProgress?.({
        loaded: progress.loaded,
        total: progress.total,
        percentage: Math.round((progress.loaded / progress.total) * 100),
      })
    },
  })

  return response.content_uri
}

export async function sendFileMessage(
  roomId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  caption?: string,
): Promise<void> {
  const client = getMatrixClient()
  if (!client) throw new Error('Client not initialized')

  const mxcUrl = await uploadFile(file, onProgress)

  const msgtype: MsgType = file.type.startsWith('image/')
    ? MsgType.Image
    : file.type.startsWith('video/')
      ? MsgType.Video
      : file.type.startsWith('audio/')
        ? MsgType.Audio
        : MsgType.File

  interface MediaMessagePayload {
    msgtype: MsgType
    body: string
    url: string
    info: ImageInfo
  }

  const info: ImageInfo = {
    mimetype: file.type,
    size: file.size,
  }

  if (msgtype === MsgType.Image) {
    const dimensions = await getImageDimensions(file)
    if (dimensions) {
      info.w = dimensions.width
      info.h = dimensions.height
    }

    const thumbnailUrl = await generateThumbnail(file)
    if (thumbnailUrl) {
      const thumbMxc = await uploadFile(dataUrlToFile(thumbnailUrl, `thumb_${file.name}`))
      info.thumbnail_url = thumbMxc
    }
  }

  const content: MediaMessagePayload = {
    msgtype,
    body: caption || file.name,
    url: mxcUrl,
    info,
  }

  if (caption) {
    (content as unknown as Record<string, unknown>).filename = file.name
  }

  await client.sendMessage(roomId, content as unknown as RoomMessageEventContent)
}

function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

function generateThumbnail(file: File, maxSize = 320): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}
