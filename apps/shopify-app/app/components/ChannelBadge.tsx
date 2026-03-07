/**
 * ChannelBadge — Consistent badge component for notification channels.
 *
 * Maps notification channel types to Polaris-compatible color tokens.
 * Used in notification settings, channel selectors, and integration displays.
 */

interface ChannelBadgeProps {
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK";
  size?: "small" | "medium";
}

const CHANNEL_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  EMAIL: {
    label: "Email",
    bgColor: "#e8f0fe",
    textColor: "#1a3a6e",
  },
  SMS: {
    label: "SMS",
    bgColor: "#e6f7ef",
    textColor: "#004d33",
  },
  WHATSAPP: {
    label: "WhatsApp",
    bgColor: "#e1f3f0",
    textColor: "#005c52",
  },
  PUSH: {
    label: "Push",
    bgColor: "#f5f0ff",
    textColor: "#4b2d8e",
  },
  WEBHOOK: {
    label: "Webhook",
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  },
};

export function ChannelBadge({
  channel,
  size = "medium",
}: ChannelBadgeProps) {
  const config = CHANNEL_CONFIG[channel] ?? {
    label: channel,
    bgColor: "#f1f2f3",
    textColor: "#6d7175",
  };

  const padding = size === "small" ? "2px 8px" : "4px 12px";
  const fontSize = size === "small" ? 11 : 12;

  return (
    <span
      style={{
        display: "inline-block",
        padding,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.4,
        borderRadius: 20,
        backgroundColor: config.bgColor,
        color: config.textColor,
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}
