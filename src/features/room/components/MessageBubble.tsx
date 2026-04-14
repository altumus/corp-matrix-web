import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
	Reply,
	Quote,
	Pencil,
	Copy,
	Link,
	Forward,
	Smile,
	Trash2,
	CheckSquare,
	MessageSquare,
	Pin,
} from 'lucide-react';
import type { TimelineEvent } from '../types.js';
import { Avatar } from '../../../shared/ui/index.js';
import { UserProfilePopup } from './UserProfilePopup.js';
import {
	MessageContextMenu,
	type ContextMenuAction,
	type ReceiptEntry,
} from '../../messaging/components/MessageContextMenu.js';
import { MessageContent } from './MessageContent.js';
import { ReactionBar } from './ReactionBar.js';
import { ReplyPreview } from './ReplyPreview.js';
// Lazy-load heavy emoji-mart bundle (~500kb)
const EmojiPicker = lazy(() =>
  import('../../messaging/components/EmojiPicker.js').then((m) => ({ default: m.EmojiPicker })),
);
import { ForwardDialog } from '../../messaging/components/ForwardDialog.js';
import { useComposerStore } from '../../messaging/store/composerStore.js';
import { useRoomListStore } from '../../room-list/store/roomListStore.js';
import { useTimelineScroll } from '../context/TimelineScrollContext.js';
import { useMatrixClient } from '../../../shared/contexts/MatrixClientContext.js';
import {
	redactMessage,
	sendReaction,
} from '../../messaging/services/messageService.js';
import { useSelectionStore } from '../../messaging/store/selectionStore.js';
import { useRightPanel } from '../context/RightPanelContext.js';
import { ReactionDetailsDialog } from './ReactionDetailsDialog.js';
import type { MediaType } from '../../media/components/Lightbox.js';

// Lazy-load heavy Lightbox — only loads when user clicks media
const Lightbox = lazy(() =>
  import('../../media/components/Lightbox.js').then((m) => ({ default: m.Lightbox })),
);
import { ReadReceipts } from './ReadReceipts.js';
import { useLongPress } from '../../../shared/hooks/useLongPress.js';
import styles from './MessageBubble.module.scss';

interface MessageBubbleProps {
	event: TimelineEvent;
	showAvatar: boolean;
	isHighlighted?: boolean;
}

