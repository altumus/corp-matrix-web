import { useRouteError, isRouteErrorResponse, Link } from 'react-router'

/**
 * Default error boundary for the router. Catches both 404s (no matched route)
 * and unexpected exceptions thrown inside route components, so React Router's
 * built-in fallback no longer logs to console.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()

  let title = 'Что-то пошло не так'
  let detail = 'Попробуйте обновить страницу или вернуться на главную.'

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Страница не найдена'
      detail = 'Запрошенный адрес не существует.'
    } else {
      title = `Ошибка ${error.status}`
      detail = error.statusText || detail
    }
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '24px',
        textAlign: 'center',
        gap: '16px',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>{title}</h1>
      <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px' }}>{detail}</p>
      <Link
        to="/rooms"
        style={{
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent)',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        На главную
      </Link>
    </div>
  )
}
