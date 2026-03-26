/**
 * Shipping Profiles Index — Configure shipping profiles and rates.
 *
 * Features:
 *   - Card list layout showing each profile
 *   - Profile name + delivery method badge (LOCAL_DELIVERY, STORE_PICKUP, STANDARD_SHIPPING, EXPRESS_SHIPPING, SAME_DAY)
 *   - Rate type: FLAT, WEIGHT_BASED, DISTANCE_BASED, TIERED
 *   - Base rate, currency
 *   - Linked locations count
 *   - Active/Inactive status
 *   - "Edit" and "Duplicate" action buttons
 *   - Filter: delivery method, rate type, active status
 *   - "Create Profile" button in header
 *   - Empty state when no profiles
 *   - Link to detail/edit: `/shipping-profiles/:id`
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface ShippingProfile {
  id: string;
  name: string;
  deliveryMethod: string; // LOCAL_DELIVERY | STORE_PICKUP | STANDARD_SHIPPING | EXPRESS_SHIPPING | SAME_DAY
  rateType: string; // FLAT | WEIGHT_BASED | DISTANCE_BASED | TIERED
  baseRate: number;
  currency: string;
  linkedLocationsCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ShippingProfilesPageData {
  profiles: ShippingProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const DELIVERY_METHODS = [
  "LOCAL_DELIVERY",
  "STORE_PICKUP",
  "STANDARD_SHIPPING",
  "EXPRESS_SHIPPING",
  "SAME_DAY",
];

const RATE_TYPES = ["FLAT", "WEIGHT_BASED", "DISTANCE_BASED", "TIERED"];

const DELIVERY_METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  LOCAL_DELIVERY: { bg: "#ccf1e2", text: "#005c35" },
  STORE_PICKUP: { bg: "#e8f0fe", text: "#1a3a6e" },
  STANDARD_SHIPPING: { bg: "#fce8e6", text: "#a40e0e" },
  EXPRESS_SHIPPING: { bg: "#fff8dc", text: "#7a6600" },
  SAME_DAY: { bg: "#f3e5f5", text: "#4a0e4e" },
};

const RATE_TYPE_LABELS: Record<string, string> = {
  FLAT: "Flat Rate",
  WEIGHT_BASED: "Weight Based",
  DISTANCE_BASED: "Distance Based",
  TIERED: "Tiered Pricing",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const deliveryMethod = url.searchParams.get("deliveryMethod") ?? undefined;
  const rateType = url.searchParams.get("rateType") ?? undefined;
  const activeStatus = url.searchParams.get("activeStatus") ?? undefined;

  const response = await api.get<PaginatedResponse<ShippingProfile>>(
    "/api/v4/shipping-profiles",
    {
      page,
      limit,
      deliveryMethod,
      rateType,
      activeStatus,
    }
  );

  return { profiles: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function ShippingProfilesList() {
  const { profiles, meta } = useLoaderData<ShippingProfilesPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const currentDeliveryMethod = searchParams.get("deliveryMethod") ?? "";
  const currentRateType = searchParams.get("rateType") ?? "";
  const currentActiveStatus = searchParams.get("activeStatus") ?? "";
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

  const formatCurrency = (amount: number, currency: string): string => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getCurrencySymbol = (code: string): string => {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      CAD: "C$",
      AUD: "A$",
      JPY: "¥",
    };
    return symbols[code] ?? code;
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={headingStyle}>Shipping Profiles</h1>
          <p style={subtextStyle}>{meta.total} total profiles</p>
        </div>
        <Link to="/shipping-profiles/new" style={primaryBtnStyle}>
          Create Profile
        </Link>
      </div>

      {/* Filters */}
      <div style={filtersStyle}>
        <select
          value={currentDeliveryMethod}
          onChange={(e) => updateFilter("deliveryMethod", e.target.value)}
          style={selectStyle}
        >
          <option value="">All delivery methods</option>
          {DELIVERY_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          value={currentRateType}
          onChange={(e) => updateFilter("rateType", e.target.value)}
          style={selectStyle}
        >
          <option value="">All rate types</option>
          {RATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {RATE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={currentActiveStatus}
          onChange={(e) => updateFilter("activeStatus", e.target.value)}
          style={selectStyle}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Content */}
      {profiles.length === 0 ? (
        <EmptyState
          title="No shipping profiles found"
          description={
            currentDeliveryMethod || currentRateType || currentActiveStatus
              ? "Try adjusting your filters."
              : "Create shipping profiles to define rates and delivery methods for your locations."
          }
          actionLabel="Create Profile"
          onAction={() => {
            /* navigate to create */
          }}
        />
      ) : (
        <>
          {/* Profile List */}
          <div style={listStyle}>
            {profiles.map((profile) => (
              <div key={profile.id} style={listItemStyle}>
                {/* Left Section */}
                <div style={listItemLeftStyle}>
                  <div style={listItemHeaderStyle}>
                    <h3 style={listItemTitleStyle}>{profile.name}</h3>
                    <DeliveryMethodBadge method={profile.deliveryMethod} />
                  </div>

                  {/* Rate Type and Base Rate */}
                  <div style={listItemRowStyle}>
                    <div style={listItemColumnStyle}>
                      <span style={labelStyle}>Rate Type</span>
                      <span style={valueStyle}>
                        {RATE_TYPE_LABELS[profile.rateType]}
                      </span>
                    </div>
                    <div style={listItemColumnStyle}>
                      <span style={labelStyle}>Base Rate</span>
                      <span style={valueStyle}>
                        {formatCurrency(profile.baseRate, profile.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Linked Locations Count */}
                  <div style={listItemRowStyle}>
                    <div style={listItemColumnStyle}>
                      <span style={labelStyle}>Linked Locations</span>
                      <span style={valueStyle}>
                        {profile.linkedLocationsCount}{" "}
                        <span style={subtextSmallStyle}>
                          location{profile.linkedLocationsCount !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Section - Status & Actions */}
                <div style={listItemRightStyle}>
                  {/* Status */}
                  <div style={statusContainerStyle}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: profile.isActive ? "#34a853" : "#9aa0a6",
                      }}
                    />
                    <span style={cellSubStyle}>
                      {profile.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div style={listItemActionsStyle}>
                    <Link
                      to={`/shipping-profiles/${profile.id}`}
                      style={secondaryBtnSmallStyle}
                    >
                      Edit
                    </Link>
                    <button
                      style={secondaryBtnSmallStyle}
                      onClick={() => setDuplicatingId(profile.id)}
                      type="button"
                    >
                      Duplicate
                    </button>
                  </div>
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

      {/* Duplicate Confirmation Modal */}
      {duplicatingId && (
        <ConfirmModal
          title="Duplicate Profile?"
          message="A copy of this profile will be created with all the same settings."
          actionLabel="Duplicate"
          onConfirm={() => {
            // Call duplicate API
            setDuplicatingId(null);
          }}
          onCancel={() => setDuplicatingId(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function DeliveryMethodBadge({ method }: { method: string }) {
  const colors = DELIVERY_METHOD_COLORS[method] ?? {
    bg: "#f1f2f3",
    text: "#6d7175",
  };
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
      {method.replace(/_/g, " ")}
    </span>
  );
}

function ConfirmModal({
  title,
  message,
  actionLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>
          {title}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--p-color-text-subdued, #6d7175)",
            margin: "0 0 20px",
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={primaryBtnStyle}>
            {actionLabel}
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

const subtextSmallStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  marginLeft: 4,
};

const filtersStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  flexWrap: "wrap",
};

const selectStyle: React.CSSProperties = {
  flex: "0 1 auto",
  minWidth: 200,
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  backgroundColor: "white",
  cursor: "pointer",
  boxSizing: "border-box" as const,
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginBottom: 24,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  backgroundColor: "white",
  borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  padding: 16,
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
  gap: 16,
};

const listItemLeftStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const listItemHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const listItemTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: 0,
  flex: 1,
};

const listItemRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 24,
};

const listItemColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text, #202223)",
};

const cellSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const listItemRightStyle: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  alignItems: "flex-end",
};

const statusContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const listItemActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
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
