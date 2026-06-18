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

export default function AdminShopDetail() {
  const params = useParams();
  const id = params?.id as string;

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

        {/* Admin actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="text-base text-white">Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {isSuspended ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRestore}
                  disabled={restoring}
                >
                  <Activity className="w-4 h-4" />
                  {restoring ? "Restoring…" : "Restore Store"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                  className="text-amber-500 border-amber-500/30"
                >
                  <Lock className="w-4 h-4" />
                  Suspend Store
                </Button>
              )}
            </div>

            {showSuspendConfirm && !isSuspended && (
              <div className="mt-4 p-4 rounded-lg bg-amber-900/20 border border-amber-500/30">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-400">
                    Suspending this store will immediately block all access. Provide a reason below.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Reason for suspension (optional)"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded bg-[#1a1a2e] border border-[#1e1e2e] text-white placeholder-gray-500 mb-3"
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleSuspend} disabled={suspending}
                    className="bg-red-600 hover:bg-red-700">
                    {suspending ? "Suspending…" : "Confirm Suspend"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowSuspendConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {isSuspended && store.usage.suspension && (
              <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-400 font-semibold">Suspended</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Since {new Date(store.usage.suspension.suspendedAt).toLocaleString()}
                    </p>
                    {store.usage.suspension.reason && (
                      <p className="text-xs text-gray-500 mt-0.5">Reason: {store.usage.suspension.reason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
