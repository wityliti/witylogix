"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShoppingCart,
  Users,
  Activity,
  AlertTriangle,
  Lock,
  Crown,
  Zap,
} from "lucide-react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";

interface StoreDetail {
  id: string;
  name: string;
  shopifyDomain?: string;
  email?: string;
  planTier?: string;
  status: "ACTIVE" | "SUSPENDED";
  installedAt: string;
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension?: { suspendedAt: string; reason?: string } | null;
  };
  subscription?: {
    planTier: string;
    status: string;
    billingCycleEnd: string;
  } | null;
}

interface BillingRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  actor: string;
  severity: "info" | "warning" | "error";
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#22c55e",
  SUSPENDED: "#ef4444",
  active: "#22c55e",
  trialing: "#a78bfa",
  past_due: "#f59e0b",
  cancelled: "#6b7280",
};

const PLAN_COLOR: Record<string, string> = {
  FREE: "#94a3b8",
  STARTER: "#3b82f6",
  GROWTH: "#8b5cf6",
  ENTERPRISE: "#ec4899",
};

const BILLING_STATUS_COLOR: Record<string, string> = {
  paid: "#22c55e",
  pending: "#f59e0b",
  failed: "#ef4444",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "#6C63FF",
  warning: "#f59e0b",
  error: "#ef4444",
};

