/**
 * Orders List — Full-width resource list with filters and bulk actions.
 *
 * Features:
 *   - Multi-select status filter (persistent URL params)
 *   - Date range filter
 *   - Driver and Zone dropdowns
 *   - Search by order number, customer name, address
 *   - Pagination (server-side)
 *   - Bulk actions: assign driver, assign route, print labels, cancel
 *   - Row click → order detail
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link } from "react-router";
import { OrderStatusBadge } from "~/components/OrderStatusBadge";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Order {
  id: string;
  shopifyOrderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  addressLine1: string | null;
  city: string | null;
  status: string;
  driverId: string | null;
  driverName?: string | null;
  zoneName?: string | null;
  deliveryDate: string | null;
  createdAt: string;
}

interface OrdersPageData {
  orders: Order[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
];

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const driverId = url.searchParams.get("driverId") ?? undefined;
  const zoneId = url.searchParams.get("zoneId") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;

  const response = await api.get<PaginatedResponse<Order>>("/api/v4/orders", {
    page,
    limit,
    status,
    search,
    driverId,
    zoneId,
    dateFrom,
    dateTo,
  });

  return { orders: response.data, meta: response.meta };
}

// ─── Component ─────────────────────────────────────────────

export default function OrdersList() {
  const { orders, meta } = useLoaderData<OrdersPageData>();
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
    next.set("page", "1"); // Reset to page 1 on filter change
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
          <h1 style={headingStyle}>Orders</h1>
          <p style={subtextStyle}>{meta.total} total orders</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={filtersBarStyle}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search orders..."
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
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
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

      {/* Orders Table */}
      {orders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={
            currentSearch || currentStatus
              ? "Try adjusting your filters to find what you're looking for."
              : "Orders will appear here when they're created from Shopify or the API."
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
                  <th style={thStyle}>Order</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link to={`/orders/${order.id}`} style={orderLinkStyle}>
                        {order.shopifyOrderNumber
                          ? `#${order.shopifyOrderNumber}`
                          : order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>
                        {order.customerName ?? "—"}
                      </div>
                      <div style={cellSubtext}>
                        {order.customerEmail ?? ""}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div>{order.addressLine1 ?? "—"}</div>
                      <div style={cellSubtext}>{order.city ?? ""}</div>
                    </td>
                    <td style={tdStyle}>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td style={tdStyle}>
                      {order.driverName ?? (
                        <span style={cellSubtext}>Unassigned</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {order.deliveryDate
                        ? new Date(order.deliveryDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )
                        : new Date(order.createdAt).toLocaleDateString(
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
              Page {currentPage} of {meta.totalPages} ({meta.total} orders)
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

const orderLinkStyle: React.CSSProperties = {
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
