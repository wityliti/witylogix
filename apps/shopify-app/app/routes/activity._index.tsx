/**
 * Activity Log — Timeline view of all system events and changes.
 *
 * Features:
 *   - Timeline view (vertical) showing events:
 *     - Timestamp (relative: "2m ago", "1h ago")
 *     - Action icon/color (created=green, updated=blue, deleted=red, status_changed=amber)
 *     - Actor name + role
 *     - Entity type + entity ID (linkable)
 *     - Changes JSON (collapsible, show key differences)
 *   - Filters: entityType, action, actorType, dateFrom/dateTo
 *   - Pagination
 *   - Empty state
 *
 * Data is loaded server-side via the loader from /api/v4/activity-logs.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Pagination,
  Select,
  TextField,
  InlineStack,
  BlockStack,
  Text,
  Button,
  EmptyState,
  Box,
  Collapsible,
  InlineGrid,
} from "@shopify/polaris";
import {
  createApiClientFromRequest,
  type PaginatedResponse,
} from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Change {
  [key: string]: {
    before?: unknown;
    after?: unknown;
  };
}

interface ActivityLogEntry {
  id: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  entityType:
    | "order"
    | "shipment"
    | "driver"
    | "location"
    | "route"
    | "setting";
  entityId: string;
  entityName?: string;
  actor: {
    id: string;
    name: string;
    type: "user" | "system" | "api";
    role?: string;
  };
  changes: Change;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityPageData {
  logs: ActivityLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ENTITY_TYPES = [
  "order",
  "shipment",
  "driver",
  "location",
  "route",
  "setting",
];

const ACTIONS = ["created", "updated", "deleted", "status_changed"];

const ACTOR_TYPES = ["user", "system", "api"];

const ACTION_CONFIG: Record<
  string,
  {
    icon: string;
    label: string;
    tone: "success" | "info" | "critical" | "warning";
  }
> = {
  created: { icon: "+", label: "Created", tone: "success" },
  updated: { icon: "~", label: "Updated", tone: "info" },
  deleted: { icon: "x", label: "Deleted", tone: "critical" },
  status_changed: { icon: "~", label: "Status Changed", tone: "warning" },
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;
  const actorType = url.searchParams.get("actorType") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  try {
    const response = await api.get<PaginatedResponse<ActivityLogEntry>>(
      "/api/v4/activity-logs",
      {
        page,
        limit,
        entityType,
        action,
        actorType,
        dateFrom,
        dateTo,
      },
    );

    return { logs: response.data, meta: response.meta };
  } catch {
    return { logs: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
  }
}

// ─── Component ─────────────────────────────────────────────

export default function ActivityLog() {
  const { logs, meta } = useLoaderData<ActivityPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentEntityType = searchParams.get("entityType") ?? "";
  const currentAction = searchParams.get("action") ?? "";
  const currentActorType = searchParams.get("actorType") ?? "";
  const currentDateFrom = searchParams.get("dateFrom") ?? "";
  const currentDateTo = searchParams.get("dateTo") ?? "";

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.set("page", "1");
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const goToPage = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(page));
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const hasActiveFilters =
    currentEntityType ||
    currentAction ||
    currentActorType ||
    currentDateFrom ||
    currentDateTo;

  const entityTypeOptions = [
    { label: "All Types", value: "" },
    ...ENTITY_TYPES.map((type) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      value: type,
    })),
  ];

  const actionOptions = [
    { label: "All Actions", value: "" },
    ...ACTIONS.map((action) => ({
      label: ACTION_CONFIG[action].label,
      value: action,
    })),
  ];

  const actorTypeOptions = [
    { label: "All Actors", value: "" },
    ...ACTOR_TYPES.map((type) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      value: type,
    })),
  ];

  const resourceName = {
    singular: "activity event",
    plural: "activity events",
  };

  const rowMarkup = logs.map((log, index) => (
    <ActivityLogRow key={log.id} log={log} index={index} />
  ));

  return (
    <Page
      title="Activity Log"
      subtitle={`${meta.total} event${meta.total !== 1 ? "s" : ""} recorded`}
    >
      <BlockStack gap="400">
        <Card>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="300">
            <Select
              label="Entity Type"
              options={entityTypeOptions}
              value={currentEntityType}
              onChange={(value) => updateFilter("entityType", value)}
            />
            <Select
              label="Action"
              options={actionOptions}
              value={currentAction}
              onChange={(value) => updateFilter("action", value)}
            />
            <Select
              label="Actor Type"
              options={actorTypeOptions}
              value={currentActorType}
              onChange={(value) => updateFilter("actorType", value)}
            />
            <TextField
              label="From"
              type="date"
              value={currentDateFrom}
              onChange={(value) => updateFilter("dateFrom", value)}
              autoComplete="off"
            />
            <TextField
              label="To"
              type="date"
              value={currentDateTo}
              onChange={(value) => updateFilter("dateTo", value)}
              autoComplete="off"
            />
          </InlineGrid>
          {hasActiveFilters && (
            <Box paddingBlockStart="300">
              <Button
                variant="plain"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                Clear Filters
              </Button>
            </Box>
          )}
        </Card>

        {logs.length === 0 ? (
          <Card>
            <EmptyState
              heading="No activity recorded"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                {hasActiveFilters
                  ? "No events match your filters. Try adjusting your selection."
                  : "No activity has been recorded yet."}
              </p>
            </EmptyState>
          </Card>
        ) : (
          <>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={logs.length}
                headings={[
                  { title: "Event" },
                  { title: "Actor" },
                  { title: "Entity" },
                  { title: "Time" },
                  { title: "Changes" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>

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

// ─── Activity Log Row Component ───────────────────────────

function ActivityLogRow({
  log,
  index,
}: {
  log: ActivityLogEntry;
  index: number;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const config = ACTION_CONFIG[log.action];
  const relativeTime = formatRelativeTime(log.timestamp);
  const hasChanges = Object.keys(log.changes).length > 0;

  return (
    <IndexTable.Row id={log.id} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="200" align="center" blockAlign="center">
          <Badge tone={config.tone}>{config.label}</Badge>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {log.actor.name || "System"}
          </Text>
          <Badge tone={log.actor.type === "system" ? "info" : undefined}>
            {log.actor.type.charAt(0).toUpperCase() + log.actor.type.slice(1)}
          </Badge>
          {log.actor.role && (
            <Text as="span" variant="bodySm" tone="subdued">
              Role: {log.actor.role}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center">
          <Badge>{log.entityType}</Badge>
          <Link to={`/${log.entityType}s/${log.entityId}`}>
            <Text as="span" variant="bodyMd" fontWeight="semibold" tone="magic">
              {log.entityName || log.entityId}
            </Text>
          </Link>
          <Text as="span" variant="bodySm" tone="subdued">
            #{log.entityId}
          </Text>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {relativeTime}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {hasChanges ? (
          <BlockStack gap="200">
            <Button
              variant="plain"
              onClick={() => setShowChanges(!showChanges)}
              size="slim"
            >
              {showChanges ? "Hide" : "Show"} changes (
              {Object.keys(log.changes).length} field
              {Object.keys(log.changes).length !== 1 ? "s" : ""})
            </Button>
            <Collapsible open={showChanges} id={`changes-${log.id}`}>
              <BlockStack gap="200">
                {Object.entries(log.changes).map(([field, values]) => (
                  <Box
                    key={field}
                    padding="200"
                    background="bg-surface-secondary"
                    borderRadius="100"
                  >
                    <BlockStack gap="100">
                      <Text
                        as="span"
                        variant="bodySm"
                        fontWeight="semibold"
                        tone="subdued"
                      >
                        {field}
                      </Text>
                      {values.before !== undefined && (
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone="critical">
                            {formatValue(values.before)}
                          </Badge>
                          <Text as="span" variant="bodySm">
                            {" -> "}
                          </Text>
                          <Badge tone="success">
                            {formatValue(values.after)}
                          </Badge>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </Collapsible>
          </BlockStack>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">
            No changes
          </Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}

// ─── Utility Functions ─────────────────────────────────────

function formatRelativeTime(isoString: string): string {
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

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
