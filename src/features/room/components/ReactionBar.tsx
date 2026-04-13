import styles from './MessageBubble.module.scss';

interface ReactionBarProps {
  reactions: Map<string, Set<string>>;
  myUserId: string | null;
  onReactionClick: (key: string) => void;
  onShowDetails: () => void;
}

export function ReactionBar({
  reactions,
  myUserId,
  onReactionClick,
  onShowDetails,
}: ReactionBarProps) {
  if (reactions.size === 0) return null;

  return (
    <div className={styles.reactions}>
      {[...reactions.entries()].map(([key, senders]) => {
        const myReaction = myUserId ? senders.has(myUserId) : false;
        return (
          <button
            key={key}
            className={`${styles.reaction} ${myReaction ? styles.reactionMine : ''}`}
            onClick={() => onReactionClick(key)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShowDetails();
            }}
            title={[...senders].join(', ')}
          >
            {key} <span>{senders.size}</span>
          </button>
        );
      })}
    </div>
  );
}
