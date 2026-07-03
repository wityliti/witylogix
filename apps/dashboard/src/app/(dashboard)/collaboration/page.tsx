"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
  useCollaboration,
  type Channel,
  type Message,
  type User,
} from "@/hooks/use-collaboration";
import {
  ComposerRoot,
  ComposerContainer,
  ComposerInput,
  ComposerToolbar,
  ComposerAttachments,
} from "@/components/collaboration/message-composer";
import { MessageList } from "@/components/collaboration/message-list";
import { ChannelSidebar } from "@/components/collaboration/channel-sidebar";
import { useApiList } from '@/hooks/use-api';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface MentionSuggestion extends User {
  highlighted: boolean;
}

function TeamCollaborationPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const collaboration = useCollaboration({
    url: process.env.NEXT_PUBLIC_REALTIME_URL,
    token: "",
    userId: user?.id ?? "",
    userName: user?.name ?? "",
    autoConnect: false,
  });

  const [showThreadPanel, setShowThreadPanel] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelCategory, setNewChannelCategory] = useState<Channel["category"]>("general");
  const [pendingDeleteMsgId, setPendingDeleteMsgId] = useState<string | null>(null);

  const mentionInputRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Focus search input
        const searchInput = document.querySelector(
          "input[placeholder*='Search']"
        ) as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch mention suggestions
  const handleMentionSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setMentionSuggestions([]);
        setShowMentionDropdown(false);
        return;
      }

      try {
        const results = await collaboration.searchMentions(query);
        setMentionSuggestions(
          results.map((user) => ({
            ...user,
            highlighted: false,
          }))
        );
        setShowMentionDropdown(results.length > 0);
      } catch (error) {
        // mention search failures are silent — user can still type manually
        void error;
      }
    },
    [collaboration]
  );

  // Watch for mention query changes
  useEffect(() => {
    handleMentionSearch(collaboration.searchMentions.toString());
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!collaboration.currentChannel) return;

    const messageInput = document.querySelector(
      "textarea[placeholder*='Type a message']"
    ) as HTMLTextAreaElement;
    const content = messageInput?.value || "";
    const attachments: NonNullable<Parameters<typeof collaboration.sendMessage>[1]> = [];

    if (!content.trim()) return;

    try {
      await collaboration.sendMessage(content, attachments);
      messageInput.value = "";
      messageInput.style.height = "auto";
      setShowMentionDropdown(false);
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to send message', message: error instanceof Error ? error.message : undefined });
    }
  }, [collaboration, addToast]);

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        await collaboration.editMessage(messageId, newContent);
        setEditingMessageId(null);
        setEditingContent("");
      } catch (error) {
        addToast({ type: 'error', title: 'Failed to edit message', message: error instanceof Error ? error.message : undefined });
      }
    },
    [collaboration, addToast]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (pendingDeleteMsgId !== messageId) {
        setPendingDeleteMsgId(messageId);
        return;
      }
      setPendingDeleteMsgId(null);
      try {
        await collaboration.deleteMessage(messageId);
      } catch (error) {
        addToast({ type: 'error', title: 'Failed to delete message', message: error instanceof Error ? error.message : undefined });
      }
    },
    [collaboration, pendingDeleteMsgId, addToast]
  );

  const handlePinMessage = useCallback(
    async (messageId: string) => {
      try {
        await collaboration.pinMessage(messageId);
      } catch (error) {
        addToast({ type: 'error', title: 'Failed to pin message', message: error instanceof Error ? error.message : undefined });
      }
    },
    [collaboration, addToast]
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await collaboration.reactToMessage(messageId, emoji);
      } catch (error) {
        addToast({ type: 'error', title: 'Failed to add reaction', message: error instanceof Error ? error.message : undefined });
      }
    },
    [collaboration, addToast]
  );

  const handleOpenThread = useCallback((messageId: string) => {
    collaboration.openThread(messageId);
    setSelectedThreadId(messageId);
    setShowThreadPanel(true);
  }, [collaboration]);

  const handleCreateChannel = useCallback(async () => {
    if (!newChannelName.trim()) return;

    try {
      await collaboration.createChannel(newChannelName, newChannelCategory);
      setNewChannelName("");
      setShowCreateChannelModal(false);
      addToast({ type: 'success', title: 'Channel created' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to create channel', message: error instanceof Error ? error.message : undefined });
    }
  }, [collaboration, newChannelName, newChannelCategory, addToast]);

  const pinnedMessages = useMemo(() => {
    return collaboration.messages.filter((m) => m.pinned);
  }, [collaboration.messages]);

  const sharedFiles = useMemo(() => {
    return collaboration.messages
      .flatMap((m) => m.attachments || [])
      .filter((att) => att.type === "file");
  }, [collaboration.messages]);

  return (
    <div className="flex h-screen w-full bg-wl-bg-root">
      {/* Left Sidebar: Channels & DMs */}
      <ChannelSidebar
        channels={collaboration.channels}
        directMessages={collaboration.directMessages}
        currentChannelId={collaboration.currentChannel?.id}
        onSelectChannel={collaboration.selectChannel}
        onSelectDM={collaboration.selectDM}
        onCreateChannel={() => setShowCreateChannelModal(true)}
        onSearch={(query) => {
          // Filter channels/DMs by search query
        }}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {collaboration.currentChannel && (
          <div className="px-6 py-4 border-b border-wl-border-default flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                #{collaboration.currentChannel.name}
              </h1>
              {collaboration.currentChannel.description && (
                <p className="text-sm text-wl-text-secondary mt-1">
                  {collaboration.currentChannel.description}
                </p>
              )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {collaboration.isConnected ? (
                <Badge variant="success" dot>
                  Connected
                </Badge>
              ) : (
                <Badge variant="warning">Connecting...</Badge>
              )}
            </div>
          </div>
        )}

        {/* Message Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <MessageList
              messages={collaboration.messages}
              currentUserId={user?.id ?? ""}
              isLoadingOlder={collaboration.isLoadingMessages}
              onLoadOlder={collaboration.loadOlderMessages}
              onReply={handleOpenThread}
              onReact={handleReactToMessage}
              onPin={handlePinMessage}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onThreadOpen={handleOpenThread}
            />

            {/* Delete confirmation banner */}
            {pendingDeleteMsgId && (
              <div className="px-4 py-2 flex items-center justify-between gap-3 bg-red-900/20 border-t border-red-500/30">
                <span className="text-xs text-red-400">Delete this message?</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingDeleteMsgId(null)}
                    className="text-xs px-2 py-1 rounded border border-wl-border-default text-wl-text-secondary hover:text-wl-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(pendingDeleteMsgId)}
                    className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Typing Indicators */}
            {collaboration.typingUsers.length > 0 && (
              <div className="px-4 py-2 text-xs text-wl-text-secondary border-t border-wl-border-default">
                {collaboration.typingUsers
                  .map((u) => u.userName)
                  .join(", ")} {collaboration.typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Composer */}
            <ComposerRoot onSend={handleSendMessage}>
              <ComposerContainer>
                <ComposerInput
                  onTyping={collaboration.broadcastTyping}
                />
                <ComposerToolbar />
                <ComposerAttachments />
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="text-xs text-wl-text-secondary">
                    Shift+Enter for new line
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendMessage}
                    data-send-button
                  >
                    Send
                  </Button>
                </div>
              </ComposerContainer>
            </ComposerRoot>
          </div>

          {/* Right Sidebar: Channel Details */}
          {collaboration.currentChannel && !showThreadPanel && (
            <RightSidebar
              channel={collaboration.currentChannel}
              pinnedMessages={pinnedMessages}
              sharedFiles={sharedFiles}
              memberCount={collaboration.currentChannel.members}
            />
          )}

          {/* Thread Panel */}
          {showThreadPanel && selectedThreadId && (
            <ThreadPanel
              threadId={selectedThreadId}
              messages={collaboration.threadMessages}
              currentUserId={user?.id ?? ""}
              onClose={() => {
                setShowThreadPanel(false);
                collaboration.closeThread();
              }}
              onSendReply={async (content) => {
                await collaboration.sendMessage(content);
              }}
            />
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <CreateChannelModal
          onClose={() => setShowCreateChannelModal(false)}
          onCreate={handleCreateChannel}
          nameValue={newChannelName}
          onNameChange={setNewChannelName}
          categoryValue={newChannelCategory}
          onCategoryChange={setNewChannelCategory}
        />
      )}

      {/* Mention Dropdown */}
      {showMentionDropdown && mentionSuggestions.length > 0 && (
        <div
          ref={mentionInputRef}
          className={cn(
            "absolute bottom-64 left-64 z-50 bg-wl-bg-surface border border-wl-border-default",
            "rounded-lg shadow-lg max-h-48 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-wl-bg-elevated"
          )}
        >
          {mentionSuggestions.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                // Insert mention into message
                const textarea = document.querySelector(
                  "textarea[placeholder*='Type a message']"
                ) as HTMLTextAreaElement;
                if (textarea) {
                  const text = textarea.value;
                  const lastAtIndex = text.lastIndexOf("@");
                  textarea.value =
                    text.substring(0, lastAtIndex) + `@${user.name} `;
                  textarea.focus();
                  textarea.selectionStart = textarea.value.length;
                }
                setShowMentionDropdown(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2 text-sm",
                "hover:bg-wl-bg-elevated transition-colors",
                "border-b border-wl-border-default last:border-b-0",
                "text-white"
              )}
            >
              <div className="flex items-center gap-2">
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span>{user.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RightSidebarProps {
  channel: Channel;
  pinnedMessages: Message[];
  sharedFiles: Array<{ name: string; url: string; [key: string]: unknown }>;
  memberCount: number;
}

function RightSidebar({
  channel,
  pinnedMessages,
  sharedFiles,
  memberCount,
}: RightSidebarProps) {
  const [expandedSection, setExpandedSection] = useState<
    "details" | "pinned" | "files"
  >("details");

  return (
    <div className="w-64 border-l border-wl-border-default bg-wl-bg-surface flex flex-col">
      {/* Channel Details */}
      <div className="px-4 py-4 border-b border-wl-border-default">
        <h2 className="text-sm font-semibold text-white mb-3">
          {channel.name}
        </h2>
        <div className="space-y-2 text-xs text-wl-neutral-300">
          <p>
            <strong>Members:</strong> {memberCount}
          </p>
          {channel.description && (
            <p>
              <strong>Description:</strong> {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* Pinned Messages */}
      <div className="px-4 py-4 border-b border-wl-border-default">
        <button
          onClick={() => setExpandedSection("pinned")}
          className="text-xs font-semibold text-white uppercase tracking-wider w-full text-left mb-2"
        >
          📌 Pinned ({pinnedMessages.length})
        </button>
        {expandedSection === "pinned" && pinnedMessages.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-2 rounded bg-wl-bg-elevated border border-wl-border-default text-xs"
              >
                <p className="font-medium text-wl-neutral-300">
                  {msg.userName}
                </p>
                <p className="text-wl-text-secondary truncate">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared Files */}
      <div className="px-4 py-4">
        <button
          onClick={() => setExpandedSection("files")}
          className="text-xs font-semibold text-white uppercase tracking-wider w-full text-left mb-2"
        >
          📎 Shared Files ({sharedFiles.length})
        </button>
        {expandedSection === "files" && sharedFiles.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sharedFiles.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 rounded bg-wl-bg-elevated border border-wl-border-default hover:border-blue-500 text-xs text-blue-400 truncate"
              >
                📄 {file.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ThreadPanelProps {
  threadId: string;
  messages: Message[];
  currentUserId: string;
  onClose: () => void;
  onSendReply: (content: string) => Promise<void>;
}

function ThreadPanel({
  threadId,
  messages,
  currentUserId,
  onClose,
  onSendReply,
}: ThreadPanelProps) {
  const [replyContent, setReplyContent] = useState("");

  return (
    <div className="w-80 border-l border-wl-border-default bg-wl-bg-surface flex flex-col animate-slide-in">
      {/* Header */}
      <div className="px-4 py-4 border-b border-wl-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Thread
        </h2>
        <button
          onClick={onClose}
          className="text-wl-text-secondary hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-wl-bg-elevated">
        {messages.map((msg) => (
          <div key={msg.id} className="text-xs">
            <p className="font-medium text-white">{msg.userName}</p>
            <p className="text-wl-neutral-300">{msg.content}</p>
            <p className="text-wl-text-secondary mt-1">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="px-4 py-3 border-t border-wl-border-default">
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Reply in thread..."
          className={cn(
            "w-full p-2 text-xs resize-none rounded",
            "bg-wl-bg-elevated border border-wl-border-default",
            "text-white placeholder-wl-text-tertiary",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-wl-primary-500"
          )}
          rows={2}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onSendReply(replyContent);
            setReplyContent("");
          }}
          className="w-full mt-2"
          disabled={!replyContent.trim()}
        >
          Reply
        </Button>
      </div>
    </div>
  );
}

interface CreateChannelModalProps {
  onClose: () => void;
  onCreate: () => void;
  nameValue: string;
  onNameChange: (name: string) => void;
  categoryValue: Channel["category"];
  onCategoryChange: (category: Channel["category"]) => void;
}

function CreateChannelModal({
  onClose,
  onCreate,
  nameValue,
  onNameChange,
  categoryValue,
  onCategoryChange,
}: CreateChannelModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wl-bg-surface border border-wl-border-default rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          Create New Channel
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-wl-neutral-300 mb-1">
              Channel Name
            </label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., urgent-orders"
              className={cn(
                "w-full px-3 py-2 text-sm rounded",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-white placeholder-wl-text-tertiary",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-wl-primary-500"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-wl-neutral-300 mb-1">
              Category
            </label>
            <select
              value={categoryValue}
              onChange={(e) =>
                onCategoryChange(e.target.value as Channel["category"])
              }
              className={cn(
                "w-full px-3 py-2 text-sm rounded",
                "bg-wl-bg-surface border border-wl-border-default",
                "text-white",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-wl-primary-500"
              )}
            >
              <option value="general">General</option>
              <option value="orders">Orders</option>
              <option value="drivers">Drivers</option>
              <option value="alerts">Alerts</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onCreate}
            disabled={!nameValue.trim()}
            className="flex-1"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TeamCollaborationPage;
