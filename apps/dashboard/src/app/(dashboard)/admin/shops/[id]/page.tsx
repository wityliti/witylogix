"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Users,
  Zap,
  CreditCard,
  AlertTriangle,
  Lock,
  Trash2,
  Crown,
  Activity,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { useParams } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface ShopDetail {
  id: string;
  name: string;
  domain: string;
  planTier: string;
  status: string;
  owner: { name: string; email: string; phone: string; joinDate: string };
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
    status: string;
  };
  createdAt: string;
  lastActive: string;
  uptime: number;
  billingHistory: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    status: string;
  }>;
  activityLog: Array<{
    id: string;
    timestamp: string;
    action: string;
    details: string;
    user: string;
    severity: string;
  }>;
}

function statusColor(s: string) {
  if (s === "active") return "#22c55e";
  if (s === "suspended") return "#ef4444";
  if (s === "trial") return "#f59e0b";
  return "#6C63FF";
}

function planColor(p: string) {
  if (p === "free") return "#94a3b8";
  if (p === "starter") return "#3b82f6";
  if (p === "growth") return "#8b5cf6";
  if (p === "enterprise") return "#ec4899";
  return "#6C63FF";
}

function billStatusColor(s: string) {
  if (s === "paid" || s === "active") return "#22c55e";
  if (s === "pending") return "#f59e0b";
  if (s === "failed") return "#ef4444";
  return "#6C63FF";
}

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

export default function AdminShopDetail() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!shop) return <ErrorState message="Shop not found" />;

  const apiUsagePct = shop.usage.apiCallsLimit > 0
    ? Math.min(100, (shop.usage.apiCalls / shop.usage.apiCallsLimit) * 100)
    : 0;

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <div className="px-6 py-6 border-b border-[#1e1e2e] flex gap-4 items-center">
        <Link href="/admin" className="text-blue-600 no-underline flex items-center gap-2 hover:opacity-80">
          <ArrowLeft size={20} />
          Back to Shops
        </Link>
      </div>

      <div className="p-6">
        {/* Shop Header Card */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{shop.name}</h1>
                <p className="text-gray-400 text-sm">{shop.domain}</p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge style={{ background: statusColor(shop.status) + "20", color: statusColor(shop.status), border: `1px solid ${statusColor(shop.status)}40` }}>
                  {shop.status.toUpperCase()}
                </Badge>
                <Badge style={{ background: planColor(shop.planTier) + "20", color: planColor(shop.planTier), border: `1px solid ${planColor(shop.planTier)}40` }}>
                  {shop.planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Owner Name</p>
                <p className="text-white text-sm font-medium">{shop.owner.name || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Email</p>
                <p className="text-white text-sm font-medium">{shop.owner.email || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Phone</p>
                <p className="text-white text-sm font-medium">{shop.owner.phone || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Member Since</p>
                <p className="text-white text-sm font-medium">
                  {shop.owner.joinDate ? new Date(shop.owner.joinDate).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{shop.usage.orders.toLocaleString()}</p>
                </div>
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Shipments</p>
                  <p className="text-2xl font-bold text-white">{shop.usage.shipments.toLocaleString()}</p>
                </div>
                <Truck size={24} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Drivers</p>
                  <p className="text-2xl font-bold text-white">{shop.usage.drivers}</p>
                </div>
                <Users size={24} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">API Uptime</p>
                  <p className="text-2xl font-bold text-white">{shop.uptime}%</p>
                </div>
                <Activity size={24} className="text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Usage */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">API Usage</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-[#0a0a0f] rounded overflow-hidden mb-2">
                  <div className="h-full rounded transition-all duration-300 bg-blue-500" style={{ width: `${apiUsagePct}%` }} />
                </div>
                <p className="text-gray-400 text-xs">
                  {shop.usage.apiCalls.toLocaleString()} / {shop.usage.apiCallsLimit.toLocaleString()} calls
                </p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-semibold">{apiUsagePct.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-white mb-4">Current Billing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Current Plan</p>
                  <p className="text-white text-sm font-medium">{shop.billing.currentPlan}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Monthly Fee</p>
                  <p className="text-white text-sm font-medium">${shop.billing.monthlyFee}/month</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Next Billing Date</p>
                  <p className="text-white text-sm font-medium">
                    {shop.billing.nextBillingDate ? new Date(shop.billing.nextBillingDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Status</p>
                  <Badge style={{ background: billStatusColor(shop.billing.status) + "20", color: billStatusColor(shop.billing.status), border: `1px solid ${billStatusColor(shop.billing.status)}40` }}>
                    {shop.billing.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div className="border-t border-[#1e1e2e] pt-5">
              <h4 className="text-sm font-semibold text-white mb-3">Billing History</h4>
              {shop.billingHistory.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No billing history available</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {shop.billingHistory.map((record, i) => (
                    <div key={record.id} className={cn("py-3 flex justify-between items-center", i < shop.billingHistory.length - 1 && "border-b border-[#1e1e2e]")}>
                      <div>
                        <p className="text-white mb-1 text-sm">{record.description}</p>
                        <p className="text-gray-400 text-xs">{record.date ? new Date(record.date).toLocaleDateString() : "—"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-white text-sm font-semibold">${record.amount}</p>
                        <Badge style={{ background: billStatusColor(record.status) + "20", color: billStatusColor(record.status), border: `1px solid ${billStatusColor(record.status)}40` }}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <Button className="bg-blue-600 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90">
                <Crown size={16} />Upgrade Plan
              </Button>
              <button onClick={() => setShowSuspendConfirm(!showSuspendConfirm)} className="bg-amber-500 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90">
                <Lock size={16} />Suspend Shop
              </button>
              <Button className="bg-blue-600 bg-opacity-10 text-blue-600 border border-blue-600 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80">
                <Zap size={16} />Impersonate
              </Button>
              <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} className="bg-red-500 bg-opacity-10 text-red-500 border border-red-500 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80">
                <Trash2 size={16} />Delete Account
              </button>
            </div>

            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f] rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-white m-0 text-sm">Suspending this shop will disable all access. This action can be reversed.</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-amber-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">Confirm Suspension</button>
                  <button onClick={() => setShowSuspendConfirm(false)} className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">Cancel</button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f] rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-white m-0 text-sm">Deleting this account is permanent and cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-red-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">Confirm Delete</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">Cancel</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Activity Log</h3>
            {shop.activityLog.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No activity recorded yet</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {shop.activityLog.map((log, i) => (
                  <div key={log.id} className={cn("py-3 flex gap-3", i < shop.activityLog.length - 1 && "border-b border-[#1e1e2e]")}>
                    <div className="flex-shrink-0 rounded-full w-2 h-2 mt-1.5" style={{ background: severityColor(log.severity) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white mb-1 text-sm">{log.action}</p>
                      {log.details && <p className="text-gray-400 mb-1 text-xs">{log.details}</p>}
                      <div className="flex gap-3 items-center">
                        <span className="text-gray-400 text-xs">By: {log.user}</span>
                        <span className="text-gray-400 text-xs">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
