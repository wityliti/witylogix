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
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface MentionSuggestion extends User {
  highlighted: boolean;
}

function TeamCollaborationPage() {
  const collaboration = useCollaboration({
    url: process.env.NEXT_PUBLIC_REALTIME_URL,
    token: "", // This would come from auth context in real app
    userId: "current-user", // This would come from auth context
    userName: "Current User", // This would come from auth context
    autoConnect: false, // Start manual for demo
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
        console.error("Failed to search mentions:", error);
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
    const attachments: any[] = [];

    if (!content.trim()) return;

    try {
      await collaboration.sendMessage(content, attachments);
      messageInput.value = "";
      messageInput.style.height = "auto";
      setShowMentionDropdown(false);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [collaboration]);

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        await collaboration.editMessage(messageId, newContent);
        setEditingMessageId(null);
        setEditingContent("");
      } catch (error) {
        console.error("Failed to edit message:", error);
      }
    },
    [collaboration]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!window.confirm("Delete this message?")) return;

      try {
        await collaboration.deleteMessage(messageId);
      } catch (error) {
        console.error("Failed to delete message:", error);
      }
    },
    [collaboration]
  );

  const handlePinMessage = useCallback(
    async (messageId: string) => {
      try {
        await collaboration.pinMessage(messageId);
      } catch (error) {
        console.error("Failed to pin message:", error);
      }
    },
    [collaboration]
  );

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await collaboration.reactToMessage(messageId, emoji);
      } catch (error) {
        console.error("Failed to react to message:", error);
      }
    },
    [collaboration]
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
    } catch (error) {
      console.error("Failed to create channel:", error);
    }
  }, [collaboration, newChannelName, newChannelCategory]);

  const pinnedMessages = useMemo(() => {
    return collaboration.messages.filter((m) => m.pinned);
  }, [collaboration.messages]);

  const sharedFiles = useMemo(() => {
    return collaboration.messages
      .flatMap((m) => m.attachments || [])
      .filter((att) => att.type === "file");
  }, [collaboration.messages]);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0f]">
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
          <div className="px-6 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">
                #{collaboration.currentChannel.name}
              </h1>
              {collaboration.currentChannel.description && (
                <p className="text-sm text-gray-400 mt-1">
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
              currentUserId={collaboration.userId || ""}
              isLoadingOlder={collaboration.isLoadingMessages}
              onLoadOlder={collaboration.loadOlderMessages}
              onReply={handleOpenThread}
              onReact={handleReactToMessage}
              onPin={handlePinMessage}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onThreadOpen={handleOpenThread}
            />

            {/* Typing Indicators */}
            {collaboration.typingUsers.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-[#1e1e2e]">
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
                  <div className="text-xs text-gray-400">
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
              currentUserId={collaboration.userId || ""}
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
            "absolute bottom-64 left-64 z-50 bg-[#12121a] border border-[#1e1e2e]",
            "rounded-lg shadow-lg max-h-48 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-[#1e1e2e]"
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
                "hover:bg-[#1a1a2e] transition-colors",
                "border-b border-[#1e1e2e] last:border-b-0",
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
  sharedFiles: any[];
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
    <div className="w-64 border-l border-[#1e1e2e] bg-[#12121a] flex flex-col">
      {/* Channel Details */}
      <div className="px-4 py-4 border-b border-[#1e1e2e]">
        <h2 className="text-sm font-semibold text-white mb-3">
          {channel.name}
        </h2>
        <div className="space-y-2 text-xs text-gray-300">
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
      <div className="px-4 py-4 border-b border-[#1e1e2e]">
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
                className="p-2 rounded bg-[#1a1a2e] border border-[#1e1e2e] text-xs"
              >
                <p className="font-medium text-gray-300">
                  {msg.userName}
                </p>
                <p className="text-gray-400 truncate">{msg.content}</p>
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
                className="block p-2 rounded bg-[#1a1a2e] border border-[#1e1e2e] hover:border-blue-500 text-xs text-blue-400 truncate"
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
    <div className="w-80 border-l border-[#1e1e2e] bg-[#12121a] flex flex-col animate-slide-in">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Thread
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-[#1e1e2e]">
        {messages.map((msg) => (
          <div key={msg.id} className="text-xs">
            <p className="font-medium text-white">{msg.userName}</p>
            <p className="text-gray-300">{msg.content}</p>
            <p className="text-gray-400 mt-1">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="px-4 py-3 border-t border-[#1e1e2e]">
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Reply in thread..."
          className={cn(
            "w-full p-2 text-xs resize-none rounded",
            "bg-[#1a1a2e] border border-[#1e1e2e]",
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
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          Create New Channel
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Channel Name
            </label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., urgent-orders"
              className={cn(
                "w-full px-3 py-2 text-sm rounded",
                "bg-[#12121a] border border-[#1e1e2e]",
                "text-white placeholder-wl-text-tertiary",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-wl-primary-500"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Category
            </label>
            <select
              value={categoryValue}
              onChange={(e) =>
                onCategoryChange(e.target.value as Channel["category"])
              }
              className={cn(
                "w-full px-3 py-2 text-sm rounded",
                "bg-[#12121a] border border-[#1e1e2e]",
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
