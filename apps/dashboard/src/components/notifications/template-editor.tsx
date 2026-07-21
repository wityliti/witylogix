"use client";

import React, {
  useState,
  useRef,
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, X } from "lucide-react";

export type Channel = "email" | "sms" | "push";

interface TemplateEditorContextType {
  subject: string;
  body: string;
  channel: Channel;
  setSubject: (text: string) => void;
  setBody: (text: string) => void;
  setChannel: (channel: Channel) => void;
}

const TemplateEditorContext = createContext<
  TemplateEditorContextType | undefined
>(undefined);

const useTemplateEditorContext = () => {
  const context = useContext(TemplateEditorContext);
  if (!context) {
    throw new Error(
      "useTemplateEditorContext must be used within TemplateEditor.Root"
    );
  }
  return context;
};

const AVAILABLE_VARIABLES = [
  { name: "order.id", example: "ORD-12345" },
  { name: "customer.name", example: "John Doe" },
  { name: "delivery.eta", example: "Today 2-4 PM" },
  { name: "delivery.address", example: "123 Main St" },
  { name: "tracking.link", example: "https://track.example.com" },
  { name: "support.contact", example: "support@example.com" },
];

const CHANNEL_LIMITS: Record<Channel, Record<string, number>> = {
  email: { subject: 78, body: 5000 },
  sms: { body: 160 },
  push: { title: 65, body: 240 },
};

interface RootProps {
  children: ReactNode;
  defaultChannel?: Channel;
  onSave?: (data: { subject: string; body: string; channel: Channel }) => void;
}

const Root = ({
  children,
  defaultChannel = "email",
  onSave,
}: RootProps) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Channel>(defaultChannel);

  const value = useMemo(
    () => ({ subject, body, channel, setSubject, setBody, setChannel }),
    [subject, body, channel]
  );

  return (
    <TemplateEditorContext.Provider value={value}>
      <div className="flex flex-col gap-4">{children}</div>
    </TemplateEditorContext.Provider>
  );
};

interface SubjectProps {
  label?: string;
  placeholder?: string;
}

const Subject = ({ label = "Subject", placeholder = "Enter email subject" }: SubjectProps) => {
  const { subject, setSubject, channel } = useTemplateEditorContext();
  const limit = CHANNEL_LIMITS[channel]?.subject || 78;
  const remaining = limit - subject.length;

  if (channel === "sms" || channel === "push") return null;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[var(--wl-text-primary)]">
        {label}
      </label>
      <div className="relative">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, limit))}
          placeholder={placeholder}
          maxLength={limit}
          className="w-full"
          aria-label={label}
        />
        <span
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium",
            remaining < 10
              ? "text-[var(--wl-danger)]"
              : "text-[var(--wl-text-secondary)]"
          )}
        >
          {remaining}/{limit}
        </span>
      </div>
    </div>
  );
};

interface BodyProps {
  label?: string;
  placeholder?: string;
}

