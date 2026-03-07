/**
 * Locations Index — Manage warehouse, store, hub, and drop-point locations.
 *
 * Features:
 *   - Card grid layout (3-column) showing each location
 *   - Location name, type badge (WAREHOUSE, STORE, HUB, DROP_POINT)
 *   - Address (line1, line2, city, state, zip)
 *   - Operating hours summary
 *   - Active/Inactive status
 *   - "Edit" and "Deactivate" action buttons
 *   - Search bar + type filter dropdown
 *   - "Add Location" button in header
 *   - Empty state when no locations
 *   - Link to detail/edit: `/locations/:id`
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  type: string; // WAREHOUSE | STORE | HUB | DROP_POINT
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
  operatingHours?: Array<{
    day: string;
    open?: string;
    close?: string;
    closed?: boolean;
  }>;
  isActive: boolean;
  createdAt?: string;
}

interface LocationsPageData {
  locations: Location[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const LOCATION_TYPES = ["WAREHOUSE", "STORE", "HUB", "DROP_POINT"];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  WAREHOUSE: { bg: "#e8f0fe", text: "#1a3a6e" },
  STORE: { bg: "#ccf1e2", text: "#005c35" },
  HUB: { bg: "#fce8e6", text: "#a40e0e" },
  DROP_POINT: { bg: "#fff8dc", text: "#7a6600" },
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const type = url.searchParams.get("type") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  const response = await api.get<PaginatedResponse<Location>>("/api/v4/locations", {
    page,
    limit,
    type,
    search,
  });

  return { locations: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function LocationsList() {
  const { locations, meta } = useLoaderData<LocationsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const currentSearch = searchParams.get("search") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentPage = meta.page;

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

  const formatAddress = (location: Location): string => {
    const parts = [location.line1];
    if (location.line2) parts.push(location.line2);
    parts.push(`${location.city}, ${location.state} ${location.zip}`);
    return parts.join(", ");
  };

  const getOperatingHoursSummary = (location: Location): string => {
    if (!location.operatingHours || location.operatingHours.length === 0) {
      return "Hours not set";
    }
    const openDays = location.operatingHours.filter((h) => !h.closed);
    return openDays.length > 0
      ? `${openDays.length} days/week`
      : "Closed";
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Locations</h1>
          <p style={subtextStyle}>{meta.total} total locations</p>
        </div>
        <Link to="/locations/new" style={primaryBtnStyle}>
          Add Location
        </Link>
      </div>

      {/* Filters */}
      <div style={filtersStyle}>
        <input
          type="text"
          placeholder="Search locations..."
          value={currentSearch}
          onChange={(e) => updateFilter("search", e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={currentType}
          onChange={(e) => updateFilter("type", e.target.value)}
          style={selectStyle}
        >
          <option value="">All types</option>
          {LOCATION_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {locations.length === 0 ? (
        <EmptyState
          title="No locations found"
          description={
            currentSearch || currentType
              ? "Try adjusting your filters."
              : "Add locations to manage warehouses, stores, hubs, and drop points."
          }
          actionLabel="Add Location"
          onAction={() => {
            /* navigate to add */
          }}
        />
      ) : (
        <>
          {/* Card Grid */}
          <div style={gridStyle}>
            {locations.map((location) => (
              <div key={location.id} style={cardStyle}>
                {/* Card Header */}
                <div style={cardHeaderStyle}>
                  <h3 style={cardTitleStyle}>{location.name}</h3>
                  <TypeBadge type={location.type} />
                </div>

                {/* Address */}
                <div style={cardSectionStyle}>
                  <p style={addressStyle}>{formatAddress(location)}</p>
                </div>

                {/* Operating Hours */}
                <div style={cardSectionStyle}>
                  <p style={sectionLabelStyle}>Operating Hours</p>
                  <p style={cellSubStyle}>{getOperatingHoursSummary(location)}</p>
                </div>

                {/* Status */}
                <div style={cardSectionStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: location.isActive
                          ? "#34a853"
                          : "#9aa0a6",
                      }}
                    />
                    <span style={cellSubStyle}>
                      {location.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={cardActionsStyle}>
                  <Link to={`/locations/${location.id}`} style={secondaryBtnSmallStyle}>
                    Edit
                  </Link>
                  <button
                    style={dangerBtnSmallStyle}
                    onClick={() => setDeactivatingId(location.id)}
                    type="button"
                  >
                    {location.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div style={paginationStyle}>
              <span style={subtextStyle}>
                Page {currentPage} of {meta.totalPages}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  style={pageBtnStyle}
                  type="button"
                >
                  Previous
                </button>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= meta.totalPages}
                  style={pageBtnStyle}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingId && (
        <ConfirmModal
          title="Deactivate Location?"
          message="This location will no longer be available for orders and assignments."
          onConfirm={() => {
            // Call deactivate API
            setDeactivatingId(null);
          }}
          onCancel={() => setDeactivatingId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? { bg: "#f1f2f3", text: "#6d7175" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 20,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--p-color-text-subdued, #6d7175)", margin: "0 0 20px" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={dangerBtnStyle}>
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 0 16px",
};

const headingStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  margin: 0,
};

const subtextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "4px 0 0",
};

const filtersStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
};

const searchInputStyle: React.CSSProperties = {
  flex: "1 1 200px",
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  backgroundColor: "white",
  boxSizing: "border-box" as const,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  backgroundColor: "white",
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
  transition: "box-shadow 0.2s",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
  flex: 1,
};

const cardSectionStyle: React.CSSProperties = {
  paddingTop: 8,
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const addressStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
  margin: 0,
  lineHeight: 1.5,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  margin: "0 0 4px",
  letterSpacing: "0.5px",
};

const cellSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: 0,
};

const cardActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  paddingTop: 12,
  borderTop: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text, #303030)",
  backgroundColor: "white",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  cursor: "pointer",
};

const secondaryBtnSmallStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--p-color-text, #303030)",
  backgroundColor: "white",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center" as const,
};

const dangerBtnSmallStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "#a40e0e",
  backgroundColor: "#fce8e6",
  border: "1px solid #e8b4b8",
  borderRadius: 6,
  cursor: "pointer",
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "white",
  backgroundColor: "#d32f2f",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 0",
};

const pageBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 6,
  backgroundColor: "white",
  cursor: "pointer",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: 400,
  backgroundColor: "white",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2)",
};
