import { sanitizeHtml } from '../../../shared/lib/sanitizeHtml.js';
import { AuthImage } from '../../../shared/ui/index.js';
import { PollMessage } from './PollMessage.js';
import type { MediaType } from '../../media/components/Lightbox.js';
import styles from './MessageBubble.module.scss';

interface MessageContentProps {
  content: Record<string, unknown>;
  eventType: string;
  eventId: string;
  roomId: string;
  body: string;
  formattedBody: string | undefined;
  isEdited: boolean;
  onLightbox: (info: { mxcUrl: string; filename: string; mediaType: MediaType }) => void;
}

export function MessageContent({
  content,
  eventType,
  eventId,
  roomId,
  body,
  formattedBody,
  isEdited,
  onLightbox,
}: MessageContentProps) {
  const msgtype = content.msgtype as string;

  return (
    <div className={styles.content}>
      {msgtype === 'm.image' &&
        (() => {
          const info = content.info as { w?: number; h?: number } | undefined;
          const w = info?.w || 300;
          const h = info?.h || 200;
          const maxW = 400;
          const maxH = 300;
          const scale = Math.min(1, maxW / w, maxH / h);
          const displayW = Math.round(w * scale);
          const displayH = Math.round(h * scale);
          return (
            <div
              onClick={() =>
                onLightbox({
                  mxcUrl: content.url as string,
                  filename: body || 'image',
                  mediaType: 'image',
                })
              }
            >
              <AuthImage
                mxcUrl={content.url as string}
                alt={body}
                className={styles.imageMessage}
                loading="lazy"
                width={displayW}
                height={displayH}
                style={{ width: displayW, height: displayH }}
              />
            </div>
          );
        })()}
      {msgtype === 'm.video' &&
        (() => {
          const info = content.info as { w?: number; h?: number } | undefined;
          const w = info?.w || 300;
          const h = info?.h || 200;
          const maxW = 400;
          const maxH = 300;
          const scale = Math.min(1, maxW / w, maxH / h);
          const displayW = Math.round(w * scale);
          const displayH = Math.round(h * scale);
          return (
            <div
              onClick={() =>
                onLightbox({
                  mxcUrl: content.url as string,
                  filename: body || 'video',
                  mediaType: 'video',
                })
              }
            >
              <AuthImage
                mxcUrl={content.url as string}
                alt={body}
                className={styles.imageMessage}
                width={displayW}
                height={displayH}
                style={{ width: displayW, height: displayH }}
              />
            </div>
          );
        })()}
      {msgtype === 'm.file' && (
        <div
          className={styles.fileMessage}
          onClick={() =>
            onLightbox({
              mxcUrl: content.url as string,
              filename: body || 'file',
              mediaType: 'file',
            })
          }
        >
          📎 <span>{body}</span>
        </div>
      )}
      {msgtype === 'm.audio' && (
        <div
          className={styles.audioMessage}
          onClick={() =>
            onLightbox({
              mxcUrl: content.url as string,
              filename: body || 'audio',
              mediaType: 'audio',
            })
          }
        >
          🎤 <span>Голосовое сообщение</span>
        </div>
      )}
      {(() => {
        const isPoll =
          eventType === 'org.matrix.msc3381.poll.start' ||
          eventType === 'm.poll.start' ||
          !!content['org.matrix.msc3381.poll'] ||
          !!content['m.poll'] ||
          !!content['org.matrix.msc3381.poll.start'] ||
          !!content['m.poll.start'];
        return isPoll ? (
          <PollMessage eventId={eventId} roomId={roomId} content={content} />
        ) : null;
      })()}
      {(() => {
        const isPoll =
          !!content['org.matrix.msc3381.poll'] ||
          !!content['m.poll'] ||
          !!content['org.matrix.msc3381.poll.start'] ||
          !!content['m.poll.start'] ||
          eventType === 'org.matrix.msc3381.poll.start' ||
          eventType === 'm.poll.start';
        return (
          !isPoll && (msgtype === 'm.text' || msgtype === 'm.notice' || !msgtype)
        );
      })() &&
        (formattedBody ? (
          <div
            className={styles.textContent}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(formattedBody) }}
          />
        ) : (
          <div
            className={styles.textContent}
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(
                body
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br />')
              ),
            }}
          />
        ))}
      {isEdited && <span className={styles.edited}>(изм.)</span>}
    </div>
  );
}
