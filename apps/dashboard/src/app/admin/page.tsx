"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  BarChart3,
  Users,
  ShoppingCart,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  ActivitySquare,
  Server,
  Database,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface Shop {
  id: string;
  name: string;
  domain: string;
  planTier: "free" | "starter" | "growth" | "enterprise";
  owner: string;
  ordersCount: number;
  status: "active" | "suspended" | "trial";
  createdDate: string;
  revenue: number;
}

interface SystemEvent {
  id: string;
  timestamp: string;
  type: "shop_created" | "order_processed" | "plan_upgrade" | "suspension" | "api_call";
  description: string;
  shop: string;
  severity: "info" | "warning" | "error";
}

const mockShops: Shop[] = [
  {
    id: "shop_001",
    name: "Elegant Boutique",
    domain: "elegantboutique.com",
    planTier: "enterprise",
    owner: "Sarah Anderson",
    ordersCount: 4523,
    status: "active",
    createdDate: "2024-01-15",
    revenue: 145000,
  },
  {
    id: "shop_002",
    name: "Tech Gadgets Hub",
    domain: "techgadgetshub.com",
    planTier: "growth",
    owner: "Michael Chen",
    ordersCount: 2156,
    status: "active",
    createdDate: "2024-02-20",
    revenue: 87500,
  },
  {
    id: "shop_003",
    name: "Organic Wellness",
    domain: "organicwellness.io",
    planTier: "starter",
    owner: "Emma Rodriguez",
    ordersCount: 856,
    status: "trial",
    createdDate: "2026-02-15",
    revenue: 28900,
  },
  {
    id: "shop_004",
    name: "Fashion Forward",
    domain: "fashionforward.store",
    planTier: "enterprise",
    owner: "James Mitchell",
    ordersCount: 5234,
    status: "active",
    createdDate: "2023-11-10",
    revenue: 210000,
  },
  {
    id: "shop_005",
    name: "Sports Paradise",
    domain: "sportsparadise.net",
    planTier: "growth",
    owner: "Lisa Thompson",
    ordersCount: 1789,
    status: "suspended",
    createdDate: "2024-03-05",
    revenue: 65000,
  },
  {
    id: "shop_006",
    name: "Home & Garden",
    domain: "homeandgarden.co",
    planTier: "starter",
    owner: "David Kim",
    ordersCount: 423,
    status: "active",
    createdDate: "2025-06-12",
    revenue: 15600,
  },
  {
    id: "shop_007",
    name: "Artisan Crafts",
    domain: "artisancrafts.shop",
    planTier: "free",
    owner: "Nina Patel",
    ordersCount: 145,
    status: "active",
    createdDate: "2025-08-22",
    revenue: 4200,
  },
  {
    id: "shop_008",
    name: "Beauty & Cosmetics",
    domain: "beautycosmetics.com",
    planTier: "growth",
    owner: "Victoria Hayes",
    ordersCount: 3421,
    status: "active",
    createdDate: "2024-01-30",
    revenue: 112300,
  },
];

