import { Outlet } from 'react-router'
import { SpacesSidebar } from '../../features/spaces/components/SpacesSidebar.js'
import { RoomList } from '../../features/room-list/components/RoomList.js'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner.js'
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js'
import { useIncomingVerification } from '../../features/encryption/hooks/useIncomingVerification.js'
import { IncomingVerificationDialog } from '../../features/encryption/components/IncomingVerificationDialog.js'
import styles from './MainLayout.module.scss'

export function MainLayout() {
  useNotifications()
  const { request: verificationRequest, dismiss: dismissVerification } = useIncomingVerification()

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

      {verificationRequest && (
        <IncomingVerificationDialog
          request={verificationRequest}
          onClose={dismissVerification}
        />
      )}
    </div>
  )
}
