import { type ImgHTMLAttributes } from 'react'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia.js'
import { Spinner } from '../Spinner/Spinner.js'

interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  mxcUrl: string | null | undefined
}

export function AuthImage({ mxcUrl, alt, className, style, width, height, ...rest }: AuthImageProps) {
  const src = useAuthenticatedMedia(mxcUrl)

  if (!src) {
    return (
      <div className={className} style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-tertiary)',
        borderRadius: 'var(--radius-md)',
      }}>
        <Spinner size={20} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      {...rest}
    />
  )
}
