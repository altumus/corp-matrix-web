import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { SearchResult } from '../hooks/useMessageSearch.js'
import styles from './SearchResults.module.scss'

interface SearchResultsProps {
  results: SearchResult[]
  query: string
}

export function SearchResults({ results, query }: SearchResultsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!query) return null

  if (results.length === 0) {
    return <div className={styles.empty}>{t('search.noResults')}</div>
  }

  return (
    <div className={styles.list}>
      {results.map((result) => (
        <button
          key={result.eventId}
          className={styles.item}
          onClick={() => navigate(`/rooms/${encodeURIComponent(result.roomId)}`)}
        >
          <div className={styles.meta}>
            <span className={styles.room}>{result.roomName}</span>
            <span className={styles.sender}>{result.senderName}</span>
            <time className={styles.time}>
              {new Date(result.timestamp).toLocaleDateString()}
            </time>
          </div>
          <p className={styles.body}>{highlightText(result.body, query)}</p>
        </button>
      ))}
    </div>
  )
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className={styles.highlight}>{part}</mark>
    ) : (
      part
    ),
  )
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
