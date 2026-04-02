import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';
import { useSpaces } from '../hooks/useSpaces.js';
import { Avatar } from '../../../shared/ui/index.js';
import { CreateSpaceDialog } from './CreateSpaceDialog.js';
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

			<a
				className={styles.item}
				href='https://github.com/altumus/corp-matrix-web'
				target='_blank'
				rel='noreferrer'
				title='GitHub'
			>
				<svg
					width='20'
					height='20'
					viewBox='0 0 24 24'
					fill='currentColor'
					className={styles.homeIcon}
				>
					<path d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z' />
				</svg>
			</a>

			{showCreate && <CreateSpaceDialog onClose={() => setShowCreate(false)} />}
		</div>
	);
}

export { ARCHIVE_ID };

