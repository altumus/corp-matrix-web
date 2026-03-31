export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface MediaInfo {
  url: string
  mimeType: string
  size: number
  name: string
  width?: number
  height?: number
  thumbnailUrl?: string
}
