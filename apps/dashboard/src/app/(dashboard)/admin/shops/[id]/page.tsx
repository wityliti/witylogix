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
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";

interface ApiShop {
  id: string;
  name: string;
  shopifyDomain: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string | null;
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension?: { suspendedAt: string; reason: string } | null;
  };
  subscription?: {
    planTier: string;
    status: string;
    billingCycleEnd?: string;
  } | null;
}

const getPlanColor = (plan: string) => {
  switch ((plan ?? '').toLowerCase()) {
    case "free": return "#94a3b8";
    case "starter": return "#3b82f6";
    case "growth": return "#8b5cf6";
    case "enterprise": return "#ec4899";
    default: return "#6C63FF";
  }
};

const getStatusColor = (status: string) => {
  switch ((status ?? '').toUpperCase()) {
    case "ACTIVE": return "#22c55e";
    case "SUSPENDED": return "#ef4444";
    case "TRIAL": return "#f59e0b";
    default: return "#6C63FF";
  }
};

export default function AdminShopDetail() {
  const params = useParams();
  const id = params.id as string;
  const { addToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  const { data, loading, error, refetch } = useApiQuery<ApiShop>(`/api/v4/admin/stores/${id}`);
  const [suspending, setSuspending] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const isSuspended = (data?.status ?? '').toUpperCase() === 'SUSPENDED';

  const handleSuspend = async () => {
    setSuspending(true);
    try {
      await api.put(`/api/v4/admin/stores/${id}/suspend`, { reason: 'Admin action' });
      addToast({ type: 'success', title: 'Shop suspended', message: `${data?.name} has been suspended.` });
      refetch();
    } catch {
      addToast({ type: 'error', title: 'Failed', message: 'Could not suspend shop.' });
    } finally {
      setSuspending(false);
    }
    setShowSuspendConfirm(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.put(`/api/v4/admin/stores/${id}/restore`, {});
      addToast({ type: 'success', title: 'Shop restored', message: `${data?.name} has been restored.` });
      refetch();
    } catch {
      addToast({ type: 'error', title: 'Failed', message: 'Could not restore shop.' });
    } finally {
      setRestoring(false);
    }
  };

  if (loading) return (
    <div className="p-6">
      <LoadingSkeleton />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <ErrorState message={error.message} onRetry={refetch} />
    </div>
  );

  if (!data) return null;

  const planTier = data.subscription?.planTier ?? 'free';
  const status = data.status ?? 'ACTIVE';

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
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
                <h1 className="text-2xl font-bold text-white mb-2">{data.name}</h1>
                <p className="text-gray-400 text-sm">{data.shopifyDomain}</p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge style={{
                  background: getStatusColor(status) + "20",
                  color: getStatusColor(status),
                  border: `1px solid ${getStatusColor(status)}40`,
                }}>
                  {status.toUpperCase()}
                </Badge>
                <Badge style={{
                  background: getPlanColor(planTier) + "20",
                  color: getPlanColor(planTier),
                  border: `1px solid ${getPlanColor(planTier)}40`,
                }}>
                  {planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Member Since</p>
                <p className="text-white text-sm font-medium">{new Date(data.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Last Updated</p>
                <p className="text-white text-sm font-medium">{new Date(data.updatedAt).toLocaleDateString()}</p>
              </div>
              {data.subscription?.billingCycleEnd && (
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Next Billing</p>
                  <p className="text-white text-sm font-medium">{new Date(data.subscription.billingCycleEnd).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {data.suspendedAt && data.usage.suspension && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
                <p className="text-red-400 text-xs font-medium">
                  Suspended {new Date(data.usage.suspension.suspendedAt).toLocaleString()} — {data.usage.suspension.reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Total Orders</p>
                  <p className="text-2xl font-bold text-white">{data.usage.orders.toLocaleString()}</p>
                </div>
                <ShoppingCart size={24} className="text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Users</p>
                  <p className="text-2xl font-bold text-white">{data.usage.users}</p>
                </div>
                <Users size={24} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Drivers</p>
                  <p className="text-2xl font-bold text-white">{data.usage.drivers}</p>
                </div>
                <Truck size={24} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Plan Status</p>
                  <p className="text-2xl font-bold text-white capitalize">{data.subscription?.status ?? '—'}</p>
                </div>
                <Activity size={24} className="text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Summary */}
        {data.subscription && (
          <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-white mb-4">Subscription</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Plan Tier</p>
                  <p className="text-white text-sm font-medium capitalize">{data.subscription.planTier}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">Status</p>
                  <Badge variant={data.subscription.status === 'active' ? 'success' : 'warning'}>
                    {data.subscription.status}
                  </Badge>
                </div>
                {data.subscription.billingCycleEnd && (
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Renews</p>
                    <p className="text-white text-sm font-medium">{new Date(data.subscription.billingCycleEnd).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <Button className="bg-blue-600 text-white border-none">
                <Crown size={16} />
                Upgrade Plan
              </Button>

              {isSuspended ? (
                <Button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="bg-emerald-600 text-white border-none"
                >
                  <Zap size={16} />
                  {restoring ? 'Restoring…' : 'Restore Shop'}
                </Button>
              ) : (
                <button
                  onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                  className="bg-amber-500 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90"
                >
                  <Lock size={16} />
                  Suspend Shop
                </button>
              )}

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="bg-red-500/10 text-red-500 border border-red-500 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80"
              >
                <Trash2 size={16} />
                Delete Account
              </button>
            </div>

            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-white text-sm">
                    Suspending this shop will disable all access. This can be reversed.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSuspend}
                    disabled={suspending}
                    className="bg-amber-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {suspending ? 'Suspending…' : 'Confirm Suspension'}
                  </button>
                  <button
                    onClick={() => setShowSuspendConfirm(false)}
                    className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
                <div className="flex gap-2 items-start mb-3">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-white text-sm">
                    Deleting this account is permanent and cannot be undone. All data will be lost.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-red-500 text-white border-none px-4 py-2 rounded text-xs cursor-pointer hover:opacity-90">
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-[#1e1e2e] text-white border-none px-4 py-2 rounded text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
