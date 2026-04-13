import styles from './MessageBubble.module.scss';

interface ReplyPreviewProps {
  sender: string;
  body: string;
  onNavigate: () => void;
}

export function ReplyPreview({ sender, body, onNavigate }: ReplyPreviewProps) {
  return (
    <div
      className={styles.replyQuote}
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onNavigate();
      }}
    >
      <span className={styles.replyQuoteSender}>{sender}</span>
      <span className={styles.replyQuoteBody}>{body}</span>
    </div>
  );
}