const mockSystemEvents: SystemEvent[] = [
  {
    id: "evt_001",
    timestamp: "2026-03-06 14:32:10",
    type: "order_processed",
    description: "Order #78945 processed",
    shop: "Fashion Forward",
    severity: "info",
  },
  {
    id: "evt_002",
    timestamp: "2026-03-06 14:28:45",
    type: "shop_created",
    description: "New shop registration",
    shop: "Luxury Watches",
    severity: "info",
  },
  {
    id: "evt_003",
    timestamp: "2026-03-06 13:54:22",
    type: "plan_upgrade",
    description: "Upgraded from Starter to Growth",
    shop: "Tech Gadgets Hub",
    severity: "info",
  },
  {
    id: "evt_004",
    timestamp: "2026-03-06 13:12:08",
    type: "api_call",
    description: "Bulk shipment sync - 245 items",
    shop: "Elegant Boutique",
    severity: "info",
  },
  {
    id: "evt_005",
    timestamp: "2026-03-06 12:45:33",
    type: "suspension",
    description: "Account suspended - payment failed",
    shop: "Sports Paradise",
    severity: "warning",
  },
  {
    id: "evt_006",
    timestamp: "2026-03-06 12:01:19",
    type: "order_processed",
    description: "Order #78934 processed",
    shop: "Beauty & Cosmetics",
    severity: "info",
  },
  {
    id: "evt_007",
    timestamp: "2026-03-06 11:33:42",
    type: "api_call",
    description: "Rate limit exceeded - 5000/5000 calls",
    shop: "Elegant Boutique",
    severity: "warning",
  },
  {
    id: "evt_008",
    timestamp: "2026-03-06 10:55:17",
    type: "shop_created",
    description: "New shop registration",
    shop: "Premium Jewelry",
    severity: "info",
  },
  {
    id: "evt_009",
    timestamp: "2026-03-06 10:22:05",
    type: "order_processed",
    description: "Order #78923 processed",
    shop: "Fashion Forward",
    severity: "info",
  },
  {
    id: "evt_010",
    timestamp: "2026-03-06 09:48:30",
    type: "plan_upgrade",
    description: "Upgraded from Free to Starter",
    shop: "Artisan Crafts",
    severity: "info",
  },
  {
    id: "evt_011",
    timestamp: "2026-03-06 09:15:44",
    type: "api_call",
    description: "Webhook delivery - 523 events",
    shop: "Tech Gadgets Hub",
    severity: "info",
  },
  {
    id: "evt_012",
    timestamp: "2026-03-06 08:32:21",
    type: "order_processed",
    description: "Order #78912 processed",
    shop: "Home & Garden",
    severity: "info",
  },
  {
    id: "evt_013",
    timestamp: "2026-03-05 23:45:08",
    type: "suspension",
    description: "Automatic suspension - no activity",
    shop: "Vintage Books",
    severity: "warning",
  },
  {
    id: "evt_014",
    timestamp: "2026-03-05 22:18:55",
    type: "order_processed",
    description: "Order #78901 processed",
    shop: "Beauty & Cosmetics",
    severity: "info",
  },
  {
    id: "evt_015",
    timestamp: "2026-03-05 21:02:33",
    type: "plan_upgrade",
    description: "Upgraded to Enterprise plan",
    shop: "Organic Wellness",
    severity: "info",
  },
  {
    id: "evt_016",
    timestamp: "2026-03-05 20:17:42",
    type: "api_call",
    description: "Inventory sync - 1250 products",
    shop: "Fashion Forward",
    severity: "info",
  },
  {
    id: "evt_017",
    timestamp: "2026-03-05 19:34:19",
    type: "order_processed",
    description: "Order #78890 processed",
    shop: "Tech Gadgets Hub",
    severity: "info",
  },
  {
    id: "evt_018",
    timestamp: "2026-03-05 18:56:44",
    type: "shop_created",
    description: "New shop registration",
    shop: "Designer Shoes",
    severity: "info",
  },
  {
    id: "evt_019",
    timestamp: "2026-03-05 17:23:11",
    type: "api_call",
    description: "Batch processing - reports generation",
    shop: "Elegant Boutique",
    severity: "info",
  },
  {
    id: "evt_020",
    timestamp: "2026-03-05 16:45:50",
    type: "order_processed",
    description: "Order #78879 processed",
    shop: "Beauty & Cosmetics",
    severity: "info",
  },
];

