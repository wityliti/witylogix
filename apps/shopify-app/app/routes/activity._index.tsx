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
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
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
  entityType: "order" | "shipment" | "driver" | "location" | "route" | "setting";
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
  { icon: string; color: string; label: string }
> = {
  created: { icon: "✚", color: "#28a745", label: "Created" },
  updated: { icon: "✎", color: "#007bff", label: "Updated" },
  deleted: { icon: "✕", color: "#dc3545", label: "Deleted" },
  status_changed: { icon: "⟳", color: "#ffc107", label: "Status Changed" },
};

const ENTITY_COLORS: Record<string, string> = {
  order: "#e8f0fe",
  shipment: "#fff3cd",
  driver: "#d4edda",
  location: "#d1ecf1",
  route: "#e2e3e5",
  setting: "#f8f9fa",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

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

  const hasActiveFilters =
    currentEntityType ||
    currentAction ||
    currentActorType ||
    currentDateFrom ||
    currentDateTo;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Activity Log</h1>
          <p style={subtextStyle}>
            {meta.total} event{meta.total !== 1 ? "s" : ""} recorded
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={filtersContainerStyle}>
        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Entity Type</label>
          <select
            value={currentEntityType}
            onChange={(e) => updateFilter("entityType", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Types</option>
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Action</label>
          <select
            value={currentAction}
            onChange={(e) => updateFilter("action", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_CONFIG[action].label}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Actor Type</label>
          <select
            value={currentActorType}
            onChange={(e) => updateFilter("actorType", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Actors</option>
            {ACTOR_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>From</label>
          <input
            type="date"
            value={currentDateFrom}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            style={filterSelectStyle}
          />
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>To</label>
          <input
            type="date"
            value={currentDateTo}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            style={filterSelectStyle}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
            style={clearFiltersStyle}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Activity Timeline */}
      {logs.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          description={
            hasActiveFilters
              ? "No events match your filters. Try adjusting your selection."
              : "No activity has been recorded yet."
          }
        />
      ) : (
        <>
          <div style={timelineStyle}>
            {logs.map((log, index) => (
              <ActivityLogItem
                key={log.id}
                log={log}
                isLast={index === logs.length - 1}
              />
            ))}
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div style={paginationStyle}>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                      ...paginationButtonStyle,
                      ...(page === meta.page
                        ? paginationButtonActiveStyle
                        : {}),
                    }}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Activity Log Item Component ───────────────────────────

function ActivityLogItem({
  log,
  isLast,
}: {
  log: ActivityLogEntry;
  isLast: boolean;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const config = ACTION_CONFIG[log.action];
  const relativeTime = formatRelativeTime(log.timestamp);
  const hasChanges = Object.keys(log.changes).length > 0;

  return (
    <div style={timelineItemStyle}>
      {/* Timeline connector */}
      <div
        style={{
          ...timelineConnectorStyle,
          ...(isLast ? { display: "none" } : {}),
        }}
      />

      {/* Timeline dot */}
      <div
        style={{
          ...timelineDotStyle,
          backgroundColor: config.color,
          borderColor: config.color,
        }}
      >
        <span style={{ fontSize: 14 }}>{config.icon}</span>
      </div>

      {/* Content */}
      <div style={timelineContentStyle}>
        {/* Header */}
        <div style={contentHeaderStyle}>
          <div style={{ flex: 1 }}>
            <h4 style={contentTitleStyle}>
              {log.actor.name || "System"}{" "}
              <span style={actionLabelStyle}>{config.label}</span>
            </h4>
            <p style={contentTimestampStyle}>{relativeTime}</p>
          </div>
          <span style={actorBadgeStyle}>
            {log.actor.type === "system" ? "🤖" : "👤"}{" "}
            {log.actor.type.charAt(0).toUpperCase() + log.actor.type.slice(1)}
          </span>
        </div>

        {/* Entity info */}
        <div style={entityInfoStyle}>
          <span
            style={{
              ...entityTypeBadgeStyle,
              backgroundColor: ENTITY_COLORS[log.entityType],
            }}
          >
            {log.entityType}
          </span>
          <span style={entityIdStyle}>
            <Link
              to={`/${log.entityType}s/${log.entityId}`}
              style={entityIdLinkStyle}
            >
              {log.entityName || log.entityId}
            </Link>
            <span style={entityIdValueStyle}>#{log.entityId}</span>
          </span>
        </div>

        {/* Changes section */}
        {hasChanges && (
          <div style={changesContainerStyle}>
            <button
              onClick={() => setShowChanges(!showChanges)}
              style={changesToggleStyle}
            >
              <span style={{ marginRight: 6 }}>
                {showChanges ? "▼" : "▶"}
              </span>
              Changes ({Object.keys(log.changes).length} field
              {Object.keys(log.changes).length !== 1 ? "s" : ""})
            </button>

            {showChanges && (
              <div style={changesDetailStyle}>
                {Object.entries(log.changes).map(([field, values]) => (
                  <div key={field} style={changeItemStyle}>
                    <div style={changeFieldStyle}>{field}</div>
                    <div style={changeValueStyle}>
                      {values.before !== undefined && (
                        <div style={changeValueRowStyle}>
                          <span style={changeBeforeStyle}>
                            {formatValue(values.before)}
                          </span>
                          <span style={{ margin: "0 8px" }}>→</span>
                          <span style={changeAfterStyle}>
                            {formatValue(values.after)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Role badge if present */}
        {log.actor.role && (
          <div style={roleStyle}>Role: {log.actor.role}</div>
        )}
      </div>
    </div>
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

// ─── Styles ────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 0 16px",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  marginBottom: 24,
};

const headingStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const subtextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "4px 0 0",
};

const filtersContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  alignItems: "flex-end",
  flexWrap: "wrap",
  padding: 16,
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  borderRadius: 8,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const filterGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const filterSelectStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 14,
  color: "var(--p-color-text, #202223)",
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 6,
  cursor: "pointer",
  minWidth: 140,
};

const clearFiltersStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 14,
  color: "var(--p-color-text-primary, #006fbb)",
  backgroundColor: "transparent",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "underline",
};

const timelineStyle: React.CSSProperties = {
  position: "relative",
};

const timelineItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px 1fr",
  gap: 16,
  padding: "16px 0",
  position: "relative",
};

const timelineConnectorStyle: React.CSSProperties = {
  position: "absolute",
  left: 19,
  top: 40,
  bottom: -16,
  width: 2,
  backgroundColor: "var(--p-color-border-subdued, #e1e3e5)",
};

const timelineDotStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: "50%",
  backgroundColor: "white",
  border: "3px solid var(--p-color-border, #c9cccf)",
  flexShrink: 0,
  position: "relative",
  zIndex: 1,
};

const timelineContentStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: 8,
  padding: 16,
};

const contentHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 12,
  gap: 12,
};

const contentTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const actionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  padding: "2px 6px",
  borderRadius: 3,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const contentTimestampStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "4px 0 0",
};

const actorBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  color: "var(--p-color-text, #202223)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 4,
  whiteSpace: "nowrap",
};

const entityInfoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
  flexWrap: "wrap",
};

const entityTypeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
  textTransform: "capitalize",
};

const entityIdStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--p-color-text, #202223)",
};

const entityIdLinkStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--p-color-text-primary, #006fbb)",
  textDecoration: "none",
};

const entityIdValueStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const changesContainerStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const changesToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "4px 0",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-primary, #006fbb)",
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
};

const changesDetailStyle: React.CSSProperties = {
  marginTop: 8,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const changeItemStyle: React.CSSProperties = {
  padding: "8px 10px",
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  borderRadius: 4,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const changeFieldStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

const changeValueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text, #202223)",
};

const changeValueRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const changeBeforeStyle: React.CSSProperties = {
  padding: "2px 6px",
  backgroundColor: "#ffebee",
  borderRadius: 3,
  color: "#c62828",
  fontWeight: 500,
};

const changeAfterStyle: React.CSSProperties = {
  padding: "2px 6px",
  backgroundColor: "#e8f5e9",
  borderRadius: 3,
  color: "#2e7d32",
  fontWeight: 500,
};

const roleStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 8,
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  fontSize: 11,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 6,
  marginTop: 32,
  padding: "16px 0",
};

const paginationButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 14,
  color: "var(--p-color-text-primary, #006fbb)",
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 4,
  cursor: "pointer",
};

const paginationButtonActiveStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  color: "white",
  borderColor: "var(--p-color-bg-fill-brand, #005bd3)",
};
