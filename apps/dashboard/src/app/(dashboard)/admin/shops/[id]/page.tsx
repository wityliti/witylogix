"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Users,
  Activity,
  AlertTriangle,
  Lock,
  Trash2,
  Crown,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';

interface ShopApiData {
  id: string;
  name: string;
  shopifyDomain?: string;
  email?: string;
  status: string;
  suspendedAt?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension?: { suspendedAt: string; reason?: string } | null;
  };
  subscription?: {
    planTier?: string;
    status?: string;
    billingCycleEnd?: string;
  } | null;
  users?: Array<{ id: string; role: string }>;
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  action: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  shopName?: string;
}

export default function AdminShopDetail() {
  const params = useParams();
  const shopId = params.id as string;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: shopData, loading, error, refetch } = useApiQuery<{ data: ShopApiData }>(
    shopId ? `/api/v4/admin/stores/${shopId}` : null,
  );

  const { items: activityLogs, loading: activityLoading } = useApiList<ActivityItem>(
    shopId ? `/api/v4/admin/activity?limit=20` : null,
  );

  const shop = shopData?.data;

  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "active": return "var(--wl-chart-green)";
      case "suspended": return "var(--wl-danger-500)";
      case "trial": return "var(--wl-warning-500)";
      default: return "var(--wl-chart-violet)";
    }
  };

  const getPlanColor = (plan?: string) => {
    switch ((plan || "").toLowerCase()) {
      case "free": return "var(--wl-chart-slate)";
      case "starter": return "var(--wl-info-500)";
      case "growth": return "var(--wl-chart-purple)";
      case "enterprise": return "var(--wl-chart-rose)";
      default: return "var(--wl-chart-violet)";
    }
  };

  const handleSuspend = async () => {
    setActionLoading("suspend");
    try {
      await api.put(`/api/v4/admin/stores/${shopId}/suspend`, { reason: "Manual suspension by admin" });
      await refetch();
      setShowSuspendConfirm(false);
    } catch {
      // error handled by UI
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async () => {
    setActionLoading("restore");
    try {
      await api.put(`/api/v4/admin/stores/${shopId}/restore`, {});
      await refetch();
    } catch {
      // error handled by UI
    } finally {
      setActionLoading(null);
    }
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
  const statusColor = getStatusColor(shop.status);

  return (
    <div className="bg-wl-bg-root-root">
      {/* Header */}
      <div className="px-6 py-6 border-b border-wl-border-default flex gap-4 items-center justify-between">
        <Link
          href="/admin"
          className="text-wl-info-500 no-underline flex items-center gap-2 hover:opacity-80"
        >
          <ArrowLeft size={20} />
          Back to Shops
        </Link>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-6">
        {/* Shop Header Card */}
        <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h1 className="text-2xl font-bold text-wl-text-primary mb-2">
                  {shop.name}
                </h1>
                <p className="text-wl-text-secondary text-sm">
                  {shop.shopifyDomain || shop.email || shop.id}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: `color-mix(in srgb, ${getStatusColor(shop.status)} 13%, transparent)`,
                    color: getStatusColor(shop.status),
                    border: `1px solid color-mix(in srgb, ${getStatusColor(shop.status)} 25%, transparent)`,
                  }}
                >
                  {shop.status}
                </Badge>
                <Badge
                  style={{
                    background: `color-mix(in srgb, ${getPlanColor(planTier)} 13%, transparent)`,
                    color: getPlanColor(planTier),
                    border: `1px solid color-mix(in srgb, ${getPlanColor(planTier)} 25%, transparent)`,
                  }}
                >
                  {planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Store Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-wl-border-default">
              <div>
                <p className="text-wl-text-secondary mb-1 text-xs">Store ID</p>
                <p className="text-wl-text-primary text-sm font-medium font-mono">{shop.id.slice(0, 8)}…</p>
              </div>
              <div>
                <p className="text-wl-text-secondary mb-1 text-xs">Email</p>
                <p className="text-wl-text-primary text-sm font-medium">{shop.email || "—"}</p>
              </div>
              <div>
                <p className="text-wl-text-secondary mb-1 text-xs">Plan Status</p>
                <p className="text-wl-text-primary text-sm font-medium">{shop.subscription?.status || "—"}</p>
              </div>
              <div>
                <p className="text-wl-text-secondary mb-1 text-xs">Member Since</p>
                <p className="text-wl-text-primary text-sm font-medium">
                  {new Date(shop.createdAt).toLocaleDateString()}
                </p>
              </div>
              {shop.usage.suspension && (
                <div>
                  <p className="text-wl-text-secondary mb-1 text-xs">Suspended</p>
                  <p className="text-wl-danger-400 text-xs">{shop.usage.suspension.reason ?? 'No reason given'}</p>
                </div>
              )}
            </div>

            {isSuspended && shop.usage.suspension && (
              <div className="mt-4 p-3 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-lg">
                <p className="text-wl-danger-400 text-sm font-medium">Suspended</p>
                {shop.usage.suspension.reason && (
                  <p className="text-wl-danger-400 text-xs mt-1">{shop.usage.suspension.reason}</p>
                )}
                <p className="text-wl-text-secondary text-xs mt-1">
                  Since: {new Date(shop.usage.suspension.suspendedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-text-secondary mb-2 text-xs">Total Orders</p>
                  <p className="text-2xl font-bold text-wl-text-primary">
                    {shop.usage.orders.toLocaleString()}
                  </p>
                </div>
                <ShoppingCart size={24} className="text-wl-info-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-text-secondary mb-2 text-xs">Team Users</p>
                  <p className="text-2xl font-bold text-wl-text-primary">
                    {shop.usage.users.toLocaleString()}
                  </p>
                </div>
                <Users size={24} className="text-wl-primary-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-text-secondary mb-2 text-xs">Drivers</p>
                  <p className="text-2xl font-bold text-wl-text-primary">
                    {shop.usage.drivers}
                  </p>
                </div>
                <Truck size={24} className="text-wl-info-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-bg-surface border border-wl-border-default">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-text-secondary mb-2 text-xs">Next Billing</p>
                  <p className="text-sm font-bold text-wl-text-primary">
                    {shop.subscription?.billingCycleEnd
                      ? new Date(shop.subscription.billingCycleEnd).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <Activity size={24} className="text-wl-success-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-wl-text-primary mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <Button variant="primary" size="sm" className="flex items-center gap-2">
                <Crown size={16} />
                Upgrade Plan
              </Button>

              {isSuspended ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRestore}
                  disabled={actionLoading === "restore"}
                  className="flex items-center gap-2 border-wl-success-500/40 text-wl-success-400 hover:bg-wl-success-500/10"
                >
                  <Lock size={16} />
                  {actionLoading === "restore" ? "Restoring…" : "Restore Shop"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                  className="flex items-center gap-2 border-wl-warning-500/40 text-wl-warning-400 hover:bg-wl-warning-500/10"
                >
                  <Lock size={16} />
                  Suspend Shop
                </Button>
              )}

              <Link
                href={`/admin/users?shopId=${shop.id}`}
                className="bg-wl-info-500/10 text-wl-info-400 border border-wl-info-400/40 px-4 py-2 rounded text-sm font-medium flex items-center gap-2 hover:opacity-80 no-underline"
              >
                <Zap size={16} />
                View Users
              </Link>

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="bg-wl-danger-500/10 text-wl-danger-500 border border-wl-danger-500/40 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80"
              >
                <Trash2 size={16} />
                Delete Account
              </button>
            </div>

            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-wl-warning-500/10 border border-wl-warning-500/20 rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-wl-warning-500 flex-shrink-0" />
                  <p className="text-wl-text-primary m-0 text-sm">
                    Suspending this shop will disable all access and API calls. This action can be reversed.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSuspend}
                    disabled={actionLoading === "suspend"}
                    className="bg-wl-warning-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading === "suspend" ? "Suspending…" : "Confirm Suspension"}
                  </button>
                  <button
                    onClick={() => setShowSuspendConfirm(false)}
                    className="bg-wl-bg-elevated text-wl-text-primary border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-wl-danger-500 flex-shrink-0" />
                  <p className="text-wl-text-primary m-0 text-sm">
                    Deleting this account is permanent and cannot be undone. All data will be lost.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-wl-danger-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-wl-bg-elevated text-wl-text-primary border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-wl-text-primary mb-4">Platform Activity Log</h3>
            {activityLoading ? (
              <LoadingSkeleton />
            ) : activityLogs.length === 0 ? (
              <p className="text-wl-text-secondary text-sm text-center py-8">No activity records found</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {activityLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className={cn("py-3 flex gap-3", index < activityLogs.length - 1 && "border-b border-wl-border-default")}
                  >
                    <div className="flex-shrink-0 rounded-full w-2 h-2 mt-1.5 bg-wl-info-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-wl-text-primary mb-1 text-sm">{log.action}</p>
                      <div className="flex gap-3 items-center">
                        <span className="text-wl-text-secondary text-xs">By: {log.userName}</span>
                        <span className="text-wl-text-secondary text-xs">
                          {new Date(log.timestamp).toLocaleString()}
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
