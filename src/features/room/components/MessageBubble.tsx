import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types.js';
import { Avatar, AuthImage } from '../../../shared/ui/index.js';
import {
	MessageContextMenu,
	type ContextMenuAction,
	type ReceiptEntry,
} from '../../messaging/components/MessageContextMenu.js';
import { useComposerStore } from '../../messaging/store/composerStore.js';
import { useTimelineScroll } from '../context/TimelineScrollContext.js';
import { getMatrixClient } from '../../../shared/lib/matrixClient.js';
import {
	redactMessage,
	sendReaction,
} from '../../messaging/services/messageService.js';
import { editMessage } from '../../messaging/services/messageService.js';
import styles from './MessageBubble.module.scss';

interface MessageBubbleProps {
	event: TimelineEvent;
	showAvatar: boolean;
}

export function MessageBubble({ event, showAvatar }: MessageBubbleProps) {
	const { t } = useTranslation();
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		selectedText: string;
	} | null>(null);
	const setReplyTarget = useComposerStore((s) => s.setReplyTarget);
	const scrollToEvent = useTimelineScroll();

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
				icon: '↩',
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
				icon: '❝',
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
				icon: '✎',
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
				icon: '⧉',
				label: t('messages.copyText'),
				onClick: () => {
					const textToCopy = selectedText || bodyText;
					navigator.clipboard.writeText(textToCopy);
				},
			},
			{
				id: 'copy-link',
				icon: '🔗',
				label: t('messages.copyLink'),
				onClick: () => {
					const link = `https://matrix.to/#/${encodeURIComponent(event.roomId)}/${encodeURIComponent(event.eventId)}`;
					navigator.clipboard.writeText(link);
				},
			},
			{
				id: 'react',
				icon: '😀',
				label: t('messages.react'),
				onClick: () => {
					const emoji = prompt('Emoji:');
					if (emoji) sendReaction(event.roomId, event.eventId, emoji);
				},
			},
			{
				id: 'remove',
				icon: '🗑',
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
	}, [contextMenu?.selectedText, event, isOwnMessage, setReplyTarget, t]);

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

	if (event.isRedacted) {
		return (
			<div className={styles.message}>
				{showAvatar && (
					<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
				)}
				{!showAvatar && <div className={styles.avatarPlaceholder} />}
				<div className={styles.body}>
					<span className={styles.redacted}>Сообщение удалено</span>
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

	const messageCls = [styles.message, isMentioned ? styles.mentioned : '']
		.filter(Boolean)
		.join(' ');

	return (
		<div className={messageCls} onContextMenu={handleContextMenu}>
			{showAvatar ? (
				<Avatar src={event.senderAvatar} name={event.senderName} size='sm' />
			) : (
				<div className={styles.avatarPlaceholder} />
			)}

			<div className={styles.body}>
				{showAvatar && (
					<div className={styles.header}>
						<span className={styles.sender}>{event.senderName}</span>
						<time
							className={styles.time}
							dateTime={new Date(event.timestamp).toISOString()}
						>
							{formatTime(event.timestamp)}
						</time>
					</div>
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
					{msgtype === 'm.image' && (
						<AuthImage
							mxcUrl={content.url as string}
							alt={body}
							className={styles.imageMessage}
							loading='lazy'
						/>
					)}
					{msgtype === 'm.video' && (
						<AuthImage
							mxcUrl={content.url as string}
							alt={body}
							className={styles.imageMessage}
						/>
					)}
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
					{(msgtype === 'm.text' || msgtype === 'm.notice' || !msgtype) &&
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

				{event.reactions.size > 0 && (
					<div className={styles.reactions}>
						{[...event.reactions.entries()].map(([key, senders]) => (
							<button key={key} className={styles.reaction}>
								{key} <span>{senders.size}</span>
							</button>
						))}
					</div>
				)}
			</div>

			{contextMenu && (
				<MessageContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					actions={contextMenuActions}
					receipts={receipts}
					onClose={() => setContextMenu(null)}
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

