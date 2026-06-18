"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Users,
  CreditCard,
  AlertTriangle,
  Lock,
  Crown,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface StoreDetail {
  id: string;
  name: string;
  shopifyDomain: string;
  email: string | null;
  phone: string | null;
  planTier: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
  status: "ACTIVE" | "SUSPENDED";
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension: { suspendedAt: string; reason: string | null } | null;
  };
  subscription: {
    planTier: string;
    status: string;
    billingCycleEnd: string | null;
  } | null;
}

interface ActivityItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
}

function planColor(plan: string) {
  const map: Record<string, string> = {
    FREE: "#94a3b8", STARTER: "#3b82f6", GROWTH: "#8b5cf6", ENTERPRISE: "#ec4899",
  };
  return map[plan?.toUpperCase()] ?? "#6C63FF";
}

function normalizeShop(raw: any): ShopDetail {
  const d = raw?.data ?? raw ?? {};
  const sub = d.subscription ?? {};
  const usage = d.usage ?? {};
  return {
    id: d.id ?? '',
    name: d.name ?? d.shopifyDomain ?? d.id ?? '—',
    domain: d.shopifyDomain ?? '—',
    planTier: (sub.planTier ?? 'free') as ShopDetail['planTier'],
    status: (d.status === 'SUSPENDED' ? 'suspended' : d.status === 'TRIAL' ? 'trial' : 'active') as ShopDetail['status'],
    owner: {
      name: d.ownerName ?? '—',
      email: d.ownerEmail ?? '—',
      phone: d.ownerPhone ?? '—',
      joinDate: d.createdAt ?? new Date().toISOString(),
    },
    usage: {
      orders: usage.orders ?? 0,
      shipments: usage.shipments ?? 0,
      drivers: usage.drivers ?? 0,
      apiCalls: usage.apiCalls ?? 0,
      apiCallsLimit: usage.apiCallsLimit ?? 1000000,
    },
    billing: {
      currentPlan: sub.planTier ? (sub.planTier.charAt(0).toUpperCase() + sub.planTier.slice(1)) : '—',
      monthlyFee: sub.monthlyFee ?? 0,
      nextBillingDate: sub.billingCycleEnd ?? new Date().toISOString(),
      status: (sub.status ?? 'active') as 'active' | 'overdue' | 'pending',
    },
    createdAt: d.createdAt ?? new Date().toISOString(),
    lastActive: d.updatedAt ?? d.createdAt ?? new Date().toISOString(),
    uptime: d.uptime ?? 99.9,
  };
}

