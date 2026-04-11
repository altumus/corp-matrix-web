import { useCallback, useState } from 'react'
import { sendFileMessage } from '../services/mediaService.js'
import type { UploadProgress } from '../types.js'

export function useMediaUpload(roomId: string) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const upload = useCallback(
    async (file: File, caption?: string) => {
      setUploading(true)
      setProgress({ loaded: 0, total: file.size, percentage: 0 })

      try {
        await sendFileMessage(roomId, file, setProgress, caption)
      } finally {
        setUploading(false)
        setProgress(null)
      }
    },
    [roomId],
  )

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const failed: File[] = []
      for (const file of Array.from(files)) {
        try {
          await upload(file)
        } catch {
          failed.push(file)
        }
      }
      if (failed.length > 0) {
        const { toast } = await import('../../../shared/ui/Toast/toastService.js')
        toast(`${failed.length} файлов не удалось отправить`, 'error')
      }
    },
    [upload],
  )

  return { uploading, progress, upload, uploadFiles }
}