export default function AdminShopDetail() {
  const { id } = useParams<{ id: string }>();
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: store, loading: storeLoading, error: storeError, refetch: refetchStore } = useApiQuery<StoreDetail>(`/api/v4/admin/stores/${id}`);
  const { data: billingData, loading: billingLoading } = useApiQuery<{ data: BillingRecord[] }>(`/api/v4/admin/stores/${id}/billing`);
  const { data: activityData, loading: activityLoading } = useApiQuery<{ data: ActivityEntry[] }>(`/api/v4/admin/stores/${id}/activity`);

  const { execute: suspendStore, loading: suspending } = useApiMutation<unknown>('POST', `/api/v4/admin/stores/${id}/suspend`);

  const billing: BillingRecord[] = (billingData as unknown as { data: BillingRecord[] })?.data ?? [];
  const activity: ActivityEntry[] = (activityData as unknown as { data: ActivityEntry[] })?.data ?? [];

  const loading = storeLoading;

  if (loading) return <LoadingSkeleton className="m-6" />;
  if (storeError) return <ErrorState message={storeError.message} onRetry={refetchStore} />;
  if (!store) return null;

  const planTier = (store.subscription?.planTier ?? store.planTier ?? "FREE").toUpperCase();
  const statusColor = STATUS_COLOR[store.status] ?? "#6C63FF";
  const planColor = PLAN_COLOR[planTier] ?? "#6C63FF";
  const subStatus = store.subscription?.status ?? "active";

  const handleSuspend = async () => {
    await suspendStore({});
    setShowSuspendConfirm(false);
    refetchStore();
  };

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#1e1e2e] flex gap-4 items-center">
        <Link href="/admin" className="text-blue-500 no-underline flex items-center gap-2 hover:opacity-80 text-sm">
          <ArrowLeft size={18} />
          Back to Shops
        </Link>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Shop Header Card */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{store.name}</h1>
                {store.shopifyDomain && <p className="text-gray-400 text-sm">{store.shopifyDomain}</p>}
                {store.email && <p className="text-gray-500 text-xs mt-0.5">{store.email}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <Badge
                  style={{
                    background: `${statusColor}20`,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  {store.status}
                </Badge>
                <Badge
                  style={{
                    background: `${planColor}20`,
                    color: planColor,
                    border: `1px solid ${planColor}40`,
                  }}
                >
                  {planTier}
                </Badge>
                {shopData.planTier && (
                  <Badge
                    style={{
                      background: getPlanColor(shopData.planTier.toLowerCase()) + "20",
                      color: getPlanColor(shopData.planTier.toLowerCase()),
                      border: `1px solid ${getPlanColor(shopData.planTier.toLowerCase())}40`,
                    }}
                  >
                    {shopData.planTier.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Member Since</p>
                <p className="text-white text-sm font-medium">
                  {new Date(store.installedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Plan Status</p>
                <Badge
                  style={{
                    background: `${STATUS_COLOR[subStatus] ?? "#6C63FF"}20`,
                    color: STATUS_COLOR[subStatus] ?? "#6C63FF",
                    border: `1px solid ${STATUS_COLOR[subStatus] ?? "#6C63FF"}40`,
                  }}
                >
                  {subStatus}
                </Badge>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Billing Cycle End</p>
                <p className="text-white text-sm font-medium">
                  {store.subscription?.billingCycleEnd
                    ? new Date(store.subscription.billingCycleEnd).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              {store.usage.suspension && (
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Suspended</p>
                  <p className="text-red-400 text-xs">{store.usage.suspension.reason ?? 'No reason given'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4 flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs mb-2">Total Orders</p>
                <p className="text-2xl font-bold text-white">{store.usage.orders.toLocaleString()}</p>
              </div>
              <ShoppingCart size={24} className="text-blue-500" />
            </CardContent>
          </Card>
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4 flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs mb-2">Drivers</p>
                <p className="text-2xl font-bold text-white">{store.usage.drivers}</p>
              </div>
              <Truck size={24} className="text-purple-500" />
            </CardContent>
          </Card>
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4 flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs mb-2">Team Members</p>
                <p className="text-2xl font-bold text-white">{store.usage.users}</p>
              </div>
              <Users size={24} className="text-emerald-500" />
            </CardContent>
          </Card>
        )}

        {/* Billing History */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Billing History</h3>
            {billingLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-[#1e1e2e] animate-pulse" />
                ))}
              </div>
            ) : billing.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No billing records found</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {billing.map((record, index) => (
                  <div
                    key={record.id}
                    className={cn("py-3 flex justify-between items-center", index < billing.length - 1 && "border-b border-[#1e1e2e]")}
                  >
                    <div>
                      <p className="text-white text-sm">{record.description}</p>
                      <p className="text-gray-400 text-xs">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-white text-sm font-semibold">
                        {record.currency.toUpperCase()} {Number(record.amount).toFixed(2)}
                      </p>
                      <Badge
                        style={{
                          background: `${BILLING_STATUS_COLOR[record.status] ?? "#6C63FF"}20`,
                          color: BILLING_STATUS_COLOR[record.status] ?? "#6C63FF",
                          border: `1px solid ${BILLING_STATUS_COLOR[record.status] ?? "#6C63FF"}40`,
                        }}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <Button className="bg-blue-600 text-white border-none px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
                <Crown size={16} />
                Upgrade Plan
              </Button>
              <Button
                onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                disabled={store.status === "SUSPENDED" || suspending}
                className="bg-amber-500 text-white border-none px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
              >
                <Lock size={16} />
                {store.status === "SUSPENDED" ? "Already Suspended" : "Suspend Shop"}
              </Button>
              <Button className="bg-blue-600/10 text-blue-500 border border-blue-600/30 px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
                <Zap size={16} />
                Impersonate
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Account
              </Button>
            </div>

            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f] rounded border border-amber-600/30">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-white text-sm">Suspending this shop will disable all access and API calls. This can be reversed.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSuspend} disabled={suspending} className="bg-amber-500 text-white text-xs px-4 py-2 rounded">
                    {suspending ? "Suspending…" : "Confirm Suspension"}
                  </Button>
                  <Button onClick={() => setShowSuspendConfirm(false)} variant="secondary" className="text-xs px-4 py-2">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f] rounded border border-red-500/30">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-white text-sm">Deleting this account is permanent and cannot be undone.</p>
                </div>
                <div className="flex gap-2">
                  <Button className="bg-red-500 text-white text-xs px-4 py-2 rounded">Confirm Delete</Button>
                  <Button onClick={() => setShowDeleteConfirm(false)} variant="secondary" className="text-xs px-4 py-2">Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Activity Log</h3>
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded bg-[#1e1e2e] animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No activity logs found</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {activity.map((log, index) => (
                  <div
                    key={log.id}
                    className={cn("py-3 flex gap-3", index < activity.length - 1 && "border-b border-[#1e1e2e]")}
                  >
                    <div
                      className="flex-shrink-0 rounded-full w-2 h-2 mt-1.5"
                      style={{ background: SEVERITY_COLOR[log.severity] ?? "#6C63FF" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm capitalize">{log.action}</p>
                      <p className="text-gray-400 text-xs">{log.details}</p>
                      <div className="flex gap-3 items-center mt-1">
                        <span className="text-gray-500 text-xs capitalize">{log.actor}</span>
                        <span className="text-gray-500 text-xs">{new Date(log.timestamp).toLocaleString()}</span>
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
