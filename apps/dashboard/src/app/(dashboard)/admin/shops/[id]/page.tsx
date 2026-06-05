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
  Crown,
  Activity,
  AlertTriangle,
  Lock,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════
   ADMIN SHOP DETAIL — Real API via /api/v4/admin/stores/:id
   ═══════════════════════════════════════════════════════════ */

interface ShopDetailResponse {
  id: string;
  name: string;
  shopifyDomain: string;
  email?: string;
  phone?: string;
  planTier: string;
  isActive: boolean;
  createdAt: string;
  status: string;
  usage: {
    orders: number;
    users: number;
    drivers: number;
    suspension: { suspendedAt: string; reason: string } | null;
  };
  subscription?: {
    planTier: string;
    status: string;
    billingCycleEnd?: string;
  };
}

const getStatusColor = (status: string): string => {
  const s = status?.toUpperCase();
  if (s === 'ACTIVE') return '#22c55e';
  if (s === 'SUSPENDED') return '#ef4444';
  if (s === 'TRIAL') return '#f59e0b';
  return '#6b7280';
};

const getPlanColor = (plan: string): string => {
  const p = plan?.toLowerCase();
  if (p === 'free') return '#94a3b8';
  if (p === 'starter') return '#3b82f6';
  if (p === 'growth') return '#8b5cf6';
  if (p === 'enterprise') return '#ec4899';
  return '#6b7280';
};

export default function AdminShopDetail() {
  const params = useParams();
  const shopId = params.id as string;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  const { data, loading, error, refetch } = useApiQuery<ShopDetailResponse>(
    `/api/v4/admin/stores/${shopId}`,
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-32 bg-white/[0.03] rounded animate-pulse" />
        <div className="h-36 bg-white/[0.03] rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/admin" className="text-blue-500 no-underline flex items-center gap-2 text-sm mb-6">
          <ArrowLeft size={16} /> Back to Shops
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-red-400 text-sm mb-3">{error?.message ?? 'Shop not found'}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const shop = data;
  const planTier = shop.subscription?.planTier ?? shop.planTier ?? 'free';
  const billingStatus = shop.subscription?.status ?? (shop.isActive ? 'active' : 'inactive');
  const billingEnd = shop.subscription?.billingCycleEnd;

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#1e1e2e] flex gap-4 items-center">
        <Link href="/admin" className="text-blue-500 no-underline flex items-center gap-2 hover:opacity-80 text-sm">
          <ArrowLeft size={18} />
          Back to Shops
        </Link>
      </div>

      <div className="p-6">
        {/* Shop Header Card */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{shop.name}</h1>
                <p className="text-gray-400 text-sm">{shop.shopifyDomain}</p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge style={{
                  background: getStatusColor(shop.status) + '20',
                  color: getStatusColor(shop.status),
                  border: `1px solid ${getStatusColor(shop.status)}40`,
                }}>
                  {shop.status?.toUpperCase() ?? '—'}
                </Badge>
                <Badge style={{
                  background: getPlanColor(planTier) + '20',
                  color: getPlanColor(planTier),
                  border: `1px solid ${getPlanColor(planTier)}40`,
                }}>
                  {planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Contact + Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Email</p>
                <p className="text-white text-sm font-medium">{shop.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Phone</p>
                <p className="text-white text-sm font-medium">{shop.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Installed</p>
                <p className="text-white text-sm font-medium">
                  {new Date(shop.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Billing Cycle End</p>
                <p className="text-white text-sm font-medium">
                  {billingEnd ? new Date(billingEnd).toLocaleDateString() : '—'}
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
                <ShoppingCart size={24} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Users</p>
                  <p className="text-2xl font-bold text-white">{shop.usage.users.toLocaleString()}</p>
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
                <Users size={24} className="text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 mb-2 text-xs">Account Status</p>
                  <p className="text-sm font-bold text-white mt-1 capitalize">{billingStatus}</p>
                </div>
                <Activity size={24} className="text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suspension notice */}
        {shop.usage.suspension && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-semibold">Shop Suspended</p>
              <p className="text-red-400/70 text-xs mt-0.5">
                {shop.usage.suspension.reason || 'No reason provided'} ·{' '}
                {new Date(shop.usage.suspension.suspendedAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Billing Section */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Current Billing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-gray-400 mb-1 text-xs">Current Plan</p>
                <p className="text-white text-sm font-medium capitalize">{planTier}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Next Billing Date</p>
                <p className="text-white text-sm font-medium">
                  {billingEnd ? new Date(billingEnd).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">Subscription Status</p>
                <span className={cn('text-sm font-semibold capitalize',
                  billingStatus === 'active' ? 'text-emerald-400' : 'text-gray-400'
                )}>
                  {billingStatus}
                </span>
              </div>
            </div>

            <div className="border-t border-[#1e1e2e] pt-5">
              <h4 className="text-sm font-semibold text-white mb-3">Billing History</h4>
              <p className="text-gray-500 text-xs py-4 text-center">
                Billing history is not available via the current API. Coming soon.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Admin Actions</h3>
            <div className="flex gap-3 flex-wrap">
              <Button className="bg-blue-600 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90">
                <Crown size={16} /> Upgrade Plan
              </Button>
              <button
                onClick={() => setShowSuspendConfirm(!showSuspendConfirm)}
                className="bg-amber-500 text-white border-none px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-90"
              >
                <Lock size={16} /> Suspend Shop
              </button>
              <Button className="bg-blue-600 bg-opacity-10 text-blue-500 border border-blue-600 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80">
                <Zap size={16} /> Impersonate
              </Button>
              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="bg-red-500 bg-opacity-10 text-red-500 border border-red-500 px-4 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 hover:opacity-80"
              >
                <Trash2 size={16} /> Delete Account
              </button>
            </div>

            {showSuspendConfirm && (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded">
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
              <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded">
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

        {/* Activity Log placeholder */}
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-white mb-4">Activity Log</h3>
            <p className="text-gray-500 text-xs py-6 text-center">
              Activity log API endpoint is not yet implemented. Coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
