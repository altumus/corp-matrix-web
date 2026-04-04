import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Bell, Info } from 'lucide-react';
import { useSpaces } from '../hooks/useSpaces.js';
import { Avatar } from '../../../shared/ui/index.js';
import { CreateSpaceDialog } from './CreateSpaceDialog.js';
import { requestNotificationPermission } from '../../notifications/services/notificationService.js';
import styles from './SpacesSidebar.module.scss';

const ARCHIVE_ID = '__archive__';

export function SpacesSidebar() {
	const { t } = useTranslation();
	const { spaces, activeSpaceId, setActiveSpace } = useSpaces();
	const [showCreate, setShowCreate] = useState(false);

	return (
		<div className={styles.sidebar}>
			<button
				className={`${styles.item} ${activeSpaceId === null ? styles.active : ''}`}
				onClick={() => setActiveSpace(null)}
				title={t('spaces.home')}
			>
				<div className={styles.homeIcon}>⌂</div>
			</button>

			<div className={styles.divider} />

			{spaces.map((space) => (
				<button
					key={space.roomId}
					className={`${styles.item} ${activeSpaceId === space.roomId ? styles.active : ''}`}
					onClick={() => setActiveSpace(space.roomId)}
					title={space.name}
				>
					<Avatar src={space.avatarUrl} name={space.name} size='sm' />
				</button>
			))}

			<button
				className={styles.addBtn}
				onClick={() => setShowCreate(true)}
				title={t('spaces.create')}
			>
				+
			</button>

			<div className={styles.spacer} />

			<button
				className={`${styles.item} ${activeSpaceId === ARCHIVE_ID ? styles.active : ''}`}
				onClick={() =>
					setActiveSpace(activeSpaceId === ARCHIVE_ID ? null : ARCHIVE_ID)
				}
				title={t('rooms.archive')}
			>
				<Archive size={20} className={styles.homeIcon} />
			</button>

			<button
				className={styles.item}
				onClick={async () => {
					const granted = await requestNotificationPermission();
					if (!granted) return;

					const options: NotificationOptions = {
						body: 'Уведомления работают корректно!',
						icon: '/corp-logo.png',
						tag: 'test',
					};

					if ('serviceWorker' in navigator) {
						const reg = await navigator.serviceWorker.ready;
						await reg.showNotification('Corp Matrix', options);
					} else {
						new Notification('Corp Matrix', options);
					}
				}}
				title='Тест уведомлений'
			>
				<Bell size={20} className={styles.homeIcon} />
			</button>

			<a
				className={styles.item}
				href='https://github.com/altumus/corp-matrix-web'
				target='_blank'
				rel='noreferrer'
				title='About / GitHub'
			>
				<Info size={20} className={styles.homeIcon} />
			</a>

			{showCreate && <CreateSpaceDialog onClose={() => setShowCreate(false)} />}
		</div>
	);
}

export { ARCHIVE_ID };

