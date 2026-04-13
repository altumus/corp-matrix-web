import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from '../../../shared/hooks/useDebounce.js'
import { useMessageSearch } from '../hooks/useMessageSearch.js'
import { useUserSearch } from '../hooks/useUserSearch.js'
import { SearchResults } from './SearchResults.js'
import { UserSearch } from './UserSearch.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './SearchPanel.module.scss'

type SearchTab = 'messages' | 'users'

export function SearchPanel() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<SearchTab>('messages')
  const debouncedQuery = useDebounce(query, 400)

  const messageSearch = useMessageSearch()
  const userSearch = useUserSearch()
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (!debouncedQuery.trim()) return
    if (tab === 'messages') {
      messageSearch.search(debouncedQuery)
    } else {
      userSearch.search(debouncedQuery)
    }
  }, [debouncedQuery, tab])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      if (tab === 'messages') {
        messageSearch.search(query.trim())
      } else {
        userSearch.search(query.trim())
      }
    }
  }

  const isLoading = tab === 'messages' ? messageSearch.loading : userSearch.loading

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('search.title')}</h2>
        <input
          className={styles.input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          autoFocus
          autoComplete="off"
        />
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'messages' ? styles.active : ''}`}
            onClick={() => setTab('messages')}
          >
            {t('search.messages')}
          </button>
          <button
            className={`${styles.tab} ${tab === 'users' ? styles.active : ''}`}
            onClick={() => setTab('users')}
          >
            {t('search.users')}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}><Spinner /></div>
        ) : tab === 'messages' ? (
          <SearchResults results={messageSearch.results} query={debouncedQuery} />
        ) : (
          <UserSearch users={userSearch.users} />
        )}
      </div>
    </div>
  )
}
