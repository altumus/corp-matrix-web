import { useCallback, useState } from 'react'
import { sendFileMessage } from '../services/mediaService.js'
import type { UploadProgress } from '../types.js'

export function useMediaUpload(roomId: string) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const upload = useCallback(
    async (file: File) => {
      setUploading(true)
      setProgress({ loaded: 0, total: file.size, percentage: 0 })

      try {
        await sendFileMessage(roomId, file, setProgress)
      } finally {
        setUploading(false)
        setProgress(null)
      }
    },
    [roomId],
  )

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        await upload(file)
      }
    },
    [upload],
  )

  return { uploading, progress, upload, uploadFiles }
}
