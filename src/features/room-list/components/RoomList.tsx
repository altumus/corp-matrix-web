import { Virtuoso } from 'react-virtuoso'
import { useTranslation } from 'react-i18next'
import { useRoomList } from '../hooks/useRoomList.js'
import { useRoomListStore } from '../store/roomListStore.js'
import { RoomListHeader } from './RoomListHeader.js'
import { RoomSearch } from './RoomSearch.js'
import { RoomListItem } from './RoomListItem.js'
import { InvitesList } from './InvitesList.js'
import { Spinner } from '../../../shared/ui/index.js'
import styles from './RoomList.module.scss'

export function RoomList() {
  const { t } = useTranslation()
  const { rooms, invites } = useRoomList()
  const searchQuery = useRoomListStore((s) => s.searchQuery)
  const initialLoading = useRoomListStore((s) => s.initialLoading)
  const activeTab = useRoomListStore((s) => s.activeTab)
  const setActiveTab = useRoomListStore((s) => s.setActiveTab)
  const isSearching = searchQuery.trim().length > 0

  return (
    <div className={styles.container}>
      <RoomListHeader />
      <RoomSearch />
      {!isSearching && (
        <>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              {t('rooms.tabAll', { defaultValue: 'Все' })}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'unread' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              {t('rooms.tabUnread', { defaultValue: 'Непрочитанные' })}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'dms' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('dms')}
            >
              {t('rooms.tabDms', { defaultValue: 'Личные' })}
            </button>
          </div>
          <InvitesList invites={invites} />
          <div className={styles.list}>
            {initialLoading ? (
              <div className={styles.loading}>
                <Spinner size={24} />
              </div>
            ) : rooms.length === 0 ? (
              <div className={styles.empty}>{t('rooms.empty')}</div>
            ) : (
              <Virtuoso
                data={rooms}
                itemContent={(_index, room) => (
                  <RoomListItem key={room.roomId} room={room} />
                )}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
