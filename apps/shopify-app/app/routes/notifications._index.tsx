/**
 * Notification Templates — Manage notification templates across channels.
 *
 * Features:
 *   - Card layout per template (channel badge, event type, preview)
 *   - Template name, subject line (email), body preview (truncated, 100 chars)
 *   - Variables highlighted in templates
 *   - Active/Inactive status + version number
 *   - Actions: Edit, Preview, Duplicate, Deactivate
 *   - Filters: channel, eventType, isActive
 *   - Create Template button
 *   - Empty state
 *
 * Data is loaded server-side via the loader from /api/v4/notification-templates.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Pagination,
  Select,
  Button,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Box,
  Collapsible,
  ButtonGroup,
  InlineGrid,
} from "@shopify/polaris";
import { createApiClientFromRequest, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface NotificationTemplate {
  id: string;
  name: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK";
  eventType: string;
  subjectLine?: string;
  bodyTemplate: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface NotificationsPageData {
  templates: NotificationTemplate[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "PUSH", "WEBHOOK"];

const CHANNEL_BADGE_TONE: Record<string, "info" | "warning" | "success" | "critical" | undefined> = {
  EMAIL: "info",
  SMS: "warning",
  WHATSAPP: "success",
  PUSH: "critical",
  WEBHOOK: undefined,
};

const EVENT_TYPES = [
  "order.created",
  "order.confirmed",
  "shipment.created",
  "shipment.delivered",
  "shipment.failed",
  "driver.assigned",
  "route.optimized",
];

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const channel = url.searchParams.get("channel") ?? undefined;
  const eventType = url.searchParams.get("eventType") ?? undefined;
  const isActive = url.searchParams.get("isActive")
    ? url.searchParams.get("isActive") === "true"
    : undefined;

  try {
    const response = await api.get<PaginatedResponse<NotificationTemplate>>(
      "/api/v4/notification-templates",
      {
        page,
        limit,
        channel,
        eventType,
        isActive,
      },
    );

    return { templates: response.data, meta: response.meta };
  } catch {
    return { templates: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
  }
}

// ─── Component ─────────────────────────────────────────────

export default function NotificationsList() {
  const { templates, meta } = useLoaderData<NotificationsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentChannel = searchParams.get("channel") ?? "";
  const currentEventType = searchParams.get("eventType") ?? "";
  const currentIsActive = searchParams.get("isActive") ?? "";

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1");
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  const hasActiveFilters = currentChannel || currentEventType || currentIsActive;

  const channelOptions = [
    { label: "All Channels", value: "" },
    ...CHANNELS.map((channel) => ({ label: channel, value: channel })),
  ];

  const eventTypeOptions = [
    { label: "All Events", value: "" },
    ...EVENT_TYPES.map((type) => ({ label: type, value: type })),
  ];

  const statusOptions = [
    { label: "All Status", value: "" },
    { label: "Active", value: "true" },
    { label: "Inactive", value: "false" },
  ];

  return (
    <Page
      title="Notification Templates"
      subtitle={`${meta.total} template${meta.total !== 1 ? "s" : ""} available`}
      primaryAction={{ content: "Create Template", url: "/notifications/new" }}
    >
      <BlockStack gap="400">
        {/* Filters */}
        <Card>
          <InlineStack gap="300" wrap>
            <Select
              label="Channel"
              options={channelOptions}
              value={currentChannel}
              onChange={(value) => updateFilter("channel", value)}
            />
            <Select
              label="Event Type"
              options={eventTypeOptions}
              value={currentEventType}
              onChange={(value) => updateFilter("eventType", value)}
            />
            <Select
              label="Status"
              options={statusOptions}
              value={currentIsActive}
              onChange={(value) => updateFilter("isActive", value)}
            />
            {hasActiveFilters && (
              <Box paddingBlockStart="600">
                <Button
                  variant="plain"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  Clear Filters
                </Button>
              </Box>
            )}
          </InlineStack>
        </Card>

        {/* Templates */}
        {templates.length === 0 ? (
          <Card>
            <EmptyState
              heading="No notification templates"
              action={
                hasActiveFilters
                  ? undefined
                  : { content: "Create Template", url: "/notifications/new" }
              }
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {hasActiveFilters
                  ? "No templates match your filters. Try adjusting your selection."
                  : "Create your first notification template to get started."}
              </p>
            </EmptyState>
          </Card>
        ) : (
          <>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </InlineGrid>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <Box paddingBlockStart="400" paddingBlockEnd="400">
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={meta.page > 1}
                    onPrevious={() => goToPage(meta.page - 1)}
                    hasNext={meta.page < meta.totalPages}
                    onNext={() => goToPage(meta.page + 1)}
                  />
                </InlineStack>
              </Box>
            )}
          </>
        )}
      </BlockStack>
    </Page>
  );
}

// ─── Template Card Component ───────────────────────────────

function TemplateCard({ template }: { template: NotificationTemplate }) {
  const [showPreview, setShowPreview] = useState(false);

  const bodyPreview =
    template.bodyTemplate.length > 100
      ? template.bodyTemplate.substring(0, 100) + "\u2026"
      : template.bodyTemplate;

  return (
    <Card>
      <BlockStack gap="300">
        {/* Header */}
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm" fontWeight="semibold">
            {template.name}
          </Text>
          <InlineStack gap="200" wrap>
            <Badge tone={CHANNEL_BADGE_TONE[template.channel]}>
              {template.channel}
            </Badge>
            <Badge>{`v${template.version}`}</Badge>
            <Badge tone={template.isActive ? "success" : "critical"}>
              {template.isActive ? "Active" : "Inactive"}
            </Badge>
          </InlineStack>
        </BlockStack>

        {/* Event Type */}
        <BlockStack gap="100">
          <Text as="span" variant="bodySm" tone="subdued">
            Event
          </Text>
          <Text as="span" variant="bodyMd">
            {template.eventType}
          </Text>
        </BlockStack>

        {/* Subject Line (Email only) */}
        {template.subjectLine && (
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              Subject
            </Text>
            <Text as="span" variant="bodyMd">
              {template.subjectLine}
            </Text>
          </BlockStack>
        )}

        {/* Body Preview */}
        <BlockStack gap="200">
          <Text as="span" variant="bodySm" tone="subdued">
            Template Preview
          </Text>
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <Text as="p" variant="bodySm">
              {bodyPreview}
            </Text>
          </Box>
          <Collapsible open={showPreview} id={`preview-${template.id}`}>
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <Text as="p" variant="bodySm" breakWord>
                {template.bodyTemplate}
              </Text>
            </Box>
          </Collapsible>
        </BlockStack>

        {/* Actions */}
        <InlineStack gap="200" wrap>
          <Button url={`/notifications/${template.id}/edit`} variant="primary" size="slim">
            Edit
          </Button>
          <Button onClick={() => setShowPreview(!showPreview)} size="slim">
            {showPreview ? "Hide" : "Preview"}
          </Button>
          <Button url={`/notifications/${template.id}/duplicate`} size="slim">
            Duplicate
          </Button>
          <Button
            url={`/notifications/${template.id}/toggle`}
            tone={template.isActive ? "critical" : undefined}
            size="slim"
          >
            {template.isActive ? "Deactivate" : "Activate"}
          </Button>
        </InlineStack>

        {/* Footer */}
        <Text as="span" variant="bodySm" tone="subdued">
          Updated {formatDate(template.updatedAt)}
        </Text>
      </BlockStack>
    </Card>
  );
}

// ─── Utility Functions ─────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
