/**
 * ChannelBadge — Consistent badge component for notification channels.
 *
 * Maps notification channel types to Polaris Badge tones.
 * Used in notification settings, channel selectors, and integration displays.
 */

import { Badge } from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface ChannelBadgeProps {
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK";
  size?: "small" | "medium";
}

const CHANNEL_CONFIG: Record<
  string,
  { label: string; tone?: BadgeProps["tone"] }
> = {
  EMAIL: { label: "Email", tone: "info" },
  SMS: { label: "SMS", tone: "success" },
  WHATSAPP: { label: "WhatsApp", tone: "success" },
  PUSH: { label: "Push", tone: "attention" },
  WEBHOOK: { label: "Webhook" },
};

export function ChannelBadge({ channel, size = "medium" }: ChannelBadgeProps) {
  const config = CHANNEL_CONFIG[channel] ?? { label: channel };

  return (
    <Badge size={size} tone={config.tone}>
      {config.label}
    </Badge>
  );
}
