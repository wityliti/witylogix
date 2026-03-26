/**
 * Payments List — Payment transactions page with filtering and summary cards.
 *
 * Features:
 *   - Summary cards: Total Revenue, Pending Amount, Refunded Amount, Failed Count
 *   - Filter bar: status (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED), type (CHARGE, COD_COLLECTION, REFUND, ADJUSTMENT), date range
 *   - Payments table: ID (truncated), type badge, method badge, amount, currency, status badge, provider txn ID, created date
 *   - Click row for payment detail modal/expand
 *   - "Export CSV" button
 *   - EmptyState when no payments
 *   - Pagination
 *
 * All data is loaded server-side via React Router v7 loader.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { useState } from "react";
import { EmptyState } from "~/components/EmptyState";
import { createApiClient, type PaginatedResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Payment {
  id: string;
  type: "CHARGE" | "COD_COLLECTION" | "REFUND" | "ADJUSTMENT";
  method: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  providerTransactionId: string | null;
  createdAt: string;
  customerId: string | null;
  shipmentId: string | null;
}

interface PaymentSummary {
  totalRevenue: number;
  pendingAmount: number;
  refundedAmount: number;
  failedCount: number;
}

interface PaymentsPageData {
  payments: Payment[];
  summary: PaymentSummary;
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
  const status = url.searchParams.get("status") || "all";
  const type = url.searchParams.get("type") || "all";
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;

  try {
    const response = await client.get<{ data: PaymentsPageData }>(
      `/api/v4/payments?page=${page}&limit=${limit}&status=${status}&type=${type}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    );

    return response;
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return { data: { payments: [], summary: { totalRevenue: 0, pendingAmount: 0, refundedAmount: 0, failedCount: 0 }, meta: { total: 0, page, limit, totalPages: 0 } } };
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

  if (intent === "export-csv") {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || "all";
      const type = url.searchParams.get("type") || "all";
      const startDate = url.searchParams.get("startDate") || "";
      const endDate = url.searchParams.get("endDate") || "";

      const response = await client.get(
        `/api/v4/payments/export?status=${status}&type=${type}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      );

      return {
        success: true,
        message: "CSV export initiated",
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to export payments",
      };
    }
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function PaymentsIndex() {
  const { payments, summary, meta } = useLoaderData<PaymentsPageData>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentType = searchParams.get("type") || "all";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleStatusChange = (status: string) => {
    setSearchParams((prev) => {
      prev.set("status", status);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleTypeChange = (type: string) => {
    setSearchParams((prev) => {
      prev.set("type", type);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleStartDateChange = (date: string) => {
    setSearchParams((prev) => {
      prev.set("startDate", date);
      prev.set("page", "1");
      return prev;
    });
  };

  const handleEndDateChange = (date: string) => {
    setSearchParams((prev) => {
      prev.set("endDate", date);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "var(--p-color-bg-fill-success, #22c55e)";
      case "PROCESSING":
        return "var(--p-color-bg-fill-info, #3b82f6)";
      case "PENDING":
        return "var(--p-color-bg-fill-warning, #f59e0b)";
      case "FAILED":
        return "var(--p-color-bg-fill-critical, #ef4444)";
      case "REFUNDED":
        return "#8c9196";
      default:
        return "#8c9196";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "CHARGE":
        return "#3b82f6";
      case "COD_COLLECTION":
        return "#10b981";
      case "REFUND":
        return "#ef4444";
      case "ADJUSTMENT":
        return "#f59e0b";
      default:
        return "#8c9196";
    }
  };

  const truncateId = (id: string) => {
    return id.length > 12 ? id.substring(0, 12) + "..." : id;
  };

  if (payments.length === 0 && currentStatus === "all") {
    return (
      <EmptyState
        title="No payments yet"
        description="Payment transactions will appear here once you start processing orders."
      />
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={pageHeadingStyle}>Payments</h1>
          <p style={pageSubheadingStyle}>
            Manage payment transactions and view transaction details
          </p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="export-csv" />
          <button type="submit" style={primaryButtonStyle}>
            Export CSV
          </button>
        </Form>
      </div>

      {/* Summary Cards */}
      <div style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Revenue</div>
          <div style={summaryValueStyle}>${summary.totalRevenue.toFixed(2)}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Pending Amount</div>
          <div style={summaryValueStyle}>${summary.pendingAmount.toFixed(2)}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Refunded Amount</div>
          <div style={summaryValueStyle}>${summary.refundedAmount.toFixed(2)}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Failed Payments</div>
          <div style={summaryValueStyle}>{summary.failedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={filterBarStyle}>
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>

        <select
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="all">All Types</option>
          <option value="CHARGE">Charge</option>
          <option value="COD_COLLECTION">COD Collection</option>
          <option value="REFUND">Refund</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        <input
          type="date"
          value={currentStartDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          style={filterSelectStyle}
          placeholder="Start Date"
        />

        <input
          type="date"
          value={currentEndDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          style={filterSelectStyle}
          placeholder="End Date"
        />
      </div>

      {/* Table */}
      {payments.length > 0 ? (
        <div style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead>
              <tr style={trStyle}>
                <th style={thStyle}>Transaction ID</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Provider ID</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} style={trStyle}>
                  <td style={tdStyle}>
                    <code style={idCodeStyle}>{truncateId(payment.id)}</code>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        backgroundColor: getTypeColor(payment.type),
                        color: "white",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {payment.type === "COD_COLLECTION"
                        ? "COD"
                        : payment.type}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>{payment.method}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>
                      {payment.currency} {payment.amount.toFixed(2)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 12px",
                        backgroundColor: getStatusColor(payment.status),
                        color: "white",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>
                      {payment.providerTransactionId
                        ? truncateId(payment.providerTransactionId)
                        : "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={cellSubtext}>
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No payments found"
          description="Try adjusting your filters to find payments."
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const summaryCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "16px",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 8,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
};

const filterBarStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const filterSelectStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  color: "var(--p-color-text, #202223)",
  minWidth: 140,
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
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "top",
};

const idCodeStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "monospace",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  padding: "2px 6px",
  borderRadius: 3,
  color: "var(--p-color-text-subdued, #6d7175)",
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
