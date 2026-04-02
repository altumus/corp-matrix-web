import { useState, type ImgHTMLAttributes } from 'react'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia.js'
import { Spinner } from '../Spinner/Spinner.js'

interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  mxcUrl: string | null | undefined
}

export function AuthImage({ mxcUrl, alt, className, style, width, height, ...rest }: AuthImageProps) {
  const src = useAuthenticatedMedia(mxcUrl)
  const [loaded, setLoaded] = useState(false)

  const placeholderStyle = {
    ...style,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-tertiary)',
    borderRadius: 'var(--radius-md)',
  }

  if (!src) {
    return (
      <div className={className} style={placeholderStyle}>
        <Spinner size={20} />
      </div>
    )
  }

  return (
    <>
      {!loaded && (
        <div className={className} style={placeholderStyle}>
          <Spinner size={20} />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, display: loaded ? undefined : 'none' }}
        width={width}
        height={height}
        onLoad={() => setLoaded(true)}
        {...rest}
      />
    </>
  )
}
