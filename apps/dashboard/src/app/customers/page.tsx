"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

/* ═══════════════════════════════════════════════════════════
   CUSTOMERS PAGE — Customer management with Shopify sync
   ═══════════════════════════════════════════════════════════ */

interface Customer {
  id: string;
  shopifyId: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string;
  status: "active" | "inactive";
  syncedAt: string;
  segment: "vip" | "regular" | "new" | "inactive";
}

const CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    shopifyId: "gid://shopify/Customer/123456789",
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "+1 (555) 234-5601",
    ordersCount: 15,
    totalSpent: 3240.50,
    lastOrderDate: "2026-03-05",
    status: "active",
    syncedAt: "2026-03-06T08:30:00Z",
    segment: "vip",
  },
  {
    id: "cust-002",
    shopifyId: "gid://shopify/Customer/987654321",
    name: "Michael Torres",
    email: "m.torres@email.com",
    phone: "+1 (555) 345-6712",
    ordersCount: 12,
    totalSpent: 2890.75,
    lastOrderDate: "2026-03-04",
    status: "active",
    syncedAt: "2026-03-06T08:15:00Z",
    segment: "vip",
  },
  {
    id: "cust-003",
    shopifyId: "gid://shopify/Customer/456789123",
    name: "Emma Rodriguez",
    email: "emma.r@email.com",
    phone: "+1 (555) 456-7823",
    ordersCount: 8,
    totalSpent: 1950.00,
    lastOrderDate: "2026-03-03",
    status: "active",
    syncedAt: "2026-03-06T08:45:00Z",
    segment: "regular",
  },
  {
    id: "cust-004",
    shopifyId: "gid://shopify/Customer/789123456",
    name: "James Liu",
    email: "james.liu@email.com",
    phone: "+1 (555) 567-8934",
    ordersCount: 5,
    totalSpent: 1240.25,
    lastOrderDate: "2026-02-28",
    status: "active",
    syncedAt: "2026-03-06T07:20:00Z",
    segment: "regular",
  },
  {
    id: "cust-005",
    shopifyId: "gid://shopify/Customer/321654987",
    name: "Olivia Martinez",
    email: "o.martinez@email.com",
    phone: "+1 (555) 678-9045",
    ordersCount: 3,
    totalSpent: 680.50,
    lastOrderDate: "2026-02-15",
    status: "active",
    syncedAt: "2026-03-06T08:00:00Z",
    segment: "new",
  },
  {
    id: "cust-006",
    shopifyId: "gid://shopify/Customer/654987321",
    name: "David Kim",
    email: "d.kim@email.com",
    phone: "+1 (555) 789-0156",
    ordersCount: 2,
    totalSpent: 425.75,
    lastOrderDate: "2026-02-20",
    status: "active",
    syncedAt: "2026-03-06T08:30:00Z",
    segment: "new",
  },
  {
    id: "cust-007",
    shopifyId: "gid://shopify/Customer/147258369",
    name: "Jessica Williams",
    email: "j.williams@email.com",
    phone: "+1 (555) 890-1267",
    ordersCount: 0,
    totalSpent: 0,
    lastOrderDate: "",
    status: "inactive",
    syncedAt: "2026-03-05T14:10:00Z",
    segment: "inactive",
  },
  {
    id: "cust-008",
    shopifyId: "gid://shopify/Customer/258369147",
    name: "Robert Anderson",
    email: "r.anderson@email.com",
    phone: "+1 (555) 901-2378",
    ordersCount: 0,
    totalSpent: 0,
    lastOrderDate: "",
    status: "inactive",
    syncedAt: "2026-03-04T11:45:00Z",
    segment: "inactive",
  },
  {
    id: "cust-009",
    shopifyId: "gid://shopify/Customer/369147258",
    name: "Lisa Zhang",
    email: "lisa.zhang@email.com",
    phone: "+1 (555) 012-3489",
    ordersCount: 11,
    totalSpent: 2750.00,
    lastOrderDate: "2026-03-05",
    status: "active",
    syncedAt: "2026-03-06T08:25:00Z",
    segment: "vip",
  },
  {
    id: "cust-010",
    shopifyId: "gid://shopify/Customer/159753852",
    name: "Carlos Nunez",
    email: "c.nunez@email.com",
    phone: "+1 (555) 123-4590",
    ordersCount: 6,
    totalSpent: 1580.00,
    lastOrderDate: "2026-02-28",
    status: "active",
    syncedAt: "2026-03-06T07:55:00Z",
    segment: "regular",
  },
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDateTime = (isoStr: string): string => {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getSegmentColor = (segment: string): "primary" | "success" | "warning" | "info" | "default" => {
  const map: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
    vip: "primary",
    regular: "success",
    new: "info",
    inactive: "default",
  };
  return map[segment] ?? "default";
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "vip" | "regular" | "new" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "totalSpent" | "ordersCount" | "lastOrderDate">("name");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // Calculate stats
  const activeCustomers = CUSTOMERS.filter((c) => c.status === "active").length;
  const newThisMonth = CUSTOMERS.filter((c) => {
    const orderDate = new Date(c.lastOrderDate);
    const now = new Date();
    const thisMonth = now.getMonth() === orderDate.getMonth() && now.getFullYear() === orderDate.getFullYear();
    return thisMonth && c.ordersCount > 0;
  }).length;
  const avgOrders =
    CUSTOMERS.length > 0 ? (CUSTOMERS.reduce((sum, c) => sum + c.ordersCount, 0) / CUSTOMERS.length).toFixed(1) : "0";
  const topSpender = Math.max(...CUSTOMERS.map((c) => c.totalSpent));

  // Filter and sort
  const filtered = useMemo(() => {
    let result = CUSTOMERS.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (segmentFilter !== "all" && c.segment !== segmentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.shopifyId.includes(q)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "totalSpent":
          return b.totalSpent - a.totalSpent;
        case "ordersCount":
          return b.ordersCount - a.ordersCount;
        case "lastOrderDate":
          return new Date(b.lastOrderDate || 0).getTime() - new Date(a.lastOrderDate || 0).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [search, statusFilter, segmentFilter, sortBy]);

  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <>
      <Header
        title="Customers"
        subtitle={`${activeCustomers} active · ${CUSTOMERS.length} total`}
        actions={
          <Button variant="primary" size="md">
            + Sync from Shopify
          </Button>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          <StatCard
            label="Total Customers"
            value={CUSTOMERS.length}
            change={{ value: 5.2, label: "vs last month" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="New This Month"
            value={newThisMonth}
            change={{ value: 12.8, label: "vs last month" }}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Average Orders"
            value={avgOrders}
            change={{ value: 2.3, label: "per customer" }}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Top Spender"
            value={formatCurrency(topSpender)}
            change={{ value: 15.1, label: "vs avg" }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Filters Bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Search customers, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-4)",
                background: "var(--wl-bg-elevated)",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                outline: "none",
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "active", "inactive"] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-full)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  background: statusFilter === status ? "var(--wl-primary-500)" : "transparent",
                  color: statusFilter === status ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: statusFilter === status ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  textTransform: "capitalize",
                }}
              >
                {status === "all" ? "All Statuses" : status}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            style={{
              padding: "var(--wl-space-1) var(--wl-space-3)",
              background: "var(--wl-bg-elevated)",
              border: "1px solid var(--wl-border-default)",
              borderRadius: "var(--wl-radius-md)",
              color: "var(--wl-text-primary)",
              fontSize: "var(--wl-text-sm)",
              fontFamily: "var(--wl-font-sans)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="name">Sort by Name</option>
            <option value="totalSpent">Sort by Total Spent</option>
            <option value="ordersCount">Sort by Orders</option>
            <option value="lastOrderDate">Sort by Last Order</option>
          </select>
        </div>

        {/* Segments Overview */}
        <Card style={{ marginBottom: "var(--wl-space-5)", padding: "var(--wl-space-4)" }}>
          <div style={{ display: "flex", gap: "var(--wl-space-4)", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                Customer Segments
              </h3>
            </div>
            {(["vip", "regular", "new", "inactive"] as const).map((segment) => {
              const count = CUSTOMERS.filter((c) => c.segment === segment).length;
              const isActive = segmentFilter === segment;
              return (
                <button
                  key={segment}
                  onClick={() => {
                    setSegmentFilter(isActive ? "all" : segment);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "var(--wl-space-2) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    background: isActive ? "var(--wl-primary-500)" : "transparent",
                    color: isActive ? "var(--wl-text-inverse)" : "var(--wl-text-secondary)",
                    borderColor: isActive ? "var(--wl-primary-500)" : "var(--wl-border-subtle)",
                    textTransform: "capitalize",
                  }}
                >
                  {segment === "vip" && "VIP (10+)"}
                  {segment === "regular" && "Regular (3-9)"}
                  {segment === "new" && "New (1-2)"}
                  {segment === "inactive" && "Inactive"}
                  <span style={{ marginLeft: 6, opacity: 0.7 }}>({count})</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Customers Table */}
        <Card style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--wl-text-sm)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--wl-border-subtle)",
                    background: "var(--wl-bg-overlay)",
                  }}
                >
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Name
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Email
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Phone
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Orders
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "right", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Total Spent
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Last Order
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Shopify ID
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Status
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Synced
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((customer, idx) => (
                  <tr
                    key={customer.id}
                    style={{
                      borderBottom: "1px solid var(--wl-border-subtle)",
                      background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                      transition: "background var(--wl-duration-fast)",
                    }}
                  >
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                      {customer.name}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-secondary)" }}>
                      {customer.email}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-secondary)" }}>
                      {customer.phone}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-primary)", fontWeight: 600 }}>
                      {customer.ordersCount}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "right", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-secondary)" }}>
                      {formatDate(customer.lastOrderDate)}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-tertiary)", fontSize: "var(--wl-text-xs)" }}>
                      {customer.shopifyId.split("/").pop()}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
                      <Badge variant={customer.status === "active" ? "success" : "default"}>
                        {customer.status}
                      </Badge>
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-tertiary)", fontSize: "var(--wl-text-xs)" }}>
                      {formatDateTime(customer.syncedAt)}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <Button variant="secondary" size="sm">
                          View
                        </Button>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--wl-space-4)",
              borderTop: "1px solid var(--wl-border-subtle)",
              background: "var(--wl-bg-overlay)",
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-text-secondary)",
            }}
          >
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <span>Page {currentPage} of {totalPages}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