export default function AdminPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "starter" | "growth" | "enterprise">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "trial">("all");

  const filteredShops = useMemo(() => {
    return mockShops.filter((shop) => {
      const matchesSearch =
        shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shop.owner.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPlan = planFilter === "all" || shop.planTier === planFilter;
      const matchesStatus = statusFilter === "all" || shop.status === statusFilter;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [searchTerm, planFilter, statusFilter]);

  const stats = {
    totalShops: mockShops.length,
    activeUsers: 1247,
    totalOrders: mockShops.reduce((sum, shop) => sum + shop.ordersCount, 0),
    totalRevenue: mockShops.reduce((sum, shop) => sum + shop.revenue, 0),
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "free":
        return "#94a3b8";
      case "starter":
        return "#3b82f6";
      case "growth":
        return "#8b5cf6";
      case "enterprise":
        return "#ec4899";
      default:
        return "#6C63FF";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#22c55e";
      case "suspended":
        return "#ef4444";
      case "trial":
        return "#f59e0b";
      default:
        return "#6C63FF";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "info":
        return "#6C63FF";
      case "warning":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#6C63FF";
    }
  };

  return (
    <div style={{ background: "var(--wl-bg)" }}>
      {/* Header */}
      <div
        style={{
          padding: "32px 24px",
          borderBottom: "1px solid var(--wl-border)",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--wl-text)",
            margin: "0 0 8px 0",
          }}
        >
          Super Admin Panel
        </h1>
        <p style={{ color: "var(--wl-muted)", margin: "0", fontSize: "14px" }}>
          Manage all shops, users, and platform activities
        </p>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Stats Overview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "14px" }}>
                    Total Shops
                  </p>
                  <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {stats.totalShops}
                  </p>
                </div>
                <ShoppingCart style={{ width: "32px", height: "32px", color: "var(--wl-primary)" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "14px" }}>
                    Active Users
                  </p>
                  <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {stats.activeUsers}
                  </p>
                </div>
                <Users style={{ width: "32px", height: "32px", color: "#3b82f6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "14px" }}>
                    Total Orders
                  </p>
                  <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {stats.totalOrders.toLocaleString()}
                  </p>
                </div>
                <BarChart3 style={{ width: "32px", height: "32px", color: "#8b5cf6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "14px" }}>
                    Total Revenue
                  </p>
                  <p style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    ${(stats.totalRevenue / 1000).toFixed(0)}K
                  </p>
                </div>
                <TrendingUp style={{ width: "32px", height: "32px", color: "var(--wl-success)" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health Indicators */}
        <Card
          style={{
            background: "var(--wl-card)",
            border: "1px solid var(--wl-border)",
            marginBottom: "32px",
          }}
        >
          <CardContent style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text)", margin: "0 0 16px 0" }}>
              System Health
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Server style={{ width: "20px", height: "20px", color: "var(--wl-success)" }} />
                <div>
                  <p style={{ fontSize: "12px", color: "var(--wl-muted)", margin: "0 0 4px 0" }}>API Uptime</p>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--wl-text)", margin: "0" }}>
                    99.98%
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Database style={{ width: "20px", height: "20px", color: "var(--wl-success)" }} />
                <div>
                  <p style={{ fontSize: "12px", color: "var(--wl-muted)", margin: "0 0 4px 0" }}>DB Connections</p>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--wl-text)", margin: "0" }}>
                    245 / 500
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Zap style={{ width: "20px", height: "20px", color: "var(--wl-success)" }} />
                <div>
                  <p style={{ fontSize: "12px", color: "var(--wl-muted)", margin: "0 0 4px 0" }}>Queue Depth</p>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--wl-text)", margin: "0" }}>
                    1,234 jobs
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop List Section */}
        <Card
          style={{
            background: "var(--wl-card)",
            border: "1px solid var(--wl-border)",
            marginBottom: "32px",
          }}
        >
          <CardContent style={{ padding: "20px" }}>
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text)", margin: "0 0 16px 0" }}>
                Shops Directory
              </h3>

              {/* Search and Filters */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
                  <Search
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "16px",
                      height: "16px",
                      color: "var(--wl-muted)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, domain, or owner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 36px",
                      background: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "6px",
                      color: "var(--wl-text)",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Filter Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <Filter style={{ width: "16px", height: "16px", color: "var(--wl-muted)" }} />
                  <span style={{ fontSize: "12px", color: "var(--wl-muted)" }}>Plan:</span>
                </div>
                {["all", "free", "starter", "growth", "enterprise"].map((plan) => (
                  <button
                    key={plan}
                    onClick={() => setPlanFilter(plan as any)}
                    style={{
                      padding: "6px 12px",
                      background: planFilter === plan ? "var(--wl-primary)" : "var(--wl-bg)",
                      color: "var(--wl-text)",
                      border: `1px solid ${planFilter === plan ? "var(--wl-primary)" : "var(--wl-border)"}`,
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--wl-muted)" }}>Status:</span>
                </div>
                {["all", "active", "suspended", "trial"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    style={{
                      padding: "6px 12px",
                      background: statusFilter === status ? "var(--wl-primary)" : "var(--wl-bg)",
                      color: "var(--wl-text)",
                      border: `1px solid ${statusFilter === status ? "var(--wl-primary)" : "var(--wl-border)"}`,
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Shop Table */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--wl-border)" }}>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Shop Name
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Plan
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Orders
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Created
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShops.map((shop) => (
                    <tr
                      key={shop.id}
                      style={{
                        borderBottom: "1px solid var(--wl-border)",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "rgba(108, 99, 255, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                    >
                      <td style={{ padding: "12px" }}>
                        <Link
                          href={`/admin/shops/${shop.id}`}
                          style={{
                            color: "var(--wl-primary)",
                            textDecoration: "none",
                            fontWeight: "500",
                          }}
                        >
                          {shop.name}
                        </Link>
                        <p style={{ color: "var(--wl-muted)", margin: "4px 0 0 0", fontSize: "12px" }}>
                          {shop.domain}
                        </p>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge
                          style={{
                            background: getPlanColor(shop.planTier) + "20",
                            color: getPlanColor(shop.planTier),
                            border: `1px solid ${getPlanColor(shop.planTier)}40`,
                          }}
                        >
                          {shop.planTier.charAt(0).toUpperCase() + shop.planTier.slice(1)}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", color: "var(--wl-text)" }}>
                        {shop.ordersCount.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge
                          style={{
                            background: getStatusColor(shop.status) + "20",
                            color: getStatusColor(shop.status),
                            border: `1px solid ${getStatusColor(shop.status)}40`,
                          }}
                        >
                          {shop.status.charAt(0).toUpperCase() + shop.status.slice(1)}
                        </Badge>
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-text)" }}>
                        {new Date(shop.createdDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <button
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--wl-muted)",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          <MoreVertical style={{ width: "16px", height: "16px" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ color: "var(--wl-muted)", margin: "16px 0 0 0", fontSize: "12px" }}>
              Showing {filteredShops.length} of {mockShops.length} shops
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
          <CardContent style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text)", margin: "0 0 16px 0" }}>
              Recent System Activity
            </h3>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {mockSystemEvents.slice(0, 20).map((event, index) => (
                <div
                  key={event.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: index < 19 ? "1px solid var(--wl-border)" : "none",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: getSeverityColor(event.severity),
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: "0" }}>
                    <p style={{ color: "var(--wl-text)", margin: "0 0 4px 0", fontSize: "14px" }}>
                      {event.description}
                    </p>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span style={{ color: "var(--wl-muted)", fontSize: "12px" }}>{event.shop}</span>
                      <span style={{ color: "var(--wl-muted)", fontSize: "12px" }}>{event.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
