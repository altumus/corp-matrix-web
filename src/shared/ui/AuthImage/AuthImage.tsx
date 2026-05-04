import { type ImgHTMLAttributes } from 'react'
import { useAuthenticatedMedia } from '../../hooks/useAuthenticatedMedia.js'
import { Spinner } from '../Spinner/Spinner.js'

interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  mxcUrl: string | null | undefined
}

export function AuthImage({ mxcUrl, alt, className, style, width, height, ...rest }: AuthImageProps) {
  const src = useAuthenticatedMedia(mxcUrl)

  // Always render the same wrapper element so swapping from "loading" to
  // "loaded" doesn't replace one DOM node with another — the swap was a
  // visible flicker, especially when many images load in the same frame
  // after the timeline mounts. The <img> stays mounted with the same
  // dimensions; the spinner sits on top until `src` is ready, then fades
  // out without disturbing layout.
  return (
    <span
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-block',
        background: src ? undefined : 'var(--color-bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          {...rest}
        />
      )}
      {!src && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size={20} />
        </span>
      )}
    </span>
  )
}
