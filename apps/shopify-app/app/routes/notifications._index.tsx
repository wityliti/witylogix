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
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
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

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  EMAIL: { bg: "#e8f0fe", text: "#1a3a6e" },
  SMS: { bg: "#fff3cd", text: "#856404" },
  WHATSAPP: { bg: "#d4f5e9", text: "#0a5c4a" },
  PUSH: { bg: "#ffe0e6", text: "#5e0620" },
  WEBHOOK: { bg: "#f0f0f0", text: "#333333" },
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
  const api = createApiClient(session.accessToken!);

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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Notification Templates</h1>
          <p style={subtextStyle}>
            {meta.total} template{meta.total !== 1 ? "s" : ""} available
          </p>
        </div>
        <Link to="/notifications/new" style={createButtonStyle}>
          Create Template
        </Link>
      </div>

      {/* Filters */}
      <div style={filtersContainerStyle}>
        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Channel</label>
          <select
            value={currentChannel}
            onChange={(e) => updateFilter("channel", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Channels</option>
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Event Type</label>
          <select
            value={currentEventType}
            onChange={(e) => updateFilter("eventType", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Events</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>Status</label>
          <select
            value={currentIsActive}
            onChange={(e) => updateFilter("isActive", e.target.value)}
            style={filterSelectStyle}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
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

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <EmptyState
          title="No notification templates"
          description={
            hasActiveFilters
              ? "No templates match your filters. Try adjusting your selection."
              : "Create your first notification template to get started."
          }
          actionLabel="Create Template"
          actionUrl="/notifications/new"
        />
      ) : (
        <>
          <div style={templatesGridStyle}>
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
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
                      ...(page === meta.page ? paginationButtonActiveStyle : {}),
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

// ─── Template Card Component ───────────────────────────────

function TemplateCard({ template }: { template: NotificationTemplate }) {
  const [showPreview, setShowPreview] = useState(false);
  const colors = CHANNEL_COLORS[template.channel];

  // Truncate and highlight variables in body
  const bodyPreview = truncateWithVariables(template.bodyTemplate, 100);

  return (
    <div style={templateCardStyle}>
      {/* Header */}
      <div style={cardHeaderStyle}>
        <div style={{ flex: 1 }}>
          <h3 style={templateNameStyle}>{template.name}</h3>
          <div style={metaRowStyle}>
            <span
              style={{
                ...channelBadgeStyle,
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            >
              {template.channel}
            </span>
            <span style={versionBadgeStyle}>v{template.version}</span>
            <span
              style={{
                ...statusBadgeStyle,
                ...(template.isActive
                  ? { backgroundColor: "#d4edda", color: "#155724" }
                  : { backgroundColor: "#f8d7da", color: "#721c24" }),
              }}
            >
              {template.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Event Type */}
      <div style={cardSectionStyle}>
        <p style={cardLabelStyle}>Event</p>
        <p style={cardValueStyle}>{template.eventType}</p>
      </div>

      {/* Subject Line (Email only) */}
      {template.subjectLine && (
        <div style={cardSectionStyle}>
          <p style={cardLabelStyle}>Subject</p>
          <p style={cardValueStyle}>{template.subjectLine}</p>
        </div>
      )}

      {/* Body Preview */}
      <div style={cardSectionStyle}>
        <p style={cardLabelStyle}>Template Preview</p>
        <div style={bodyPreviewStyle}>
          <div
            style={bodyPreviewTextStyle}
            dangerouslySetInnerHTML={{ __html: bodyPreview }}
          />
        </div>
        {showPreview && (
          <details open style={collapsibleStyle}>
            <summary style={summaryStyle}>Full Template</summary>
            <div
              style={fullPreviewStyle}
              dangerouslySetInnerHTML={{
                __html: highlightVariables(template.bodyTemplate),
              }}
            />
          </details>
        )}
      </div>

      {/* Actions */}
      <div style={actionsStyle}>
        <Link
          to={`/notifications/${template.id}/edit`}
          style={{
            ...actionButtonStyle,
            backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
            color: "white",
          }}
        >
          Edit
        </Link>
        <button
          onClick={() => setShowPreview(!showPreview)}
          style={{
            ...actionButtonStyle,
            backgroundColor: "var(--p-color-bg-surface, white)",
            color: "var(--p-color-text, #202223)",
            border: "1px solid var(--p-color-border, #c9cccf)",
          }}
        >
          Preview
        </button>
        <Link
          to={`/notifications/${template.id}/duplicate`}
          style={{
            ...actionButtonStyle,
            backgroundColor: "var(--p-color-bg-surface, white)",
            color: "var(--p-color-text, #202223)",
            border: "1px solid var(--p-color-border, #c9cccf)",
          }}
        >
          Duplicate
        </Link>
        <Link
          to={`/notifications/${template.id}/toggle`}
          style={{
            ...actionButtonStyle,
            backgroundColor: template.isActive ? "#fee" : "#efe",
            color: template.isActive ? "#c33" : "#3c3",
            border: "1px solid var(--p-color-border, #c9cccf)",
          }}
        >
          {template.isActive ? "Deactivate" : "Activate"}
        </Link>
      </div>

      {/* Footer */}
      <div style={cardFooterStyle}>
        <span style={footerTextStyle}>
          Updated {formatDate(template.updatedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Utility Functions ─────────────────────────────────────

function highlightVariables(text: string): string {
  // Highlight {{variable}} patterns
  return text.replace(
    /\{\{([^}]+)\}\}/g,
    '<span style="background-color: #fff3cd; padding: 2px 4px; border-radius: 3px; font-weight: 600;">{{$1}}</span>',
  );
}

function truncateWithVariables(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return highlightVariables(text);
  }
  return highlightVariables(text.substring(0, maxLength) + "…");
}

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

const createButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  textDecoration: "none",
};

const filtersContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  alignItems: "flex-end",
  flexWrap: "wrap",
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

const templatesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: 16,
  marginBottom: 32,
};

const templateCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  boxShadow: "var(--p-shadow-sm, 0 1px 0 rgba(0,0,0,.05))",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const templateNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 8px",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const channelBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
};

const versionBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: "var(--p-color-bg-surface, white)",
  color: "var(--p-color-text-subdued, #6d7175)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 4,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
};

const cardSectionStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "0 0 6px",
};

const cardValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
  margin: 0,
  wordBreak: "break-word",
};

const bodyPreviewStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  padding: 8,
  borderRadius: 4,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  marginBottom: 8,
};

const bodyPreviewTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text, #202223)",
  lineHeight: "1.4",
  margin: 0,
};

const collapsibleStyle: React.CSSProperties = {
  marginTop: 8,
};

const summaryStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-primary, #006fbb)",
  cursor: "pointer",
  padding: "4px 0",
};

const fullPreviewStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  padding: 8,
  borderRadius: 4,
  marginTop: 8,
  fontSize: 12,
  color: "var(--p-color-text, #202223)",
  lineHeight: "1.5",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: "12px 16px",
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 4,
  cursor: "pointer",
  textDecoration: "none",
  textAlign: "center",
  transition: "all 0.2s ease",
};

const cardFooterStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "var(--p-color-bg-surface-secondary, #fafbfc)",
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  fontSize: 11,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const footerTextStyle: React.CSSProperties = {
  margin: 0,
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
