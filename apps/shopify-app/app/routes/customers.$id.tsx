/**
 * Customer Detail — Customer profile with orders history and statistics.
 *
 * Features:
 *   - Customer info card: name, email, phone, Shopify ID, addresses
 *   - Stats row: total orders, total spent, average order value, first/last order dates
 *   - Order history table: order number, date, status, total, items count
 *   - Address list (from addresses JSON field)
 *   - Back to customers link
 *   - "View in Shopify" external link button
 *
 * Loader fetches single customer + their orders from API.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Address {
  id: string;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isDefault: boolean;
}

interface CustomerOrder {
  id: string;
  shopifyOrderNumber: string | null;
  createdAt: string;
  status: string;
  totalAmount: number;
  itemsCount: number;
}

interface Customer {
  id: string;
  shopifyCustomerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  createdAt: string;
  addresses: Address[];
  orders: CustomerOrder[];
}

interface CustomerDetailData {
  customer: Customer;
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const customerId = params.id;
  if (!customerId) {
    throw new Error("Customer ID not found");
  }

  try {
    const response = await client.get<{ data: CustomerDetailData }>(
      `/api/v4/customers/${customerId}`
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    throw new Error("Customer not found");
  }
}

// ─── Component ─────────────────────────────────────────────

export default function CustomerDetail() {
  const { customer } = useLoaderData<CustomerDetailData>();

  const averageOrderValue =
    customer.ordersCount > 0 ? customer.totalSpent / customer.ordersCount : 0;

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "var(--p-color-bg-fill-success, #22c55e)";
      case "processing":
        return "var(--p-color-bg-fill-info, #3b82f6)";
      case "pending":
        return "var(--p-color-bg-fill-warning, #f59e0b)";
      case "cancelled":
        return "var(--p-color-bg-fill-critical, #ef4444)";
      default:
        return "#8c9196";
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header with Back Link */}
      <div style={headerStyle}>
        <div>
          <Link to="/customers" style={backLinkStyle}>
            ← Back to Customers
          </Link>
          <h1 style={pageHeadingStyle}>
            {customer.firstName} {customer.lastName}
          </h1>
        </div>
        {customer.shopifyCustomerId && (
          <a
            href={`https://admin.shopify.com/store/witylogix/customers/${customer.shopifyCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={externalLinkButtonStyle}
          >
            View in Shopify
          </a>
        )}
      </div>

      {/* Customer Info Card */}
      <div style={cardStyle}>
        <h2 style={cardHeadingStyle}>Customer Information</h2>
        <div style={infoGridStyle}>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Email</span>
            <span style={infoValueStyle}>{customer.email || "—"}</span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Phone</span>
            <span style={infoValueStyle}>{customer.phone || "—"}</span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Shopify ID</span>
            <span style={infoValueStyle}>{customer.shopifyCustomerId || "—"}</span>
          </div>
          <div style={infoPairStyle}>
            <span style={infoLabelStyle}>Member Since</span>
            <span style={infoValueStyle}>
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString()
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Row */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{customer.ordersCount}</div>
          <div style={statLabelStyle}>Total Orders</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>${customer.totalSpent.toFixed(2)}</div>
          <div style={statLabelStyle}>Total Spent</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>${averageOrderValue.toFixed(2)}</div>
          <div style={statLabelStyle}>Average Order Value</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>
            {customer.firstOrderDate
              ? new Date(customer.firstOrderDate).toLocaleDateString()
              : "—"}
          </div>
          <div style={statLabelStyle}>First Order</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>
            {customer.lastOrderDate
              ? new Date(customer.lastOrderDate).toLocaleDateString()
              : "—"}
          </div>
          <div style={statLabelStyle}>Last Order</div>
        </div>
      </div>

      {/* Addresses */}
      {customer.addresses && customer.addresses.length > 0 && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Addresses</h2>
          <div style={addressListStyle}>
            {customer.addresses.map((address) => (
              <div key={address.id} style={addressCardStyle}>
                {address.isDefault && (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
                      color: "white",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Default
                  </span>
                )}
                <div style={addressTextStyle}>
                  {address.firstName} {address.lastName}
                </div>
                <div style={addressTextStyle}>{address.addressLine1}</div>
                {address.addressLine2 && (
                  <div style={addressTextStyle}>{address.addressLine2}</div>
                )}
                <div style={addressTextStyle}>
                  {address.city}, {address.state} {address.postalCode}
                </div>
                <div style={addressTextStyle}>{address.country}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order History */}
      {customer.orders && customer.orders.length > 0 && (
        <div style={cardStyle}>
          <h2 style={cardHeadingStyle}>Order History</h2>
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={trStyle}>
                  <th style={thStyle}>Order Number</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} style={trStyle}>
                    <td style={tdStyle}>
                      <Link
                        to={`/orders/${order.id}`}
                        style={orderLinkStyle}
                      >
                        {order.shopifyOrderNumber || order.id}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          backgroundColor: getOrderStatusColor(order.status),
                          color: "white",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{order.itemsCount}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      ${order.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  maxWidth: 1200,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "32px",
};

const backLinkStyle: React.CSSProperties = {
  color: "var(--p-color-text-primary, #005bd3)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  marginBottom: 8,
  display: "block",
};

const pageHeadingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const externalLinkButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
  textDecoration: "none",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "24px",
  marginBottom: "24px",
};

const cardHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
};

const infoPairStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 4,
};

const infoValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--p-color-text, #202223)",
  fontWeight: 500,
};

const statsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const statCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "16px",
  textAlign: "center",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  marginBottom: 4,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
  fontWeight: 500,
};

const addressListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: "16px",
};

const addressCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "16px",
};

const addressTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
  marginBottom: 4,
  lineHeight: 1.4,
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: "auto",
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

const orderLinkStyle: React.CSSProperties = {
  color: "var(--p-color-text-primary, #005bd3)",
  fontWeight: 600,
  textDecoration: "none",
};
