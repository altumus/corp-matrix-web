import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.scss'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <span className={styles.icon}>&#x26A0;</span>
            <h2 className={styles.title}>Что-то пошло не так</h2>
            <p className={styles.description}>
              Произошла непредвиденная ошибка. Попробуйте перезагрузить.
            </p>
            <button className={styles.button} onClick={this.handleReload}>
              Попробовать снова
            </button>
            <button
              className={styles.reloadButton}
              onClick={() => window.location.reload()}
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
