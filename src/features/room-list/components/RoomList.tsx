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
  const isSearching = searchQuery.trim().length > 0

  return (
    <div className={styles.container}>
      <RoomListHeader />
      <RoomSearch />
      {!isSearching && (
        <>
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
