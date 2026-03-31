import { useTranslation } from 'react-i18next'
import { useRoomSearch } from '../hooks/useRoomSearch.js'
import styles from './RoomSearch.module.scss'

export function RoomSearch() {
  const { t } = useTranslation()
  const { searchQuery, setSearchQuery } = useRoomSearch()

  return (
    <div className={styles.search}>
      <input
        className={styles.input}
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('rooms.search')}
      />
    </div>
  )
}
