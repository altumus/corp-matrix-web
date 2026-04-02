import { Outlet } from 'react-router'
import { SpacesSidebar } from '../../features/spaces/components/SpacesSidebar.js'
import { RoomList } from '../../features/room-list/components/RoomList.js'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner.js'
import styles from './MainLayout.module.scss'

export function MainLayout() {
  return (
    <div className={styles.layout}>
      <ConnectionBanner />
      <div className={styles.main}>
        <SpacesSidebar />
        <aside className={styles.sidebar}>
          <RoomList />
        </aside>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
