"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Users,
  Zap,
  CreditCard,
  MoreVertical,
  AlertTriangle,
  Lock,
  Trash2,
  Crown,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

interface ShopDetail {
  id: string;
  name: string;
  domain: string;
  planTier: "free" | "starter" | "growth" | "enterprise";
  status: "active" | "suspended" | "trial";
  owner: {
    name: string;
    email: string;
    phone: string;
    joinDate: string;
  };
  usage: {
    orders: number;
    shipments: number;
    drivers: number;
    apiCalls: number;
    apiCallsLimit: number;
  };
  billing: {
    currentPlan: string;
    monthlyFee: number;
    nextBillingDate: string;
    status: "active" | "overdue" | "pending";
  };
  createdAt: string;
  lastActive: string;
  uptime: number;
}

interface BillingRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
}

interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  severity: "info" | "warning" | "error";
}

const mockShopDetail: ShopDetail = {
  id: "shop_001",
  name: "Elegant Boutique",
  domain: "elegantboutique.com",
  planTier: "enterprise",
  status: "active",
  owner: {
    name: "Sarah Anderson",
    email: "sarah.anderson@elegantboutique.com",
    phone: "+1 (555) 123-4567",
    joinDate: "2024-01-15",
  },
  usage: {
    orders: 4523,
    shipments: 4456,
    drivers: 12,
    apiCalls: 450000,
    apiCallsLimit: 1000000,
  },
  billing: {
    currentPlan: "Enterprise",
    monthlyFee: 999,
    nextBillingDate: "2026-04-06",
    status: "active",
  },
  createdAt: "2024-01-15",
  lastActive: "2026-03-06 14:32:10",
  uptime: 99.98,
};

const mockBillingHistory: BillingRecord[] = [
  {
    id: "bill_001",
    date: "2026-03-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_002",
    date: "2026-02-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_003",
    date: "2026-01-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_004",
    date: "2025-12-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_005",
    date: "2025-11-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_006",
    date: "2025-10-06",
    description: "Growth Plan - Monthly",
    amount: 499,
    status: "paid",
  },
];

const mockActivityLog: ActivityLog[] = [
  {
    id: "act_001",
    timestamp: "2026-03-06 14:32:10",
    action: "Order processed",
    details: "Order #78945 completed successfully",
    user: "System",
    severity: "info",
  },
  {
    id: "act_002",
    timestamp: "2026-03-06 13:54:22",
    action: "Shipment created",
    details: "245 items shipped via FedEx",
    user: "Sarah Anderson",
    severity: "info",
  },
  {
    id: "act_003",
    timestamp: "2026-03-06 13:12:08",
    action: "API call",
    details: "Bulk inventory sync - 1250 products",
    user: "System",
    severity: "info",
  },
  {
    id: "act_004",
    timestamp: "2026-03-06 12:45:33",
    action: "Settings updated",
    details: "Shipping zones configuration modified",
    user: "Sarah Anderson",
    severity: "info",
  },
  {
    id: "act_005",
    timestamp: "2026-03-05 22:18:55",
    action: "Payment processed",
    details: "Monthly subscription fee charged",
    user: "System",
    severity: "info",
  },
  {
    id: "act_006",
    timestamp: "2026-03-05 20:17:42",
    action: "API threshold warning",
    details: "API calls usage at 75% of monthly limit",
    user: "System",
    severity: "warning",
  },
  {
    id: "act_007",
    timestamp: "2026-03-04 18:56:44",
    action: "Team member added",
    details: "john.doe@elegantboutique.com added as Manager",
    user: "Sarah Anderson",
    severity: "info",
  },
  {
    id: "act_008",
    timestamp: "2026-03-03 16:45:50",
    action: "Backup created",
    details: "Automatic daily backup completed",
    user: "System",
    severity: "info",
  },
];

