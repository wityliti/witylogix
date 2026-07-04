/**
 * useCollaboration — React hook for team messaging collaboration.
 *
 * Manages channels, messages, real-time updates, typing indicators,
 * and @mention search functionality.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

export interface Channel {
  id: string;
  name: string;
  category: "general" | "orders" | "drivers" | "alerts";
  description?: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: Date;
  members: number;
}

export interface DirectMessage {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  online: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: Date;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  avatar?: string;
  content: string;
  richText?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    link?: string;
  };
  attachments?: Array<{
    id: string;
    type: "file" | "image";
    url: string;
    name: string;
    size?: number;
  }>;
  mentions?: string[]; // User IDs
  reactions?: Record<string, string[]>; // emoji -> user IDs
  threadId?: string;
  replyTo?: string;
  pinned?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  isSystem?: boolean; // for system messages
}

export interface TypingUser {
  userId: string;
  userName: string;
  since: Date;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface UseCollaborationConfig {
  url?: string;
  token: string;
  userId: string;
  userName: string;
  autoConnect?: boolean;
}

export interface UseCollaborationReturn {
  // Channel operations
  channels: Channel[];
  currentChannel: Channel | null;
  selectChannel: (channelId: string) => void;
  createChannel: (name: string, category: Channel["category"]) => Promise<void>;
  archiveChannel: (channelId: string) => Promise<void>;

  // Message operations
  messages: Message[];
  isLoadingMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (
    content: string,
    attachments?: Message["attachments"],
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;

  // Typing indicators
  typingUsers: TypingUser[];
  broadcastTyping: () => void;

  // Direct messages
  directMessages: DirectMessage[];
  selectDM: (userId: string) => void;

  // Search & mentions
  searchMentions: (query: string) => Promise<User[]>;

  // Thread operations
  openThread: (messageId: string) => void;
  threadMessages: Message[];
  closeThread: () => void;

  // Status
  isConnected: boolean;
  error?: string;
}

const TYPING_INDICATOR_TIMEOUT = 3000;
const MESSAGE_BATCH_SIZE = 50;

export function useCollaboration(
  config: UseCollaborationConfig,
): UseCollaborationReturn {
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>();
  const [messageOffset, setMessageOffset] = useState(0);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!config.autoConnect) return;

    const socket = io(config.url || "/realtime", {
      auth: { token: config.token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(undefined);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("channels:list", (data: Channel[]) => {
      setChannels(data);
    });

    socket.on(
      "messages:batch",
      (data: { messages: Message[]; offset: number }) => {
        setMessages((prev) => [...data.messages, ...prev]);
        setIsLoadingMessages(false);
      },
    );

    socket.on("message:new", (data: Message) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("message:updated", (data: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === data.id ? data : m)));
    });

    socket.on("message:deleted", (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on("typing:users", (users: TypingUser[]) => {
      setTypingUsers(users);
    });

    socket.on("directMessages:list", (data: DirectMessage[]) => {
      setDirectMessages(data);
    });

    socket.on("thread:messages", (data: Message[]) => {
      setThreadMessages(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [config.autoConnect, config.token, config.url]);

  const selectChannel = useCallback(
    (channelId: string) => {
      const channel = channels.find((c) => c.id === channelId);
      if (channel) {
        setCurrentChannel(channel);
        setMessages([]);
        setMessageOffset(0);
        socketRef.current?.emit("channel:select", { channelId });
      }
    },
    [channels],
  );

  const createChannel = useCallback(
    async (name: string, category: Channel["category"]) => {
      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit(
          "channel:create",
          { name, category },
          (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          },
        );
      });
    },
    [],
  );

  const archiveChannel = useCallback(async (channelId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit(
        "channel:archive",
        { channelId },
        (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        },
      );
    });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!currentChannel || isLoadingMessages) return;

    setIsLoadingMessages(true);
    socketRef.current?.emit("messages:load", {
      channelId: currentChannel.id,
      offset: messageOffset,
      limit: MESSAGE_BATCH_SIZE,
    });
    setMessageOffset((prev) => prev + MESSAGE_BATCH_SIZE);
  }, [currentChannel, isLoadingMessages, messageOffset]);

  const sendMessage = useCallback(
    async (content: string, attachments?: Message["attachments"]) => {
      if (!currentChannel) return;

      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit(
          "message:send",
          {
            channelId: currentChannel.id,
            content,
            attachments,
            userId: config.userId,
          },
          (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          },
        );
      });
    },
    [currentChannel, config.userId],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit(
          "message:edit",
          { messageId, content },
          (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          },
        );
      });
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit(
        "message:delete",
        { messageId },
        (response: any) => {
          if (response.error) reject(new Error(response.error));
          else resolve();
        },
      );
    });
  }, []);

  const pinMessage = useCallback(async (messageId: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit("message:pin", { messageId }, (response: any) => {
        if (response.error) reject(new Error(response.error));
        else resolve();
      });
    });
  }, []);

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit(
          "message:react",
          { messageId, emoji, userId: config.userId },
          (response: any) => {
            if (response.error) reject(new Error(response.error));
            else resolve();
          },
        );
      });
    },
    [config.userId],
  );

  const broadcastTyping = useCallback(() => {
    if (!currentChannel) return;

    socketRef.current?.emit("typing:start", {
      channelId: currentChannel.id,
      userId: config.userId,
    });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", {
        channelId: currentChannel.id,
        userId: config.userId,
      });
    }, TYPING_INDICATOR_TIMEOUT);
  }, [currentChannel, config.userId]);

  const selectDM = useCallback((userId: string) => {
    setCurrentChannel(null);
    setMessages([]);
    setMessageOffset(0);
    socketRef.current?.emit("dm:select", { userId });
  }, []);

  const searchMentions = useCallback(async (query: string): Promise<User[]> => {
    return new Promise<User[]>((resolve, reject) => {
      socketRef.current?.emit("mentions:search", { query }, (response: any) => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.users || []);
      });
    });
  }, []);

  const openThread = useCallback((messageId: string) => {
    setOpenThreadId(messageId);
    socketRef.current?.emit("thread:load", { messageId });
  }, []);

  const closeThread = useCallback(() => {
    setOpenThreadId(null);
    setThreadMessages([]);
  }, []);

  return {
    channels,
    currentChannel,
    selectChannel,
    createChannel,
    archiveChannel,
    messages,
    isLoadingMessages,
    loadOlderMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    reactToMessage,
    typingUsers,
    broadcastTyping,
    directMessages,
    selectDM,
    searchMentions,
    openThread,
    threadMessages,
    closeThread,
    isConnected,
    error,
  };
}