export function MessageBubble({
	event,
	showAvatar,
	isHighlighted,
}: MessageBubbleProps) {
	const { t } = useTranslation();
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		selectedText: string;
	} | null>(null);
	const [showReactionPicker, setShowReactionPicker] = useState(false);
	const [profilePopup, setProfilePopup] = useState<DOMRect | null>(null);
	const [showForwardDialog, setShowForwardDialog] = useState(false);
	const [showReactionDetails, setShowReactionDetails] = useState(false);
	const [optimisticReactions, setOptimisticReactions] = useState<Map<string, Set<string>> | null>(null);
	const [lightbox, setLightbox] = useState<{
		mxcUrl: string;
		filename: string;
		mediaType: MediaType;
	} | null>(null);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const setReplyTarget = useComposerStore((s) => s.setReplyTarget);
	const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom);
	const { openThread } = useRightPanel();
	const selecting = useSelectionStore((s) => s.selecting);
	const selectedIds = useSelectionStore((s) => s.selectedIds);
	const toggleSelection = useSelectionStore((s) => s.toggle);
	const startSelecting = useSelectionStore((s) => s.startSelecting);
	const { scrollToEvent } = useTimelineScroll();
	const navigate = useNavigate();
	const isSelected = selectedIds.has(event.eventId);

	useEffect(() => {
		const el = bubbleRef.current;
		if (!el) return;

		const handleLinkClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const anchor = target.closest('a');
			if (!anchor) return;

			const rawHref = anchor.getAttribute('href') || '';
			if (!rawHref.includes('matrix.to')) return;

			let href: string;
			try {
				href = decodeURIComponent(rawHref);
			} catch {
				href = rawHref;
			}

			const eventMatch = href.match(/matrix\.to\/#\/([^/]+)\/(\$[^?\s]+)/);
			if (eventMatch) {
				e.preventDefault();
				e.stopPropagation();
				const targetRoomId = eventMatch[1];
				const evId = eventMatch[2];

				if (targetRoomId === event.roomId) {
					scrollToEvent(evId);
				} else {
					setSelectedRoom(targetRoomId);
					navigate(
						`/rooms/${encodeURIComponent(targetRoomId)}?eventId=${encodeURIComponent(evId)}`,
					);
				}
				return;
			}

			const roomMatch = href.match(/matrix\.to\/#\/([^/\s]+)/);
			if (roomMatch) {
				e.preventDefault();
				e.stopPropagation();
				const targetRoomId = roomMatch[1];
				if (targetRoomId.startsWith('!') || targetRoomId.startsWith('#')) {
					setSelectedRoom(targetRoomId);
					navigate(`/rooms/${encodeURIComponent(targetRoomId)}`);
				}
			}
		};

		el.addEventListener('click', handleLinkClick, true);
		return () => el.removeEventListener('click', handleLinkClick, true);
	}, [navigate, scrollToEvent, setSelectedRoom, event.roomId]);

	// Swipe-right-to-reply on mobile
	useEffect(() => {
		const el = bubbleRef.current;
		if (!el) return;
		if (event.isRedacted) return;

		let startX = 0;
		let startY = 0;
		let moved = false;
		let currentDx = 0;

		const onTouchStart = (e: TouchEvent) => {
			const t = e.touches[0];
			if (!t) return;
			startX = t.clientX;
			startY = t.clientY;
			moved = false;
			currentDx = 0;
		};

		const onTouchMove = (e: TouchEvent) => {
			const t = e.touches[0];
			if (!t) return;
			const dx = t.clientX - startX;
			const dy = Math.abs(t.clientY - startY);
			// Only horizontal right swipes, ignore vertical scroll
			if (dx > 10 && dy < 30) {
				moved = true;
				currentDx = Math.min(dx, 100);
				el.style.transform = `translateX(${currentDx}px)`;
				el.style.transition = 'none';
			}
		};

		const onTouchEnd = () => {
			if (moved && currentDx > 60) {
				const bodyText = (event.content?.body as string) || '';
				setReplyTarget({
					eventId: event.eventId,
					sender: event.senderName,
					body: bodyText,
				});
			}
			// Animate back
			el.style.transition = 'transform 200ms ease';
			el.style.transform = 'translateX(0)';
			currentDx = 0;
			moved = false;
		};

		el.addEventListener('touchstart', onTouchStart, { passive: true });
		el.addEventListener('touchmove', onTouchMove, { passive: true });
		el.addEventListener('touchend', onTouchEnd);
		el.addEventListener('touchcancel', onTouchEnd);

		return () => {
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('touchmove', onTouchMove);
			el.removeEventListener('touchend', onTouchEnd);
			el.removeEventListener('touchcancel', onTouchEnd);
		};
	}, [event.eventId, event.senderName, event.content, event.isRedacted, setReplyTarget]);

	const client = useMatrixClient();
	const myUserId = client?.getUserId();
	const isOwnMessage = event.sender === myUserId;

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		const selection = window.getSelection();
		const selectedText = selection?.toString().trim() || '';
		setContextMenu({ x: e.clientX, y: e.clientY, selectedText });
	}, []);

	const longPressHandlers = useLongPress({
		onLongPress: useCallback((e: React.TouchEvent) => {
			const touch = e.touches[0];
			if (touch) {
				setContextMenu({ x: touch.clientX, y: touch.clientY, selectedText: '' });
			}
		}, []),
	});

	const isMentioned = useMemo(() => {
		if (event.isRedacted) return false;
		if (!myUserId || event.sender === myUserId) return false;
		const html = ((event.content.formatted_body as string) || '').replace(
			/<mx-reply>[\s\S]*?<\/mx-reply>/,
			'',
		);
		if (html.includes(`matrix.to/#/${encodeURIComponent(myUserId)}`))
			return true;
		if (html.includes(`matrix.to/#/${myUserId}`)) return true;
		return false;
	}, [event.content.formatted_body, event.sender, event.isRedacted, myUserId]);

	const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
		const selectedText = contextMenu?.selectedText || '';
		const bodyText = (event.content.body as string) || '';

		const actions: ContextMenuAction[] = [
			{
				id: 'reply',
				icon: <Reply size={16} />,
				label: t('messages.reply'),
				onClick: () => {
					setReplyTarget({
						eventId: event.eventId,
						sender: event.senderName,
						body: bodyText,
					});
				},
			},
			{
				id: 'reply-quote',
				icon: <Quote size={16} />,
				label: t('messages.replyWithQuote'),
				hidden: !selectedText,
				onClick: () => {
					setReplyTarget({
						eventId: event.eventId,
						sender: event.senderName,
						body: bodyText,
						quotedText: selectedText,
					});
				},
			},
			{
				id: 'edit',
				icon: <Pencil size={16} />,
				label: t('messages.edit'),
				hidden: !isOwnMessage,
				onClick: () => {
					setContextMenu(null);
					useComposerStore.getState().setEditTarget({
						eventId: event.eventId,
						body: bodyText,
					});
				},
			},
			{
				id: 'copy',
				icon: <Copy size={16} />,
				label: t('messages.copyText'),
				onClick: () => {
					const textToCopy = selectedText || bodyText;
					navigator.clipboard.writeText(textToCopy);
				},
			},
			{
				id: 'copy-link',
				icon: <Link size={16} />,
				label: t('messages.copyLink'),
				onClick: () => {
					const link = `https://matrix.to/#/${encodeURIComponent(event.roomId)}/${encodeURIComponent(event.eventId)}`;
					navigator.clipboard.writeText(link);
				},
			},
			{
				id: 'forward',
				icon: <Forward size={16} />,
				label: t('messages.forward'),
				onClick: () => {
					setContextMenu(null);
					setShowForwardDialog(true);
				},
			},
			{
				id: 'thread',
				icon: <MessageSquare size={16} />,
				label: t('messages.thread'),
				onClick: () => {
					setContextMenu(null);
					openThread(event.eventId);
				},
			},
			{
				id: 'select',
				icon: <CheckSquare size={16} />,
				label: t('messages.select'),
				onClick: () => {
					setContextMenu(null);
					startSelecting(event.eventId);
				},
			},
			{
				id: 'pin',
				icon: <Pin size={16} />,
				label: (() => {
					const room = client?.getRoom(event.roomId);
					const pinEvent = room?.currentState.getStateEvents('m.room.pinned_events', '');
					const pinned = (pinEvent?.getContent()?.pinned as string[]) || [];
					return pinned.includes(event.eventId)
						? t('messages.unpin', { defaultValue: 'Открепить' })
						: t('messages.pin', { defaultValue: 'Закрепить' });
				})(),
				onClick: () => {
					const room = client?.getRoom(event.roomId);
					if (!client || !room) return;
					const pinEvent = room.currentState.getStateEvents('m.room.pinned_events', '');
					const pinned = [...((pinEvent?.getContent()?.pinned as string[]) || [])];
					const idx = pinned.indexOf(event.eventId);
					if (idx >= 0) {
						pinned.splice(idx, 1);
					} else {
						pinned.push(event.eventId);
					}
					client.sendStateEvent(event.roomId, 'm.room.pinned_events' as any, { pinned } as any, '').catch(() => {});
				},
			},
			{
				id: 'react',
				icon: <Smile size={16} />,
				label: t('messages.react'),
				onClick: () => {
					setContextMenu(null);
					setShowReactionPicker(true);
				},
			},
			{
				id: 'remove',
				icon: <Trash2 size={16} />,
				label: t('messages.remove'),
				danger: true,
				hidden: !isOwnMessage,
				onClick: () => {
					if (confirm(t('messages.remove') + '?')) {
						redactMessage(event.roomId, event.eventId);
					}
				},
			},
		];

		return actions;
	}, [contextMenu?.selectedText, event, isOwnMessage, setReplyTarget, startSelecting, openThread, t]);

	const receipts = useMemo<ReceiptEntry[]>(() => {
		if (!contextMenu) return [];
		const c = client;
		if (!c) return [];
		const room = c.getRoom(event.roomId);
		if (!room) return [];

		const members = room.getJoinedMembers();
		const result: ReceiptEntry[] = [];

		for (const member of members) {
			if (member.userId === myUserId) continue;
			if (room.hasUserReadEvent(member.userId, event.eventId)) {
				const receipt = room.getLastUnthreadedReceiptFor(member.userId);
				result.push({
					userId: member.userId,
					name: member.name || member.userId,
					avatarUrl: member.getMxcAvatarUrl() ?? null,
					ts: receipt?.ts ?? 0,
				});
			}
		}

		return result.sort((a, b) => b.ts - a.ts);
	}, [contextMenu, event.roomId, event.eventId, myUserId, client]);

	const displayReactions = optimisticReactions ?? event.reactions;

	// Clear optimistic state when fresh server reactions arrive
	// NOTE: must be called before early returns to satisfy React's rules of hooks
	useEffect(() => {
		setOptimisticReactions(null);
	}, [event.reactions]);

	const timeEl = (
		<time
			className={styles.time}
			dateTime={new Date(event.timestamp).toISOString()}
		>
			{formatTime(event.timestamp)}
		</time>
	);

	if (event.isRedacted) {
		return (
			<div
				className={`${styles.message} ${isOwnMessage ? styles.outgoing : styles.incoming}`}
			>
				{!isOwnMessage && showAvatar && (
					<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
				)}
				{!isOwnMessage && !showAvatar && (
					<div className={styles.avatarPlaceholder} />
				)}
				<div className={styles.bubble}>
					<span className={styles.redacted}>Сообщение удалено</span>
					{timeEl}
				</div>
			</div>
		);
	}

	if (event.isDecryptionFailure) {
		return (
			<div
				className={`${styles.message} ${isOwnMessage ? styles.outgoing : styles.incoming}`}
			>
				{!isOwnMessage && showAvatar && (
					<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
				)}
				{!isOwnMessage && !showAvatar && (
					<div className={styles.avatarPlaceholder} />
				)}
				<div className={styles.bubble}>
					<span className={styles.decryptionError}>
						{t('encryption.unableToDecrypt', { defaultValue: 'Не удалось расшифровать сообщение. Настройте резервное копирование ключей в настройках.' })}
					</span>
					{timeEl}
				</div>
			</div>
		);
	}

	const content = event.content;
	const rawBody = (content.body as string) || '';
	const body = event.replyTo ? stripReplyFallback(rawBody) : rawBody;
	const rawFormatted = content.formatted_body as string | undefined;
	const formattedBody =
		event.replyTo && rawFormatted
			? stripHtmlReplyFallback(rawFormatted)
			: rawFormatted;

	const messageCls = [
		styles.message,
		isOwnMessage ? styles.outgoing : styles.incoming,
		isMentioned ? styles.mentioned : '',
		selecting ? styles.selectMode : '',
		isSelected ? styles.selected : '',
	]
		.filter(Boolean)
		.join(' ');

	const handleMessageClick = () => {
		if (selecting) {
			toggleSelection(event.eventId);
		}
	};

	const handleReactionClick = (key: string) => {
		const current = new Map(displayReactions);
		const senders = new Set(current.get(key) || []);
		if (myUserId && senders.has(myUserId)) {
			senders.delete(myUserId);
			if (senders.size === 0) current.delete(key);
			else current.set(key, senders);
		} else if (myUserId) {
			senders.add(myUserId);
			current.set(key, senders);
		}
		setOptimisticReactions(current);
		// Don't clear on .finally() — wait for server event to arrive via useEffect above
		sendReaction(event.roomId, event.eventId, key).catch(() => {
			// On error, revert to server state
			setOptimisticReactions(null);
		});
	};

	return (
		<div
			className={messageCls}
			onContextMenu={selecting ? undefined : handleContextMenu}
			onClick={handleMessageClick}
			{...longPressHandlers}
		>
			{selecting && (
				<div className={styles.checkbox}>
					<input type='checkbox' checked={isSelected} readOnly />
				</div>
			)}
			{!isOwnMessage && showAvatar ? (
				<button
					className={styles.avatarClickable}
					onClick={(e) => setProfilePopup(e.currentTarget.getBoundingClientRect())}
					aria-label={event.senderName}
				>
					<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
				</button>
			) : !isOwnMessage ? (
				<div className={styles.avatarPlaceholder} />
			) : null}

			<div
				ref={bubbleRef}
				className={`${styles.bubble} ${isHighlighted ? styles.highlighted : ''}`}
			>
				{!isOwnMessage && showAvatar && (
					<button
						className={styles.senderClickable}
						onClick={(e) => setProfilePopup(e.currentTarget.getBoundingClientRect())}
					>
						{event.senderName}
					</button>
				)}

				{event.replyToEvent && event.replyTo && (
					<ReplyPreview
						sender={event.replyToEvent.sender}
						body={event.replyToEvent.body}
						onNavigate={() => scrollToEvent(event.replyTo!)}
					/>
				)}

				<MessageContent
					content={content}
					eventType={event.type}
					eventId={event.eventId}
					roomId={event.roomId}
					body={body}
					formattedBody={formattedBody}
					isEdited={event.isEdited}
					onLightbox={setLightbox}
				/>

				<span className={styles.meta}>
					{event.isEdited && <span className={styles.editedMeta}>изм.</span>}
					{timeEl}
				</span>

				<ReactionBar
					reactions={displayReactions}
					myUserId={myUserId ?? null}
					onReactionClick={handleReactionClick}
					onShowDetails={() => setShowReactionDetails(true)}
				/>
				{(event.threadReplyCount ?? 0) > 0 && (
					<button
						className={styles.threadBadge}
						onClick={() => openThread(event.eventId)}
					>
						<MessageSquare size={14} />
						<span>{t('messages.threadReplies', { count: event.threadReplyCount })}</span>
					</button>
				)}
			</div>

			{isOwnMessage && (
				<div className={styles.receiptsWrap}>
					<ReadReceipts eventId={event.eventId} roomId={event.roomId} />
				</div>
			)}

			{contextMenu && (
				<MessageContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					actions={contextMenuActions}
					receipts={receipts}
					onClose={() => setContextMenu(null)}
					onQuickReact={(emoji) => {
						setContextMenu(null)
						sendReaction(event.roomId, event.eventId, emoji)
					}}
				/>
			)}

			{showForwardDialog && (
				<ForwardDialog
					fromRoomId={event.roomId}
					eventId={event.eventId}
					onClose={() => setShowForwardDialog(false)}
				/>
			)}

			{showReactionDetails && (
				<ReactionDetailsDialog
					roomId={event.roomId}
					reactions={event.reactions}
					onClose={() => setShowReactionDetails(false)}
				/>
			)}

			{showReactionPicker && (
				<Suspense fallback={null}>
					<EmojiPicker
						anchorRef={bubbleRef}
						onSelect={(emoji) => {
							sendReaction(event.roomId, event.eventId, emoji);
						}}
						onClose={() => setShowReactionPicker(false)}
					/>
				</Suspense>
			)}
		{lightbox && (
				<Suspense fallback={null}>
					<Lightbox
						mxcUrl={lightbox.mxcUrl}
						filename={lightbox.filename}
						mediaType={lightbox.mediaType}
						onClose={() => setLightbox(null)}
					/>
				</Suspense>
			)}
			{profilePopup && (
				<UserProfilePopup
					userId={event.sender}
					roomId={event.roomId}
					onClose={() => setProfilePopup(null)}
					anchorRect={profilePopup}
				/>
			)}
		</div>
	);
}

function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function stripReplyFallback(body: string): string {
	const lines = body.split('\n');
	let i = 0;
	while (i < lines.length && lines[i].startsWith('> ')) i++;
	if (i > 0 && i < lines.length && lines[i] === '') i++;
	return lines.slice(i).join('\n');
}

function stripHtmlReplyFallback(html: string): string {
	return html.replace(/^<mx-reply>[\s\S]*?<\/mx-reply>/, '');
}