export default function AdminShopDetail({ params }: { params: { id: string } }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

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

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#22c55e";
      case "pending":
        return "#f59e0b";
      case "failed":
        return "#ef4444";
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
    <div style={{ background: "var(--wl-bg-root)" }}>
      {/* Header */}
      <div
        style={{
          padding: "24px",
          borderBottom: "1px solid var(--wl-border)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <Link
          href="/admin"
          style={{
            color: "var(--wl-primary-500)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ArrowLeft  />
          Back to Shops
        </Link>
      </div>

      <div className="p-6">
        {/* Shop Header Card */}
        <Card
          style={{
            background: "var(--wl-bg-surface)",
            border: "1px solid var(--wl-border)",
            marginBottom: "24px",
          }}
        >
          <CardContent className="p-6">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "var(--wl-text-primary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  {mockShopDetail.name}
                </h1>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0", fontSize: "14px" }}>
                  {mockShopDetail.domain}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: getStatusColor(mockShopDetail.status) + "20",
                    color: getStatusColor(mockShopDetail.status),
                    border: `1px solid ${getStatusColor(mockShopDetail.status)}40`,
                  }}
                >
                  {mockShopDetail.status.toUpperCase()}
                </Badge>
                <Badge
                  style={{
                    background: getPlanColor(mockShopDetail.planTier) + "20",
                    color: getPlanColor(mockShopDetail.planTier),
                    border: `1px solid ${getPlanColor(mockShopDetail.planTier)}40`,
                  }}
                >
                  {mockShopDetail.planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Owner Info */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--wl-border)",
              }}
            >
              <div>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                  Owner Name
                </p>
                <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                  {mockShopDetail.owner.name}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                  Email
                </p>
                <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                  {mockShopDetail.owner.email}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                  Phone
                </p>
                <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                  {mockShopDetail.owner.phone}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                  Member Since
                </p>
                <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                  {new Date(mockShopDetail.owner.joinDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <Card style={{ background: "var(--wl-bg-surface)", border: "1px solid var(--wl-border)" }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start" >
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Total Orders
                  </p>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--wl-text-primary)", margin: "0" }}>
                    {mockShopDetail.usage.orders.toLocaleString()}
                  </p>
                </div>
                <ShoppingCart style={{ width: "24px", height: "24px", color: "var(--wl-primary-500)" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-bg-surface)", border: "1px solid var(--wl-border)" }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start" >
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Shipments
                  </p>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--wl-text-primary)", margin: "0" }}>
                    {mockShopDetail.usage.shipments.toLocaleString()}
                  </p>
                </div>
                <Truck style={{ width: "24px", height: "24px", color: "#8b5cf6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-bg-surface)", border: "1px solid var(--wl-border)" }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start" >
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Drivers
                  </p>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--wl-text-primary)", margin: "0" }}>
                    {mockShopDetail.usage.drivers}
                  </p>
                </div>
                <Users style={{ width: "24px", height: "24px", color: "#3b82f6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-bg-surface)", border: "1px solid var(--wl-border)" }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start" >
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    API Uptime
                  </p>
                  <p style={{ fontSize: "24px", fontWeight: "700", color: "var(--wl-text-primary)", margin: "0" }}>
                    {mockShopDetail.uptime}%
                  </p>
                </div>
                <Activity style={{ width: "24px", height: "24px", color: "var(--wl-success-400)" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Usage */}
        <Card
          style={{
            background: "var(--wl-bg-surface)",
            border: "1px solid var(--wl-border)",
            marginBottom: "24px",
          }}
        >
          <CardContent className="p-5">
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text-primary)", margin: "0 0 16px 0" }}>
              API Usage
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="flex-1" >
                <div
                  style={{
                    height: "8px",
                    background: "var(--wl-bg-root)",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(mockShopDetail.usage.apiCalls / mockShopDetail.usage.apiCallsLimit) * 100}%`,
                      background: "var(--wl-primary-500)",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <p style={{ color: "var(--wl-text-secondary)", margin: "0", fontSize: "12px" }}>
                  {mockShopDetail.usage.apiCalls.toLocaleString()} /{" "}
                  {mockShopDetail.usage.apiCallsLimit.toLocaleString()} calls
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "600" }}>
                  {((mockShopDetail.usage.apiCalls / mockShopDetail.usage.apiCallsLimit) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card
          style={{
            background: "var(--wl-bg-surface)",
            border: "1px solid var(--wl-border)",
            marginBottom: "24px",
          }}
        >
          <CardContent className="p-5">
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text-primary)", margin: "0 0 16px 0" }}>
                Current Billing
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                    Current Plan
                  </p>
                  <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                    {mockShopDetail.billing.currentPlan}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                    Monthly Fee
                  </p>
                  <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                    ${mockShopDetail.billing.monthlyFee}/month
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                    Next Billing Date
                  </p>
                  <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "500" }}>
                    {new Date(mockShopDetail.billing.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "12px" }}>
                    Status
                  </p>
                  <Badge
                    style={{
                      background: getBillingStatusColor(mockShopDetail.billing.status) + "20",
                      color: getBillingStatusColor(mockShopDetail.billing.status),
                      border: `1px solid ${getBillingStatusColor(mockShopDetail.billing.status)}40`,
                    }}
                  >
                    {mockShopDetail.billing.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div style={{ borderTop: "1px solid var(--wl-border)", paddingTop: "20px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "var(--wl-text-primary)", margin: "0 0 12px 0" }}>
                Billing History
              </h4>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {mockBillingHistory.map((record, index) => (
                  <div
                    key={record.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: index < mockBillingHistory.length - 1 ? "1px solid var(--wl-border)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p style={{ color: "var(--wl-text-primary)", margin: "0 0 4px 0", fontSize: "14px" }}>
                        {record.description}
                      </p>
                      <p style={{ color: "var(--wl-text-secondary)", margin: "0", fontSize: "12px" }}>
                        {new Date(record.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px", fontWeight: "600" }}>
                        ${record.amount}
                      </p>
                      <Badge
                        style={{
                          background: getBillingStatusColor(record.status) + "20",
                          color: getBillingStatusColor(record.status),
                          border: `1px solid ${getBillingStatusColor(record.status)}40`,
                          fontSize: "11px",
                        }}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card
          style={{
            background: "var(--wl-bg-surface)",
            border: "1px solid var(--wl-border)",
            marginBottom: "24px",
          }}
        >
          <CardContent className="p-5">
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text-primary)", margin: "0 0 16px 0" }}>
              Admin Actions
            </h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Button
                style={{
                  background: "var(--wl-primary-500)",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Crown  />
                Upgrade Plan
              </Button>

              <button
                onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                style={{
                  background: "var(--wl-warning-400)",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Lock  />
                Suspend Shop
              </button>

              <Button
                style={{
                  background: "rgba(108, 99, 255, 0.1)",
                  color: "var(--wl-primary-500)",
                  border: "1px solid var(--wl-primary)",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Zap  />
                Impersonate
              </Button>

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--wl-danger-400)",
                  border: "1px solid var(--wl-danger)",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Trash2  />
                Delete Account
              </button>
            </div>

            {/* Confirmation Dialogs */}
            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-wl-bg-root rounded">
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <AlertTriangle style={{ width: "16px", height: "16px", color: "var(--wl-warning-400)", flexShrink: 0 }} />
                  <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px" }}>
                    Suspending this shop will disable all access and API calls. This action can be reversed.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    style={{
                      background: "var(--wl-warning-400)",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Confirm Suspension
                  </button>
                  <button
                    onClick={() => setShowSuspendConfirm(false)}
                    style={{
                      background: "var(--wl-border-subtle)",
                      color: "var(--wl-text-primary)",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-wl-bg-root rounded">
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <AlertTriangle style={{ width: "16px", height: "16px", color: "var(--wl-danger-400)", flexShrink: 0 }} />
                  <p style={{ color: "var(--wl-text-primary)", margin: "0", fontSize: "14px" }}>
                    Deleting this account is permanent and cannot be undone. All data will be lost.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    style={{
                      background: "var(--wl-danger-400)",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      background: "var(--wl-border-subtle)",
                      color: "var(--wl-text-primary)",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card style={{ background: "var(--wl-bg-surface)", border: "1px solid var(--wl-border)" }}>
          <CardContent className="p-5">
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text-primary)", margin: "0 0 16px 0" }}>
              Activity Log
            </h3>
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {mockActivityLog.map((log, index) => (
                <div
                  key={log.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: index < mockActivityLog.length - 1 ? "1px solid var(--wl-border)" : "none",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: getSeverityColor(log.severity),
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: "0" }}>
                    <p style={{ color: "var(--wl-text-primary)", margin: "0 0 4px 0", fontSize: "14px" }}>
                      {log.action}
                    </p>
                    <p style={{ color: "var(--wl-text-secondary)", margin: "0 0 4px 0", fontSize: "13px" }}>
                      {log.details}
                    </p>
                    <div className="flex gap-3 items-center">
                      <span style={{ color: "var(--wl-text-secondary)", fontSize: "12px" }}>By: {log.user}</span>
                      <span style={{ color: "var(--wl-text-secondary)", fontSize: "12px" }}>{log.timestamp}</span>
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
