import { Outlet, useLocation } from 'react-router'
import { SpacesSidebar } from '../../features/spaces/components/SpacesSidebar.js'
import { RoomList } from '../../features/room-list/components/RoomList.js'
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner.js'
import { CryptoBanner } from '../../shared/ui/CryptoBanner/CryptoBanner.js'
import { useNotifications } from '../../features/notifications/hooks/useNotifications.js'
import { useIncomingVerification } from '../../features/encryption/hooks/useIncomingVerification.js'
import { IncomingVerificationDialog } from '../../features/encryption/components/IncomingVerificationDialog.js'
import { useIsMobile } from '../../shared/hooks/useMediaQuery.js'
import { useIdleLogout } from '../../shared/hooks/useIdleLogout.js'
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts.js'
import { useEffect } from 'react'
import { useComposerStore } from '../../features/messaging/store/composerStore.js'
import { ErrorBoundary } from '../../shared/ui/index.js'
import styles from './MainLayout.module.scss'

export function MainLayout() {
  useNotifications()
  useIdleLogout()
  useKeyboardShortcuts()

  // Cleanup stale drafts once after layout mounts
  const cleanupStaleDrafts = useComposerStore((s) => s.cleanupStaleDrafts)
  useEffect(() => {
    const timer = setTimeout(cleanupStaleDrafts, 5000)
    return () => clearTimeout(timer)
  }, [cleanupStaleDrafts])
  const { request: verificationRequest, dismiss: dismissVerification } = useIncomingVerification()
  const isMobile = useIsMobile()
  const location = useLocation()
  const isInRoom = /^\/rooms\/[^/]+/.test(location.pathname)
  const isInSettings = location.pathname.startsWith('/settings')
  const showFullContent = isInRoom || isInSettings

  const showRoomList = !isMobile || !showFullContent
  const showContent = !isMobile || showFullContent

  return (
    <div className={styles.layout}>
      <ConnectionBanner />
      <CryptoBanner />
      <div className={styles.main}>
        {!isMobile && <SpacesSidebar />}
        {showRoomList && (
          <aside className={`${styles.sidebar} ${isMobile ? styles.sidebarMobile : ''}`}>
            <RoomList />
          </aside>
        )}
        {showContent && (
          <main className={`${styles.content} ${isMobile ? styles.contentMobile : ''}`}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
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
