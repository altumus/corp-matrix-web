import type { ImgHTMLAttributes } from 'react'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia.js'

interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  mxcUrl: string | null | undefined
}

export function AuthImage({ mxcUrl, alt, ...rest }: AuthImageProps) {
  const src = useAuthenticatedMedia(mxcUrl)

  if (!src) return null

  return <img src={src} alt={alt} {...rest} />
}
