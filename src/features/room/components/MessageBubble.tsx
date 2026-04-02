import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { TimelineEvent } from '../types.js';
import { Avatar, AuthImage } from '../../../shared/ui/index.js';
import {
	MessageContextMenu,
	type ContextMenuAction,
	type ReceiptEntry,
} from '../../messaging/components/MessageContextMenu.js';
import { EmojiPicker } from '../../messaging/components/EmojiPicker.js';
import { ForwardDialog } from '../../messaging/components/ForwardDialog.js';
import { useComposerStore } from '../../messaging/store/composerStore.js';
import { useRoomListStore } from '../../room-list/store/roomListStore.js';
import { useTimelineScroll } from '../context/TimelineScrollContext.js';
import { getMatrixClient } from '../../../shared/lib/matrixClient.js';
import {
	redactMessage,
	sendReaction,
} from '../../messaging/services/messageService.js';
import { editMessage } from '../../messaging/services/messageService.js';
import { useSelectionStore } from '../../messaging/store/selectionStore.js';
import { ReadReceipts } from './ReadReceipts.js';
import { PollMessage } from './PollMessage.js';
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
	const [showForwardDialog, setShowForwardDialog] = useState(false);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const setReplyTarget = useComposerStore((s) => s.setReplyTarget);
	const setSelectedRoom = useRoomListStore((s) => s.setSelectedRoom);
	const selecting = useSelectionStore((s) => s.selecting);
	const selectedIds = useSelectionStore((s) => s.selectedIds);
	const toggleSelection = useSelectionStore((s) => s.toggle);
	const startSelecting = useSelectionStore((s) => s.startSelecting);
	const scrollToEvent = useTimelineScroll();
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

	const client = getMatrixClient();
	const myUserId = client?.getUserId();
	const isOwnMessage = event.sender === myUserId;

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		const selection = window.getSelection();
		const selectedText = selection?.toString().trim() || '';
		setContextMenu({ x: e.clientX, y: e.clientY, selectedText });
	}, []);

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
					const newBody = prompt(t('messages.edit'), bodyText);
					if (newBody && newBody !== bodyText) {
						editMessage(event.roomId, event.eventId, newBody);
					}
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
				id: 'select',
				icon: <CheckSquare size={16} />,
				label: t('messages.select'),
				onClick: () => {
					setContextMenu(null);
					startSelecting(event.eventId);
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
	}, [contextMenu?.selectedText, event, isOwnMessage, setReplyTarget, startSelecting, t]);

	const receipts = useMemo<ReceiptEntry[]>(() => {
		if (!contextMenu) return [];
		const c = getMatrixClient();
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
	}, [contextMenu, event.roomId, event.eventId, myUserId]);

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

	const content = event.content;
	const msgtype = content.msgtype as string;
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

	return (
		<div
			className={messageCls}
			onContextMenu={selecting ? undefined : handleContextMenu}
			onClick={handleMessageClick}
		>
			{selecting && (
				<div className={styles.checkbox}>
					<input type='checkbox' checked={isSelected} readOnly />
				</div>
			)}
			{!isOwnMessage && showAvatar ? (
				<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
			) : !isOwnMessage ? (
				<div className={styles.avatarPlaceholder} />
			) : null}

			<div
				ref={bubbleRef}
				className={`${styles.bubble} ${isHighlighted ? styles.highlighted : ''}`}
			>
				{!isOwnMessage && showAvatar && (
					<span className={styles.sender}>{event.senderName}</span>
				)}

				{event.replyToEvent && event.replyTo && (
					<div
						className={styles.replyQuote}
						onClick={() => scrollToEvent(event.replyTo!)}
						role='button'
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === 'Enter') scrollToEvent(event.replyTo!);
						}}
					>
						<span className={styles.replyQuoteSender}>
							{event.replyToEvent.sender}
						</span>
						<span className={styles.replyQuoteBody}>
							{event.replyToEvent.body}
						</span>
					</div>
				)}

				<div className={styles.content}>
					{msgtype === 'm.image' &&
						(() => {
							const info = content.info as
								| { w?: number; h?: number }
								| undefined;
							const w = info?.w || 300;
							const h = info?.h || 200;
							const maxW = 400;
							const maxH = 300;
							const scale = Math.min(1, maxW / w, maxH / h);
							const displayW = Math.round(w * scale);
							const displayH = Math.round(h * scale);
							return (
								<AuthImage
									mxcUrl={content.url as string}
									alt={body}
									className={styles.imageMessage}
									loading='lazy'
									width={displayW}
									height={displayH}
									style={{ width: displayW, height: displayH }}
								/>
							);
						})()}
					{msgtype === 'm.video' &&
						(() => {
							const info = content.info as
								| { w?: number; h?: number }
								| undefined;
							const w = info?.w || 300;
							const h = info?.h || 200;
							const maxW = 400;
							const maxH = 300;
							const scale = Math.min(1, maxW / w, maxH / h);
							const displayW = Math.round(w * scale);
							const displayH = Math.round(h * scale);
							return (
								<AuthImage
									mxcUrl={content.url as string}
									alt={body}
									className={styles.imageMessage}
									width={displayW}
									height={displayH}
									style={{ width: displayW, height: displayH }}
								/>
							);
						})()}
					{msgtype === 'm.file' && (
						<div className={styles.fileMessage}>
							📎 <span>{body}</span>
						</div>
					)}
					{msgtype === 'm.audio' && (
						<div className={styles.audioMessage}>
							🎤 <span>Голосовое сообщение</span>
						</div>
					)}
					{(() => {
						const isPoll = event.type === 'org.matrix.msc3381.poll.start'
							|| event.type === 'm.poll.start'
							|| !!content['org.matrix.msc3381.poll']
							|| !!content['m.poll']
							|| !!content['org.matrix.msc3381.poll.start']
							|| !!content['m.poll.start'];
						return isPoll ? <PollMessage eventId={event.eventId} roomId={event.roomId} content={content} /> : null;
					})()}
					{(() => {
						const isPoll = !!content['org.matrix.msc3381.poll']
							|| !!content['m.poll']
							|| !!content['org.matrix.msc3381.poll.start']
							|| !!content['m.poll.start']
							|| event.type === 'org.matrix.msc3381.poll.start'
							|| event.type === 'm.poll.start';
						return !isPoll && (msgtype === 'm.text' || msgtype === 'm.notice' || !msgtype);
					})() &&
						(formattedBody ? (
							<div
								className={styles.textContent}
								dangerouslySetInnerHTML={{ __html: formattedBody }}
							/>
						) : (
							<p className={styles.textContent}>{body}</p>
						))}
					{event.isEdited && <span className={styles.edited}>(изм.)</span>}
				</div>

				<span className={styles.meta}>
					{event.isEdited && <span className={styles.editedMeta}>изм.</span>}
					{timeEl}
				</span>

				{event.reactions.size > 0 && (
					<div className={styles.reactions}>
						{[...event.reactions.entries()].map(([key, senders]) => {
							const myReaction = myUserId ? senders.has(myUserId) : false;
							return (
								<button
									key={key}
									className={`${styles.reaction} ${myReaction ? styles.reactionMine : ''}`}
									onClick={() => sendReaction(event.roomId, event.eventId, key)}
									title={[...senders].join(', ')}
								>
									{key} <span>{senders.size}</span>
								</button>
							);
						})}
					</div>
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
				/>
			)}

			{showForwardDialog && (
				<ForwardDialog
					fromRoomId={event.roomId}
					eventId={event.eventId}
					onClose={() => setShowForwardDialog(false)}
				/>
			)}

			{showReactionPicker && (
				<EmojiPicker
					anchorRef={bubbleRef}
					onSelect={(emoji) => {
						sendReaction(event.roomId, event.eventId, emoji);
					}}
					onClose={() => setShowReactionPicker(false)}
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

