import { Outlet } from 'react-router'
import { SpacesSidebar } from '../../features/spaces/components/SpacesSidebar.js'
import { RoomList } from '../../features/room-list/components/RoomList.js'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner.js'
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js'
import { useIncomingVerification } from '../../features/encryption/hooks/useIncomingVerification.js'
import { IncomingVerificationDialog } from '../../features/encryption/components/IncomingVerificationDialog.js'
import { useIsMobile } from '../../shared/hooks/useMediaQuery.js'
import { useMobileNavStore } from '../../shared/stores/mobileNavStore.js'
import styles from './MainLayout.module.scss'

export function MainLayout() {
  useNotifications()
  const { request: verificationRequest, dismiss: dismissVerification } = useIncomingVerification()
  const isMobile = useIsMobile()
  const activeView = useMobileNavStore((s) => s.activeView)

  const showRoomList = !isMobile || activeView === 'rooms'
  const showContent = !isMobile || activeView === 'chat'

  return (
    <div className={styles.layout}>
      <ConnectionBanner />
      <div className={styles.main}>
        {!isMobile && <SpacesSidebar />}
        {showRoomList && (
          <aside className={`${styles.sidebar} ${isMobile ? styles.sidebarMobile : ''}`}>
            <RoomList />
          </aside>
        )}
        {showContent && (
          <main className={`${styles.content} ${isMobile ? styles.contentMobile : ''}`}>
            <Outlet />
          </main>
        )}
      </div>

      {verificationRequest && (
        <IncomingVerificationDialog
          request={verificationRequest}
          onClose={dismissVerification}
        />
      )}
    </div>
  )
}