const Body = ({
  label = "Body",
  placeholder = "Enter message body. Use {{variable}} for dynamic content.",
}: BodyProps) => {
  const { body, setBody, channel } = useTemplateEditorContext();
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompletePos, setAutocompletePos] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const limit = CHANNEL_LIMITS[channel]?.body || 160;
  const remaining = limit - body.length;

  const filteredVariables = useMemo(() => {
    if (!query) return AVAILABLE_VARIABLES;
    return AVAILABLE_VARIABLES.filter((v) =>
      v.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      if (e.key === "{" && e.ctrlKey === false) {
        const cursorPos = textarea.selectionStart;
        const precedingText = body.substring(Math.max(0, cursorPos - 1), cursorPos);

        if (precedingText === "{") {
          setAutocompleteOpen(true);
          const rect = textarea.getBoundingClientRect();
          const coords = {
            x: rect.left + 10,
            y: rect.top + 20,
          };
          setAutocompletePos(coords);
          setQuery("");
        }
      }

      if (e.key === "Escape") {
        setAutocompleteOpen(false);
      }
    },
    [body]
  );

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value.slice(0, limit);
    setBody(newValue);

    const cursorPos = e.target.selectionStart;
    const lastBraceIdx = newValue.lastIndexOf("{{", cursorPos);

    if (lastBraceIdx !== -1 && newValue.indexOf("}}", lastBraceIdx) === -1) {
      const partial = newValue.substring(lastBraceIdx + 2, cursorPos);
      setQuery(partial);
    } else {
      setAutocompleteOpen(false);
    }
  };

  const insertVariable = (varName: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const lastBraceIdx = body.lastIndexOf("{{", cursorPos);

    if (lastBraceIdx !== -1) {
      const beforeVariable = body.substring(0, lastBraceIdx);
      const afterVariable = body.substring(cursorPos);
      const newBody = `${beforeVariable}{{ ${varName} }}${afterVariable}`;

      setBody(newBody);
      setAutocompleteOpen(false);
      setQuery("");

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = beforeVariable.length + varName.length + 6;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[var(--wl-text-primary)]">
        {label}
      </label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={limit}
          rows={8}
          className={cn(
            "w-full px-3 py-2 rounded-md",
            "bg-wl-bg-elevated text-[var(--wl-text-primary)]",
            "border border-wl-border-default",
            "focus:outline-none focus:ring-2 focus:ring-[var(--wl-primary)]/40",
            "placeholder:text-[var(--wl-text-secondary)]",
            "font-mono text-sm"
          )}
          aria-label={label}
        />
        <span
          className={cn(
            "absolute right-3 bottom-3 text-xs font-medium",
            remaining < 20
              ? "text-[var(--wl-danger)]"
              : "text-[var(--wl-text-secondary)]"
          )}
        >
          {remaining}/{limit}
        </span>

        {autocompleteOpen && filteredVariables.length > 0 && (
          <div
            className={cn(
              "absolute z-50 mt-1 rounded-md border border-wl-border-default",
              "bg-wl-bg-sunken shadow-lg",
              "max-h-48 w-64 overflow-y-auto"
            )}
            style={{
              top: `${autocompletePos.y}px`,
              left: `${autocompletePos.x}px`,
            }}
          >
            {filteredVariables.map((variable) => (
              <button
                key={variable.name}
                onClick={() => insertVariable(variable.name)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm",
                  "hover:bg-wl-bg-elevated transition-colors",
                  "border-b border-wl-border-default last:border-b-0"
                )}
              >
                <div className="font-mono text-[var(--wl-text-primary)]">
                  {variable.name}
                </div>
                <div className="text-xs text-[var(--wl-text-secondary)]">
                  {variable.example}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PreviewProps {
  label?: string;
}

const Preview = ({ label = "Preview" }: PreviewProps) => {
  const { subject, body, channel } = useTemplateEditorContext();

  const renderedText = useMemo(() => {
    let text = body;
    AVAILABLE_VARIABLES.forEach((variable) => {
      text = text.replace(
        new RegExp(`{{\\s*${variable.name}\\s*}}`, "g"),
        variable.example
      );
    });
    return text;
  }, [body]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[var(--wl-text-primary)]">
        {label}
      </label>
      <div
        className={cn(
          "rounded-md border border-wl-border-default",
          "bg-wl-bg-elevated p-4",
          "min-h-32"
        )}
      >
        {subject && (
          <div className="mb-3 pb-3 border-b border-wl-border-default">
            <p className="text-xs font-semibold text-[var(--wl-text-secondary)]">
              SUBJECT
            </p>
            <p className="text-sm text-[var(--wl-text-primary)] mt-1">
              {subject}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-[var(--wl-text-secondary)]">
            {channel.toUpperCase()} MESSAGE
          </p>
          <p className="text-sm text-[var(--wl-text-primary)] mt-2 whitespace-pre-wrap break-words">
            {renderedText}
          </p>
        </div>
      </div>
    </div>
  );
};

interface TabsProps {
  children: ReactNode;
}

const Tabs = ({ children }: TabsProps) => {
  const { channel, setChannel } = useTemplateEditorContext();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-wl-border-default">
        {(["email", "sms", "push"] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              "border-b-2 -mb-[2px]",
              channel === ch
                ? "text-[var(--wl-primary)] border-[var(--wl-primary)]"
                : "text-[var(--wl-text-secondary)] border-transparent hover:text-[var(--wl-text-primary)]"
            )}
          >
            {ch === "email" && "Email HTML"}
            {ch === "sms" && "SMS Plain"}
            {ch === "push" && "Push Rich"}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
};

interface VariablesSidebarProps {
  title?: string;
}

const VariablesSidebar = ({ title = "Available Variables" }: VariablesSidebarProps) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--wl-text-primary)]">
        {title}
      </h4>
      <div className="space-y-2">
        {AVAILABLE_VARIABLES.map((variable) => (
          <div
            key={variable.name}
            className={cn(
              "px-3 py-2 rounded-md",
              "bg-wl-bg-elevated border border-wl-border-default",
              "text-xs"
            )}
          >
            <p className="font-mono font-semibold text-[var(--wl-text-primary)]">
              {variable.name}
            </p>
            <p className="text-[var(--wl-text-secondary)] mt-1">
              {variable.example}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TemplateEditor = {
  Root,
  Subject,
  Body,
  Preview,
  Tabs,
  VariablesSidebar,
};
