import { getMatrixClient } from '../../../shared/lib/matrixClient.js';
import { sanitizeHtml } from '../../../shared/lib/sanitizeHtml.js';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { RoomMessageEventContent, ReactionEventContent } from 'matrix-js-sdk/lib/@types/events.js';
import type { SendMessageOptions } from '../types.js';

function markdownToHtml(text: string): string | null {
	// Only generate HTML if text contains markdown syntax
	if (!/[`*~>]/.test(text)) return null;

	let html = text;
	// Code blocks (must be first — protect content inside)
	html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	// Bold
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	// Italic (single *)
	html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
	// Strikethrough
	html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
	// Blockquote
	html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
	// Newlines (but not inside pre)
	html = html.replace(/\n/g, '<br />');
	// Fix: remove <br /> inside <pre>
	html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_match, code: string) => {
		return `<pre><code>${code.replace(/<br \/>/g, '\n')}</code></pre>`;
	});

	// If nothing changed, no markdown was present
	if (html === text.replace(/\n/g, '<br />')) return null;

	return html;
}

interface TextMessagePayload {
	body: string;
	msgtype: MsgType;
	format?: string;
	formatted_body?: string;
	'm.relates_to'?: {
		'm.in_reply_to'?: { event_id: string };
		rel_type?: RelationType;
		event_id?: string;
	};
}

export async function sendTextMessage(opts: SendMessageOptions): Promise<void> {
	const client = getMatrixClient();
	if (!client) throw new Error('Client not initialized');

	const content: TextMessagePayload = {
		msgtype: MsgType.Text,
		body: opts.body,
	};

	if (opts.formattedBody) {
		content.format = 'org.matrix.custom.html';
		content.formatted_body = opts.formattedBody;
	} else {
		const formatted = markdownToHtml(opts.body);
		if (formatted) {
			content.format = 'org.matrix.custom.html';
			content.formatted_body = formatted;
		}
	}

	if (opts.replyToEventId) {
		content['m.relates_to'] = {
			'm.in_reply_to': {
				event_id: opts.replyToEventId,
			},
		};
	}

	if (opts.threadRootId) {
		content['m.relates_to'] = {
			...(content['m.relates_to'] || {}),
			rel_type: RelationType.Thread,
			event_id: opts.threadRootId,
		};
	}

	if (opts.roomMention) {
		(content as unknown as Record<string, unknown>)['m.mentions'] = { room: true };
	}

	await client.sendMessage(opts.roomId, content as unknown as RoomMessageEventContent);
}

interface EditMessagePayload {
	body: string;
	msgtype: MsgType;
	'm.new_content': { msgtype: MsgType; body: string };
	'm.relates_to': { rel_type: RelationType.Replace; event_id: string };
}

export async function editMessage(
	roomId: string,
	eventId: string,
	newBody: string,
): Promise<void> {
	const client = getMatrixClient();
	if (!client) throw new Error('Client not initialized');

	const content: EditMessagePayload = {
		msgtype: MsgType.Text,
		body: `* ${newBody}`,
		'm.new_content': {
			msgtype: MsgType.Text,
			body: newBody,
		},
		'm.relates_to': {
			rel_type: RelationType.Replace,
			event_id: eventId,
		},
	};

	await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
}

export async function redactMessage(
	roomId: string,
	eventId: string,
	reason?: string,
): Promise<void> {
	const client = getMatrixClient();
	if (!client) throw new Error('Client not initialized');

	await client.redactEvent(
		roomId,
		eventId,
		undefined,
		reason ? { reason } : undefined,
	);
}

export async function sendReaction(
	roomId: string,
	eventId: string,
	key: string,
): Promise<void> {
	const client = getMatrixClient();
	if (!client) throw new Error('Client not initialized');

	const myUserId = client.getUserId()!;
	const room = client.getRoom(roomId);

	if (room) {
		try {
			const timelineSet = room.getUnfilteredTimelineSet();
			const relations = timelineSet.relations.getChildEventsForEvent(
				eventId,
				RelationType.Annotation,
				EventType.Reaction,
			);
			if (relations) {
				for (const relEvent of relations.getRelations()) {
					if (relEvent.getSender() !== myUserId) continue;
					const relKey = relEvent.getContent()?.['m.relates_to']?.key;
					if (relKey === key) {
						await client.redactEvent(roomId, relEvent.getId()!);
						return;
					}
				}
			}
		} catch {
			// fallback
		}

		try {
			const tlEvents = room.getLiveTimeline().getEvents();
			for (const ev of tlEvents) {
				if (ev.getType() !== EventType.Reaction) continue;
				if (ev.getSender() !== myUserId) continue;
				if (ev.isRedacted()) continue;
				const rel = ev.getContent()?.['m.relates_to'];
				if (rel?.event_id === eventId && rel?.key === key) {
					await client.redactEvent(roomId, ev.getId()!);
					return;
				}
			}
		} catch {
			// timeline access failed
		}
	}

	const reactionContent: ReactionEventContent = {
		'm.relates_to': {
			rel_type: RelationType.Annotation,
			event_id: eventId,
			key,
		},
	};
	await client.sendEvent(roomId, EventType.Reaction, reactionContent);
}

export async function forwardMessage(
	fromRoomId: string,
	eventId: string,
	toRoomId: string,
): Promise<void> {
	const client = getMatrixClient();
	if (!client) throw new Error('Client not initialized');

	const room = client.getRoom(fromRoomId);
	if (!room) throw new Error('Room not found');

	const matrixEvent = room.findEventById(eventId);
	if (!matrixEvent) throw new Error('Event not found');

	const originalContent = matrixEvent.getContent();
	const senderId = matrixEvent.getSender()!;
	const senderMember = room.getMember(senderId);
	const senderName = senderMember?.name || senderId || 'Unknown';

	const msgtype = (originalContent.msgtype as MsgType) || MsgType.Text;
	const body = (originalContent.body as string) || '';

	const esc = (s: string) =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	const messageLink = `https://matrix.to/#/${encodeURIComponent(fromRoomId)}/${encodeURIComponent(eventId)}`;

	const content: Record<string, unknown> = {
		msgtype,
		body: `Переслано от ${senderName} (${messageLink}):\n${body}`,
		format: 'org.matrix.custom.html',
		formatted_body:
			`<a href="${messageLink}"><strong>Переслано от ${esc(senderName)}</strong></a><br/>` +
			(originalContent.formatted_body ? sanitizeHtml(originalContent.formatted_body as string) : esc(body)),
	};

	if (originalContent.url) {
		content.url = originalContent.url;
	}
	if (originalContent.info) {
		content.info = originalContent.info;
	}
	if (originalContent.file) {
		content.file = originalContent.file;
	}

	await client.sendMessage(toRoomId, content as unknown as RoomMessageEventContent);
}

export async function sendTypingIndicator(
	roomId: string,
	typing: boolean,
): Promise<void> {
	const client = getMatrixClient();
	if (!client) return;

	await client.sendTyping(roomId, typing, typing ? 30000 : 0);
}

