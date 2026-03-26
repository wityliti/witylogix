"use client";

import { useMemo, useCallback, useRef, useEffect, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/use-collaboration";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  onReply?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onPin?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onThreadOpen?: (messageId: string) => void;
}

interface GroupedMessage {
  userId: string;
  userName: string;
  avatar?: string;
  messages: Message[];
  timestamp: Date;
}

function groupMessagesBySender(messages: Message[]): (GroupedMessage | Message)[] {
  const grouped: (GroupedMessage | Message)[] = [];

  for (const message of messages) {
    if (message.isSystem) {
      grouped.push(message);
      continue;
    }

    const lastGroup = grouped[grouped.length - 1];
    const isSameSender =
      !("isSystem" in lastGroup) &&
      lastGroup &&
      "userId" in lastGroup &&
      lastGroup.userId === message.userId &&
      new Date(message.createdAt).getTime() -
        new Date(lastGroup.timestamp).getTime() <
        5 * 60 * 1000; // 5 min window

    if (isSameSender && "messages" in lastGroup) {
      lastGroup.messages.push(message);
      lastGroup.timestamp = message.createdAt;
    } else {
      grouped.push({
        userId: message.userId,
        userName: message.userName,
        avatar: message.avatar,
        messages: [message],
        timestamp: message.createdAt,
      });
    }
  }

  return grouped;
}

function formatTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (msgDate.getTime() === today.getTime()) {
    return timeStr;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${timeStr}`;
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) {
    return "Today";
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return msgDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: msgDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface ReactionBarProps {
  reactions?: Record<string, string[]>;
  onReact?: (emoji: string) => void;
}

function ReactionBar({ reactions = {}, onReact }: ReactionBarProps) {
  if (Object.keys(reactions).length === 0) return null;

  const emojis = Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {emojis.map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact?.(emoji)}
          title={`Reacted by: ${users.join(", ")}`}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
            "bg-wl-bg-overlay border border-wl-border-subtle",
            "hover:bg-wl-bg-surface hover:border-wl-border-default",
            "transition-colors duration-fast ease-default"
          )}
        >
          <span>{emoji}</span>
          <span className="text-wl-text-secondary">{users.length}</span>
        </button>
      ))}
      <button
        onClick={() => onReact?.("➕")}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-full text-xs",
          "bg-transparent border border-wl-border-subtle",
          "hover:bg-wl-bg-overlay hover:border-wl-border-default",
          "text-wl-text-secondary hover:text-wl-text-primary",
          "transition-colors duration-fast ease-default"
        )}
      >
        +
      </button>
    </div>
  );
}

function MessageItem({
  message,
  isOwn,
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  onThreadOpen,
}: {
  message: Message;
  isOwn: boolean;
  onReply?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onPin?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onThreadOpen?: (messageId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group px-4 py-2 hover:bg-wl-bg-overlay transition-colors duration-fast"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {message.avatar && (
          <img
            src={message.avatar}
            alt={message.userName}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-wl-text-primary">
              {message.userName}
            </span>
            <span className="text-xs text-wl-text-tertiary">
              {formatTime(message.createdAt)}
            </span>
            {message.pinned && (
              <span className="text-xs text-wl-warning-400">📌 Pinned</span>
            )}
          </div>

          <p className="text-sm text-wl-text-primary mt-1 break-words">
            {message.content}
          </p>

          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded",
                    "bg-wl-bg-surface border border-wl-border-default",
                    "text-xs text-wl-primary-400 hover:text-wl-primary-300",
                    "hover:border-wl-primary-500/30"
                  )}
                >
                  📎 {att.name}
                </a>
              ))}
            </div>
          )}

          <ReactionBar
            reactions={message.reactions}
            onReact={(emoji) => onReact?.(message.id, emoji)}
          />
        </div>

        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            <MessageAction icon="💬" title="Reply" onClick={() => onReply?.(message.id)} />
            <MessageAction icon="😊" title="React" onClick={() => onReact?.(message.id, "👍")} />
            <MessageAction icon="📌" title="Pin" onClick={() => onPin?.(message.id)} />
            {isOwn && (
              <>
                <MessageAction icon="✏️" title="Edit" onClick={() => onEdit?.(message.id, message.content)} />
                <MessageAction icon="🗑️" title="Delete" onClick={() => onDelete?.(message.id)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageAction({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1 rounded text-sm hover:bg-wl-bg-surface",
        "text-wl-text-secondary hover:text-wl-text-primary",
        "transition-colors duration-fast ease-default"
      )}
    >
      {icon}
    </button>
  );
}

function SystemMessage({ message }: { message: Message }) {
  return (
    <div className="px-4 py-3 flex items-center justify-center">
      <span className="text-xs text-wl-text-tertiary italic">
        {message.content}
      </span>
    </div>
  );
}

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="px-4 py-4 flex items-center justify-center gap-3">
      <div className="flex-1 h-px bg-wl-border-subtle" />
      <span className="text-xs text-wl-text-tertiary uppercase tracking-wide font-medium">
        {formatDate(date)}
      </span>
      <div className="flex-1 h-px bg-wl-border-subtle" />
    </div>
  );
}

export function MessageList({
  messages,
  currentUserId,
  isLoadingOlder,
  onLoadOlder,
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  onThreadOpen,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const grouped = useMemo(() => groupMessagesBySender(messages), [messages]);

  const itemsWithDates = useMemo(() => {
    const result: (GroupedMessage | Message | { type: "date"; date: Date })[] = [];
    let lastDate: Date | null = null;

    for (const item of grouped) {
      const itemDate = new Date(
        "messages" in item ? item.timestamp : item.createdAt
      );
      const itemDateStr = itemDate.toDateString();
      const lastDateStr = lastDate?.toDateString();

      if (itemDateStr !== lastDateStr) {
        result.push({ type: "date", date: itemDate });
        lastDate = itemDate;
      }

      result.push(item);
    }

    return result;
  }, [grouped]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop < 100 && !isLoadingOlder) {
        onLoadOlder?.();
      }
      setShouldAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
    },
    [isLoadingOlder, onLoadOlder]
  );

  useEffect(() => {
    if (shouldAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        "flex-1 overflow-y-auto",
        "bg-wl-bg-base",
        "scrollbar-thin scrollbar-thumb-wl-border-strong scrollbar-track-wl-bg-surface"
      )}
    >
      {isLoadingOlder && (
        <div className="p-4 text-center text-wl-text-tertiary text-sm">
          Loading older messages...
        </div>
      )}

      {itemsWithDates.length === 0 ? (
        <div className="flex items-center justify-center h-full text-wl-text-secondary">
          <p className="text-sm">No messages yet. Start the conversation!</p>
        </div>
      ) : (
        itemsWithDates.map((item, idx) => {
          if ("type" in item && item.type === "date") {
            return <DateSeparator key={`date-${item.date.getTime()}`} date={item.date} />;
          }

          if ("isSystem" in item && item.isSystem) {
            return <SystemMessage key={item.id} message={item} />;
          }

          if ("messages" in item) {
            return (
              <div key={`group-${item.userId}-${item.timestamp.getTime()}`}>
                {item.messages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    isOwn={msg.userId === currentUserId}
                    onReply={onReply}
                    onReact={onReact}
                    onPin={onPin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onThreadOpen={onThreadOpen}
                  />
                ))}
              </div>
            );
          }

          return null;
        })
      )}
    </div>
  );
}
