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
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface ShopDetail {
  id: string;
  name: string;
  shopifyDomain?: string;
  domain?: string;
  planTier?: "free" | "starter" | "growth" | "enterprise" | "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
  status?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  installedAt?: string;
  updatedAt?: string;
  usage?: {
    orders: number;
    users: number;
    drivers: number;
  };
  subscription?: {
    planTier?: string;
    status?: string;
    billingCycleEnd?: string;
  };
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

export default function AdminShopDetail() {
  const params = useParams();
  const shopId = params.id as string;

  const { data: shopData, loading: shopLoading, error: shopError, refetch: shopRefetch } = useApiQuery<{ data: ShopDetail }>(`/api/v4/admin/stores/${shopId}`);
  const { items: billingHistory, loading: billingLoading } = useApiList<BillingRecord>(`/api/v4/admin/stores/${shopId}/billing`);
  const { items: activityLog, loading: activityLoading } = useApiList<ActivityLog>(`/api/v4/admin/stores/${shopId}/activity`);

  const shop = shopData?.data;

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

  if (shopLoading) return <TableSkeleton rows={6} columns={3} />;
  if (shopError) return <ErrorState message={shopError.message} onRetry={shopRefetch} />;
  if (!shop) return <ErrorState message="Shop not found" onRetry={shopRefetch} />;

  const planTier = (shop.planTier ?? 'free').toLowerCase() as "free" | "starter" | "growth" | "enterprise";
  const status = (shop.status ?? 'active').toLowerCase();
  const domain = shop.shopifyDomain ?? shop.domain ?? '—';

  return (
    <div className="bg-[#0a0a0f]-root">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#1e1e2e] flex gap-4 items-center">
        <Link
          href="/admin"
          className="text-blue-600 no-underline flex items-center gap-2 hover:opacity-80"
        >
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
                <h1 className="text-2xl font-bold text-white mb-2">
                  {shop.name}
                </h1>
                <p className="text-gray-400 text-sm">
                  {domain}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: getStatusColor(status) + "20",
                    color: getStatusColor(status),
                    border: `1px solid ${getStatusColor(status)}40`,
                  }}
                >
                  {status.toUpperCase()}
                </Badge>
                <Badge
                  style={{
                    background: getPlanColor(planTier) + "20",
                    color: getPlanColor(planTier),
                    border: `1px solid ${getPlanColor(planTier)}40`,
                  }}
                >
                  {planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Owner Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Contact Email</p>
                <p className="text-white text-sm font-medium">{shop.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Phone</p>
                <p className="text-white text-sm font-medium">{shop.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Member Since</p>
                <p className="text-white text-sm font-medium">
                  {shop.installedAt || shop.createdAt ? new Date(shop.installedAt ?? shop.createdAt!).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Users</p>
                <p className="text-white text-sm font-medium">{shop.usage?.users ?? 0}</p>
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
                  <p className="text-gray-400 mb-2 text-xs">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {(shop.usage?.orders ?? 0).toLocaleString()}
                  </p>
                </div>
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Drivers</p>
                  <p className="text-2xl font-bold text-white">
                    {(shop.usage?.drivers ?? 0).toLocaleString()}
                  </p>
                </div>
                <Truck size={24} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Users</p>
                  <p className="text-2xl font-bold text-white">
                    {(shop.usage?.users ?? 0).toLocaleString()}
                  </p>
                </div>
                <Users size={24} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Plan</p>
                  <p className="text-2xl font-bold text-white capitalize">{planTier}</p>
                </div>
                <Activity size={24} className="text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Info */}
        {shop.subscription && (
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Subscription</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">Plan</p>
                <p className="text-white text-sm font-medium capitalize">{(shop.subscription.planTier ?? 'free').toLowerCase()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Status</p>
                <p className="text-white text-sm font-medium capitalize">{(shop.subscription.status ?? 'active').toLowerCase()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Billing Cycle End</p>
                <p className="text-white text-sm font-medium">
                  {shop.subscription.billingCycleEnd ? new Date(shop.subscription.billingCycleEnd).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Billing History */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Billing History</h3>
            {billingLoading ? (
              <TableSkeleton rows={4} columns={3} />
            ) : billingHistory.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No billing records found.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {billingHistory.map((record, index) => (
                  <div
                    key={record.id}
                    className={cn("py-3 flex justify-between items-center", index < billingHistory.length - 1 && "border-b border-[#1e1e2e]")}
                  >
                    <div>
                      <p className="text-white mb-1 text-sm">{record.description}</p>
                      <p className="text-gray-400 text-xs">{record.date ? new Date(record.date).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-white text-sm font-semibold">${record.amount?.toFixed(2) ?? '0.00'}</p>
                      <Badge
                        style={{
                          background: getBillingStatusColor(record.status) + "20",
                          color: getBillingStatusColor(record.status),
                          border: `1px solid ${getBillingStatusColor(record.status)}40`,
                        }}
                      >
                        {(record.status ?? 'unknown').charAt(0).toUpperCase() + (record.status ?? 'unknown').slice(1)}
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
            <h3 className="text-base font-semibold text-white mb-4">Activity Log</h3>
            {activityLoading ? (
              <TableSkeleton rows={5} columns={2} />
            ) : activityLog.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No activity recorded yet.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {activityLog.map((log, index) => (
                  <div
                    key={log.id}
                    className={cn("py-3 flex gap-3", index < activityLog.length - 1 && "border-b border-[#1e1e2e]")}
                  >
                    <div
                      className="flex-shrink-0 rounded-full w-2 h-2 mt-1.5"
                      style={{ background: getSeverityColor(log.severity) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white mb-1 text-sm">{log.action}</p>
                      <p className="text-gray-400 mb-1 text-xs">{log.details}</p>
                      <div className="flex gap-3 items-center">
                        <span className="text-gray-400 text-xs">By: {log.user}</span>
                        <span className="text-gray-400 text-xs">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
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
