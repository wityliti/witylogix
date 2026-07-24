"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type Attachment = {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
};

interface ComposerContextType {
  content: string;
  setContent: (content: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  mentions: string[];
  setMentions: React.Dispatch<React.SetStateAction<string[]>>;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (show: boolean) => void;
  mentionQuery: string;
  setMentionQuery: (query: string) => void;
  handleSend: (onSend: () => void) => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(
  undefined,
);

function useComposerContext(): ComposerContextType {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("Composer components must be used within ComposerRoot");
  }
  return context;
}

interface ComposerRootProps {
  children: ReactNode;
  onSend: (
    content: string,
    attachments: Attachment[],
    mentions: string[],
  ) => Promise<void>;
}

export function ComposerRoot({ children, onSend }: ComposerRootProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const handleSend = useCallback(
    async (onSend: () => void) => {
      if (!content.trim()) return;

      try {
        await onSend();
        setContent("");
        setAttachments([]);
        setMentions([]);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [content],
  );

  const value: ComposerContextType = {
    content,
    setContent,
    attachments,
    setAttachments,
    mentions,
    setMentions,
    showEmojiPicker,
    setShowEmojiPicker,
    mentionQuery,
    setMentionQuery,
    handleSend,
  };

  return (
    <ComposerContext.Provider value={value}>
      {children}
    </ComposerContext.Provider>
  );
}

interface ComposerInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onTyping?: () => void;
}

export function ComposerInput({ onTyping, ...props }: ComposerInputProps) {
  const { content, setContent, mentionQuery, setMentionQuery } =
    useComposerContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setContent(text);

      // Detect @mention context
      const lastAtIndex = text.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const afterAt = text.substring(lastAtIndex + 1);
        const spaceIndex = afterAt.indexOf(" ");
        const query =
          spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
        setMentionQuery(query);
      } else {
        setMentionQuery("");
      }

      // Call typing indicator
      onTyping?.();

      // Auto-grow textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          200,
        )}px`;
      }
    },
    [setContent, setMentionQuery, onTyping],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter, newline on Shift+Enter
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const sendButton = (
          e.currentTarget.closest("form") || document
        ).querySelector("[data-send-button]") as HTMLButtonElement;
        sendButton?.click();
      }
    },
    [],
  );

  return (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Type a message... (@mention someone, Shift+Enter for new line)"
      className={cn(
        "w-full p-3 resize-none",
        "bg-wl-bg-surface border border-wl-border-default",
        "text-wl-text-primary text-sm",
        "rounded-lg focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-wl-primary-500 focus-visible:border-transparent",
        "placeholder-wl-text-tertiary",
        "scrollbar-thin scrollbar-thumb-wl-border-strong",
        "transition-colors duration-fast ease-default",
      )}
      rows={3}
      {...props}
    />
  );
}

interface ToolbarButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "p-2 rounded-md transition-colors duration-fast ease-default",
        "text-xs font-medium",
        active
          ? "bg-wl-primary-500/20 text-wl-primary-400"
          : "text-wl-text-secondary hover:text-wl-text-primary",
        "hover:bg-wl-bg-overlay",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wl-primary-500",
      )}
    >
      <span className="text-lg">{icon}</span>
    </button>
  );
}

export function ComposerToolbar() {
  const { content, setContent, showEmojiPicker, setShowEmojiPicker } =
    useComposerContext();

  const toggleBold = useCallback(() => {
    setContent(`**${content}**`);
  }, [content, setContent]);

  const toggleItalic = useCallback(() => {
    setContent(`*${content}*`);
  }, [content, setContent]);

  const toggleCode = useCallback(() => {
    setContent("`" + content + "`");
  }, [content, setContent]);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-t border-wl-border-default">
      <ToolbarButton
        icon="𝐁"
        label="Bold"
        onClick={toggleBold}
        disabled={!content}
      />
      <ToolbarButton
        icon="𝐼"
        label="Italic"
        onClick={toggleItalic}
        disabled={!content}
      />
      <ToolbarButton
        icon="</>"
        label="Code"
        onClick={toggleCode}
        disabled={!content}
      />
      <div className="w-px h-5 bg-wl-border-subtle mx-1" />
      <ToolbarButton
        icon="🔗"
        label="Add link"
        onClick={() => {}}
        disabled={!content}
      />
      <ToolbarButton
        icon="😊"
        label="Emoji"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        active={showEmojiPicker}
      />
      <ToolbarButton icon="📎" label="Attachments" onClick={() => {}} />
    </div>
  );
}

interface AttachmentItemProps {
  id: string;
  name: string;
  url: string;
  onRemove: (id: string) => void;
}

function AttachmentItem({ id, name, url, onRemove }: AttachmentItemProps) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  return (
    <div className="flex items-center gap-2 p-2 bg-wl-bg-surface rounded border border-wl-border-subtle">
      {isImage && (
        <img src={url} alt={name} className="w-12 h-12 rounded object-cover" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-wl-text-primary truncate">
          {name}
        </p>
      </div>
      <button
        onClick={() => onRemove(id)}
        className="p-1 hover:bg-wl-bg-overlay rounded transition-colors"
        title="Remove attachment"
      >
        ✕
      </button>
    </div>
  );
}

export function ComposerAttachments() {
  const { attachments, setAttachments } = useComposerContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            name: file.name,
            url,
            size: file.size,
            type: file.type,
          },
        ]);
      });
    },
    [setAttachments],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            name: file.name,
            url,
            size: file.size,
            type: file.type,
          },
        ]);
      });
    },
    [setAttachments],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [setAttachments],
  );

  if (attachments.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-wl-border-default space-y-2">
      <p className="text-xs font-medium text-wl-text-secondary">
        Attachments ({attachments.length})
      </p>
      <div className="grid grid-cols-2 gap-2">
        {attachments.map((att) => (
          <AttachmentItem
            key={att.id}
            id={att.id}
            name={att.name}
            url={att.url}
            onRemove={removeAttachment}
          />
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

export function ComposerContainer({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col border-t border-wl-border-default bg-wl-bg-base"
      onDragOver={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
