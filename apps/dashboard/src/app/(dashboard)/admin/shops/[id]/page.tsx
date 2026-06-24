"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import {
  ArrowLeft,
  ShoppingCart,
  Users,
  Zap,
  AlertTriangle,
  Lock,
  Crown,
  AlertCircle,
} from "lucide-react";
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface StoreDetail {
  id: string;
  name: string;
  domain?: string;
  planTier?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  owner?: {
    name: string;
    email: string;
    phone?: string;
    joinDate?: string;
  };
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension?: {
      suspendedAt: string;
      reason?: string;
    } | null;
  };
  createdAt: string;
  updatedAt?: string;
}

export default function AdminShopDetail() {
  const params = useParams();
  const shopId = params.id as string;

  const { data: shopData, loading, error, refetch } = useApiQuery<ShopDetail>(`/api/v4/admin/stores/${shopId}`);
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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!shopData) return <ErrorState message="Shop not found" onRetry={refetch} />;

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
                <h1 className="text-2xl font-bold text-white mb-2">
                  {shopData.name}
                </h1>
                {shopData.domain && (
                  <p className="text-gray-400 text-sm">
                    {shopData.domain}
                  </p>
                )}
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: getStatusColor(shopData.status.toLowerCase()) + "20",
                    color: getStatusColor(shopData.status.toLowerCase()),
                    border: `1px solid ${getStatusColor(shopData.status.toLowerCase())}40`,
                  }}
                >
                  {shopData.status}
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

            {/* Owner Info */}
            {shopData.owner && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Owner Name</p>
                  <p className="text-white text-sm font-medium">{shopData.owner.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Email</p>
                  <p className="text-white text-sm font-medium">{shopData.owner.email}</p>
                </div>
                {shopData.owner.phone && (
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Phone</p>
                    <p className="text-white text-sm font-medium">{shopData.owner.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Created</p>
                  <p className="text-white text-sm font-medium">{new Date(shopData.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{shopData.usage.orders.toLocaleString()}</p>
                </div>
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Users</p>
                  <p className="text-2xl font-bold text-white">{shopData.usage.users.toLocaleString()}</p>
                </div>
                <Users size={24} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Drivers</p>
                  <p className="text-2xl font-bold text-white">{shopData.usage.drivers}</p>
                </div>
                <Users size={24} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suspension Info */}
        {shopData.usage.suspension && (
          <Card className="bg-[#12121a] border border-red-500/30 mb-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-red-500 mb-1">Account Suspended</h3>
                  <p className="text-gray-400 text-sm">
                    Suspended on {new Date(shopData.usage.suspension.suspendedAt).toLocaleDateString()}
                    {shopData.usage.suspension.reason && ` — ${shopData.usage.suspension.reason}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Section — no data from API */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Billing History</h3>
            <p className="text-gray-400 text-sm py-4 text-center">
              Billing history is not available for this shop.
            </p>
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
            <p className="text-gray-400 text-sm py-4 text-center">
              Activity log is not available for this shop.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
