/**
 * Shipments List — Full-width resource list with filters and pagination.
 *
 * Features:
 *   - Multi-status filter (11 shipment statuses)
 *   - Delivery method and carrier filters
 *   - Search by tracking #, customer name, address
 *   - Date range filter
 *   - Pagination (server-side)
 *   - Row click → shipment detail
 *   - "Create Shipment" button in header
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { ShipmentStatusBadge } from "~/components/ShipmentStatusBadge";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Shipment {
  id: string;
  trackingNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  carrier: string | null;
  deliveryMethod: string | null;
  driverName?: string | null;
  eta: string | null;
  createdAt: string;
}

interface ShipmentsPageData {
  shipments: Shipment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const SHIPMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "LABEL_CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "ATTEMPTED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

const DELIVERY_METHODS = ["STANDARD", "EXPRESS", "OVERNIGHT", "SAME_DAY"];
const CARRIERS = ["FEDEX", "UPS", "USPS", "DHL", "LOCAL"];

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const deliveryMethod = url.searchParams.get("deliveryMethod") ?? undefined;
  const carrier = url.searchParams.get("carrier") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  const response = await api.get<PaginatedResponse<Shipment>>("/api/v4/shipments", {
    page,
    limit,
    status,
    search,
    deliveryMethod,
    carrier,
    dateFrom,
    dateTo,
  });

  return { shipments: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function ShipmentsList() {
  const { shipments, meta } = useLoaderData<ShipmentsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = meta.page;
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={headingStyle}>Shipments</h1>
          <p style={subtextStyle}>{meta.total} total shipments</p>
        </div>
        <Link to="/shipments/new" style={createButtonStyle}>
          Create Shipment
        </Link>
      </div>

      {/* Filters Bar */}
      <div style={filtersBarStyle}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search shipments..."
          value={currentSearch}
          onChange={(e) => updateFilter("search", e.target.value)}
          style={searchInputStyle}
        />

        {/* Status Filter */}
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          style={selectStyle}
        >
          <option value="">All statuses</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {/* Carrier Filter */}
        <select
          value={searchParams.get("carrier") ?? ""}
          onChange={(e) => updateFilter("carrier", e.target.value)}
          style={selectStyle}
        >
          <option value="">All carriers</option>
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Delivery Method Filter */}
        <select
          value={searchParams.get("deliveryMethod") ?? ""}
          onChange={(e) => updateFilter("deliveryMethod", e.target.value)}
          style={selectStyle}
        >
          <option value="">All methods</option>
          {DELIVERY_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {/* Date filters */}
        <input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
          style={selectStyle}
          placeholder="From date"
        />
        <input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          style={selectStyle}
          placeholder="To date"
        />
      </div>

      {/* Shipments Table */}
      {shipments.length === 0 ? (
        <EmptyState
          title="No shipments found"
          description={
            currentSearch || currentStatus
              ? "Try adjusting your filters to find what you're looking for."
              : "Shipments will appear here when they're created."
          }
          actionLabel={currentSearch || currentStatus ? "Clear filters" : undefined}
          onAction={
            currentSearch || currentStatus
              ? () => setSearchParams(new URLSearchParams())
              : undefined
          }
        />
      ) : (
        <>
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Tracking #</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Carrier</th>
                  <th style={thStyle}>Method</th>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>ETA</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link to={`/shipments/${shipment.id}`} style={trackingLinkStyle}>
                        {shipment.trackingNumber}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>
                        {shipment.customerName ?? "—"}
                      </div>
                      <div style={cellSubtext}>
                        {shipment.customerEmail ?? ""}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <ShipmentStatusBadge status={shipment.status} />
                    </td>
                    <td style={tdStyle}>
                      {shipment.carrier ?? "—"}
                    </td>
                    <td style={tdStyle}>
                      {shipment.deliveryMethod ? shipment.deliveryMethod.replace(/_/g, " ") : "—"}
                    </td>
                    <td style={tdStyle}>
                      {shipment.driverName ?? (
                        <span style={cellSubtext}>Unassigned</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {shipment.eta
                        ? new Date(shipment.eta).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
                          )
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {new Date(shipment.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={paginationStyle}>
            <span style={subtextStyle}>
              Page {currentPage} of {meta.totalPages} ({meta.total} shipments)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                style={paginationButtonStyle}
                type="button"
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= meta.totalPages}
                style={paginationButtonStyle}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 0 16px",
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

const filtersBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 16,
  flexWrap: "wrap",
};

const searchInputStyle: React.CSSProperties = {
  flex: "1 1 200px",
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  outline: "none",
  backgroundColor: "var(--p-color-bg-surface, white)",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 8,
  outline: "none",
  backgroundColor: "var(--p-color-bg-surface, white)",
  cursor: "pointer",
};

const tableContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, white)",
  borderRadius: 12,
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  overflow: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "top",
};

const trackingLinkStyle: React.CSSProperties = {
  color: "var(--p-color-text-primary, #005bd3)",
  fontWeight: 600,
  textDecoration: "none",
};

const cellSubtext: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  marginTop: 2,
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 0",
};

const paginationButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--p-color-text, #303030)",
  backgroundColor: "var(--p-color-bg-surface, white)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: 6,
  cursor: "pointer",
};
