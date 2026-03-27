/**
 * DeliveryTimeline — Vertical timeline component for delivery status tracking.
 *
 * Displays a series of events in chronological order with status indicators,
 * timestamps, and messages. Current step is highlighted, future steps are dimmed.
 *
 * Uses Polaris v13 components for layout and typography.
 */

import {
  Badge,
  BlockStack,
  Box,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface TimelineEvent {
  status: string;
  timestamp: string;
  message?: string;
  actor?: string;
}

interface DeliveryTimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
}

const STATUS_TONE_MAP: Record<string, BadgeProps["tone"]> = {
  PENDING: "attention",
  PROCESSING: "info",
  LABEL_CREATED: "info",
  PICKED_UP: "info",
  IN_TRANSIT: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  ATTEMPTED: "warning",
  FAILED: "critical",
  RETURNED: "warning",
  CANCELLED: undefined,
};

export function DeliveryTimeline({
  events,
  currentStatus,
}: DeliveryTimelineProps) {
  const currentIndex = events.findIndex((e) => e.status === currentStatus);

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h3" variant="headingMd">
          Delivery Timeline
        </Text>

        <BlockStack gap="400">
          {events.map((event, index) => {
            const isReached = index <= currentIndex;
            const tone = STATUS_TONE_MAP[event.status];
            const statusLabel = event.status.replace(/_/g, " ");

            return (
              <Box key={index} opacity={isReached ? undefined : "0"}>
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <Badge tone={isReached ? tone : undefined} size="small">
                      {statusLabel}
                    </Badge>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {formatTimestamp(event.timestamp)}
                    </Text>
                  </InlineStack>

                  {event.message && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {event.message}
                    </Text>
                  )}

                  {event.actor && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      by {event.actor}
                    </Text>
                  )}
                </BlockStack>
              </Box>
            );
          })}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
