/**
 * Customers List — Full-width customer list with search, filters, and segmentation.
 *
 * Features:
 *   - Search bar (name, email, phone)
 *   - Status filter (active, inactive, all)
 *   - Segment chips: All, VIP, New, At Risk
 *   - Customer table: name, email, phone, orders count, total spent, last order date, sync status
 *   - Click row to expand/view customer details
 *   - "Sync Customers" action button
 *   - Pagination
 *   - EmptyState when no customers
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, Form } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Customer {
  id: string;
  shopifyCustomerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  syncStatus: "synced" | "pending" | "failed";
  segment: "vip" | "new" | "at_risk" | "regular";
  createdAt: string;
}

interface CustomersPageData {
  customers: Customer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "all";
  const segment = url.searchParams.get("segment") || "all";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;

  try {
    // Fetch customers from API with filters
    const response = await client.get<{ data: CustomersPageData }>(
      `/api/v4/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${status}&segment=${segment}`
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { customers: [], meta: { total: 0, page, limit, totalPages: 0 } };
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return null;
  }

  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync-customers") {
    try {
      await client.post("/api/v4/customers/sync", {});
      return { success: true, message: "Customer sync initiated" };
    } catch (error) {
      return {
        success: false,
        error: "Failed to initiate customer sync",
      };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function CustomersIndex() {
  const { customers, meta } = useLoaderData<CustomersPageData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "all";
  const currentSegment = searchParams.get("segment") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleSearch = (value: string) => {
    setSearchParams((prev) => {
      prev.set("search", value);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleStatusChange = (status: string) => {
    setSearchParams((prev) => {
      prev.set("status", status);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleSegmentChange = (segment: string) => {
    setSearchParams((prev) => {
      prev.set("segment", segment);
      prev.set("page", "1");
      return prev;
    });
  };

  const goToPage = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", String(page));
      return prev;
    });
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case "vip":
        return "#d4af37";
      case "new":
        return "#00a699";
      case "at_risk":
        return "#ff6b6b";
      default:
        return "#8c9196";
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "var(--p-color-bg-fill-success, #22c55e)";
      case "pending":
        return "var(--p-color-bg-fill-warning, #f59e0b)";
      case "failed":
        return "var(--p-color-bg-fill-critical, #ef4444)";
      default:
        return "#8c9196";
    }
  };

  if (customers.length === 0 && !currentSearch && currentStatus === "all") {
    return (
      <EmptyState
        title="No customers yet"
        description="Your customers will appear here once you start syncing customer data from Shopify."
        actionLabel="Sync Customers Now"
        onAction={() => {
          const form = document.createElement("form");
          form.method = "post";
          form.innerHTML = '<input type="hidden" name="intent" value="sync-customers">';
          document.body.appendChild(form);
          form.submit();
        }}
      />
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={pageHeadingStyle}>Customers</h1>
          <p style={pageSubheadingStyle}>
            Manage and sync your customer data ({meta.total} total)
          </p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="sync-customers" />
          <button type="submit" style={primaryButtonStyle}>
            Sync Customers
          </button>
        </Form>
      </div>

      {/* Search and Filters */}
      <div style={filterBarStyle}>
        <input
          type="text"
          placeholder="Search customers by name, email, or phone..."
          value={currentSearch}
          onChange={(e) => handleSearch(e.target.value)}
          style={searchInputStyle}
        />
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Segment Chips */}
      <div style={chipContainerStyle}>
        {["all", "vip", "new", "at_risk"].map((segment) => (
          <button
            key={segment}
            onClick={() => handleSegmentChange(segment)}
            style={{
              ...chipStyle,
              backgroundColor:
                currentSegment === segment
                  ? getSegmentColor(segment)
                  : "var(--p-color-bg-surface, #ffffff)",
              color:
                currentSegment === segment
                  ? "white"
                  : "var(--p-color-text, #202223)",
              border:
                currentSegment === segment
                  ? "none"
                  : "1px solid var(--p-color-border, #c9cccf)",
            }}
          >
            {segment === "all"
              ? "All"
              : segment === "vip"
              ? "VIP"
              : segment === "new"
              ? "New"
              : "At Risk"}
          </button>
        ))}
      </div>

      {/* Table */}
      {customers.length > 0 ? (
        <div style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={trStyle}>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Orders</th>
                <th style={thStyle}>Total Spent</th>
                <th style={thStyle}>Last Order</th>
                <th style={thStyle}>Sync Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  style={trStyle}
                  onClick={() =>
                    setExpandedId(expandedId === customer.id ? null : customer.id)
                  }
                >
                  <td style={tdStyle}>
                    <div>
                      <Link
                        to={`/customers/${customer.id}`}
                        style={customerLinkStyle}
                      >
                        {customer.firstName} {customer.lastName}
                      </Link>
                      <div style={cellSubtext}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            backgroundColor: getSegmentColor(customer.segment),
                            color: "white",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            marginTop: 4,
                          }}
                        >
                          {customer.segment === "vip"
                            ? "VIP"
                            : customer.segment === "new"
                            ? "New"
                            : customer.segment === "at_risk"
                            ? "At Risk"
                            : "Regular"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>{customer.email || "—"}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>{customer.phone || "—"}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{customer.ordersCount}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>
                      ${customer.totalSpent.toFixed(2)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>
                      {customer.lastOrderDate
                        ? new Date(customer.lastOrderDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        backgroundColor: getSyncStatusColor(customer.syncStatus),
                        color: "white",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {customer.syncStatus === "synced"
                        ? "Synced"
                        : customer.syncStatus === "pending"
                        ? "Pending"
                        : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No customers found"
          description="Try adjusting your search or filters to find customers."
        />
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div style={paginationStyle}>
          <span style={paginationInfoStyle}>
            Page {currentPage} of {meta.totalPages} ({meta.total} total)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                ...paginationButtonStyle,
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === meta.totalPages}
              style={{
                ...paginationButtonStyle,
                opacity: currentPage === meta.totalPages ? 0.5 : 1,
                cursor: currentPage === meta.totalPages ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: "32px",
  backgroundColor: "var(--p-color-bg, #ffffff)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "32px",
};

const pageHeadingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const pageSubheadingStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "8px 0 0",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
};

const filterBarStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  marginBottom: "20px",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  color: "var(--p-color-text, #202223)",
};

const filterSelectStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  color: "var(--p-color-text, #202223)",
  minWidth: 150,
};

const chipContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const chipStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  borderRadius: "20px",
  border: "1px solid var(--p-color-border, #c9cccf)",
  cursor: "pointer",
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: "auto",
  marginBottom: "20px",
  borderRadius: "var(--p-border-radius-200, 8px)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
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
  cursor: "pointer",
  transition: "background-color 0.2s",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "top",
};

const customerLinkStyle: React.CSSProperties = {
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

const paginationInfoStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
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