export default function AdminShopDetail() {
  const params = useParams();
  const shopId = params.id as string;
  const { data: raw, loading, error, refetch } = useApiQuery<{data: any}>(`/api/v4/admin/stores/${shopId}`);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: store, loading, error, refetch } = useApiQuery<StoreDetail>(`/api/v4/admin/stores/${id}`);
  const { data: billingHistory, loading: billingLoading } = useApiQuery<BillingRecord[]>(`/api/v4/admin/stores/${id}/billing-history`);

  const { execute: suspendStore, loading: suspending } = useApiMutation<{ data: StoreDetail }>('PUT', `/api/v4/admin/stores/${id}/suspend`);
  const { execute: restoreStore, loading: restoring } = useApiMutation<{ data: StoreDetail }>('PUT', `/api/v4/admin/stores/${id}/restore`);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!store) return <ErrorState message="Store not found" />;

  const isSuspended = store.status === "SUSPENDED";
  const plan = store.subscription?.planTier ?? store.planTier;
  const sub = store.subscription;

  const handleSuspend = async () => {
    await suspendStore({ reason: suspendReason || undefined });
    setShowSuspendConfirm(false);
    refetch();
  };

  const handleRestore = async () => {
    await restoreStore({});
    refetch();
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="p-6">
        <ErrorState message={error?.message || "Shop not found"} onRetry={refetch} />
      </div>
    );
  }

  const planTier = shop.subscription?.planTier || "unknown";
  const isSuspended = shop.status === "SUSPENDED";

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  const shop = normalizeShop(raw);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#1e1e2e] flex gap-4 items-center">
        <Link href="/admin" className="text-blue-500 flex items-center gap-2 hover:opacity-80 text-sm">
          <ArrowLeft size={16} />
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
                <p className="text-sm text-gray-400">{store.shopifyDomain}</p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  className={cn(
                    "text-xs font-semibold",
                    isSuspended
                      ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  )}
                >
                  {store.status}
                </Badge>
                <Badge
                  className="text-xs font-semibold"
                  style={{
                    background: planColor(plan) + "20",
                    color: planColor(plan),
                    border: `1px solid ${planColor(plan)}40`,
                  }}
                >
                  <Crown className="w-3 h-3 mr-1" />
                  {plan?.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Usage stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: ShoppingCart, label: "Orders", value: store.usage.orders.toLocaleString(), color: "text-blue-500" },
                { icon: Truck, label: "Drivers", value: store.usage.drivers.toLocaleString(), color: "text-emerald-500" },
                { icon: Users, label: "Users", value: store.usage.users.toLocaleString(), color: "text-purple-500" },
                {
                  icon: CreditCard,
                  label: "Plan",
                  value: sub?.status === "ACTIVE" ? "Active" : sub?.status ?? "Free",
                  color: "text-amber-500",
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="p-4 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-center">
                  <Icon className={cn("w-5 h-5 mx-auto mb-2", color)} />
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-lg font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {isSuspended && shop.usage.suspension && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-900/40 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Suspended</p>
                {shop.usage.suspension.reason && (
                  <p className="text-red-300 text-xs mt-1">{shop.usage.suspension.reason}</p>
                )}
                <p className="text-gray-400 text-xs mt-1">
                  Since: {new Date(shop.usage.suspension.suspendedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Store Info */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-base text-white">Store Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Email", value: store.email ?? "—" },
                  { label: "Phone", value: store.phone ?? "—" },
                  { label: "Currency", value: store.currency },
                  { label: "Timezone", value: store.timezone },
                  { label: "Created", value: new Date(store.createdAt).toLocaleDateString() },
                  { label: "Last Updated", value: new Date(store.updatedAt).toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-[#1e1e2e] last:border-0">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-sm text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-base text-white">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              {sub ? (
                <div className="space-y-3">
                  {[
                    { label: "Plan", value: sub.planTier },
                    { label: "Status", value: sub.status },
                    {
                      label: "Next Billing",
                      value: sub.billingCycleEnd
                        ? new Date(sub.billingCycleEnd).toLocaleDateString()
                        : "—",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-[#1e1e2e] last:border-0">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-sm text-white font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">No subscription data</p>
              )}

              {/* Billing History */}
              <div className="mt-4 pt-4 border-t border-[#1e1e2e]">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Billing History</h4>
                {billingLoading ? (
                  <div className="h-16 bg-[#1a1a2e] animate-pulse rounded" />
                ) : (billingHistory ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-3">No billing records</p>
                ) : (
                  <div className="space-y-2">
                    {(billingHistory ?? []).map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-xs font-medium text-white">{bill.description}</p>
                          <p className="text-xs text-gray-500">{new Date(bill.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-white">${bill.amount}</p>
                          <Badge
                            variant={bill.status === "paid" ? "success" : bill.status === "failed" ? "danger" : "warning"}
                            className="text-[10px]"
                          >
                            {bill.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Usage */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">
              API Usage
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-[#0a0a0f]-root rounded overflow-hidden mb-2">
                  <div
                    className="h-full rounded transition-all duration-300 bg-[#3b82f6]"
                    style={{
                      width: `${(shop.usage.apiCalls / shop.usage.apiCallsLimit) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-gray-400 text-xs">
                  {shop.usage.apiCalls.toLocaleString()} /{" "}
                  {shop.usage.apiCallsLimit.toLocaleString()} calls
                </p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-semibold">
                  {((shop.usage.apiCalls / shop.usage.apiCallsLimit) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-white mb-4">
                Current Billing
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Current Plan
                  </p>
                  <p className="text-white text-sm font-medium">
                    {shop.billing.currentPlan}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Monthly Fee
                  </p>
                  <p className="text-white text-sm font-medium">
                    ${shop.billing.monthlyFee}/month
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Next Billing Date
                  </p>
                  <p className="text-white text-sm font-medium">
                    {new Date(shop.billing.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Status
                  </p>
                  <Badge
                    style={{
                      background: getBillingStatusColor(shop.billing.status) + "20",
                      color: getBillingStatusColor(shop.billing.status),
                      border: `1px solid ${getBillingStatusColor(shop.billing.status)}40`,
                    }}
                  >
                    {shop.billing.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div className="border-t border-[#1e1e2e] pt-5">
              <h4 className="text-sm font-semibold text-white mb-3">
                Billing History
              </h4>
              <div className="max-h-80 overflow-y-auto">
                {([] as BillingRecord[]).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No billing history available</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">
              Admin Actions
            </h3>
            <div className="flex gap-3 flex-wrap">
              <Button className="bg-blue-600 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90">
                <Crown size={16} />
                Upgrade Plan
              </Button>

              <button
                onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                className="bg-amber-500 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90"
              >
                <Lock size={16} />
                Suspend Shop
              </button>

              <Button className="bg-blue-600 bg-opacity-10 text-blue-600 border border-blue-600 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80">
                <Zap size={16} />
                Impersonate
              </Button>

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="bg-red-500 bg-opacity-10 text-red-500 border border-red-500 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80"
              >
                <Trash2 size={16} />
                Delete Account
              </button>
            </div>

            {/* Confirmation Dialogs */}
            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f]-root rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-white m-0 text-sm">
                    Suspending this shop will disable all access and API calls. This action can be reversed.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-amber-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">
                    Confirm Suspension
                  </button>
                  <button
                    onClick={() => setShowSuspendConfirm(false)}
                    className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-[#0a0a0f]-root rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-white m-0 text-sm">
                    Deleting this account is permanent and cannot be undone. All data will be lost.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-red-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">
              Activity Log
            </h3>
            <div className="max-h-96 overflow-y-auto">
              {([] as ActivityLog[]).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No activity logs available</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
