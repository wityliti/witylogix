/**
 * StatusTimeline — Vertical timeline of status change events.
 *
 * Shows chronological events with timestamps, actors, and descriptions.
 * Used on order detail pages, activity feeds, and driver history.
 *
 * Uses Polaris v13 components for layout and typography.
 */

import {
  BlockStack,
  Box,
  Card,
  InlineStack,
  SkeletonBodyText,
  Text,
} from "@shopify/polaris";

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface StatusTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export function StatusTimeline({
  events,
  loading = false,
}: StatusTimelineProps) {
  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          {[1, 2, 3].map((i) => (
            <SkeletonBodyText key={i} lines={2} />
          ))}
        </BlockStack>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <Text as="p" variant="bodySm" tone="subdued">
          No events yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        {events.map((event) => (
          <Box key={event.id}>
            <BlockStack gap="050">
              <Text as="p" variant="bodyMd" fontWeight="medium">
                {event.message}
              </Text>
              <InlineStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">
                  {formatTimestamp(event.timestamp)}
                </Text>
                {event.actor && (
                  <>
                    <Text as="span" variant="bodySm" tone="subdued">
                      &middot;
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {event.actor}
                    </Text>
                  </>
                )}
              </InlineStack>
            </BlockStack>
          </Box>
        ))}
      </BlockStack>
    </Card>
  );
}

// --- Helpers ---

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
