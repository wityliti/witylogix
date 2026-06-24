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
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';
import { LoadingSkeleton } from '../../../../../components/ui/loading-skeleton';
import { ErrorState } from '../../../../../components/ui/error-state';

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


interface ShopApiResponse {
  shop: ShopDetail;
  billingHistory: BillingRecord[];
  activityLog: ActivityLog[];
}

export default function AdminShopDetail({ params }: { params: { id: string } }) {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useApiQuery<ShopApiResponse>(`/api/v4/admin/stores/${id ?? params.id}`);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!data) return <ErrorState message="Shop not found" onRetry={refetch} />;

  const shop = data.shop ?? data as unknown as ShopDetail;
  const billingHistory: BillingRecord[] = data.billingHistory ?? [];
  const activityLog: ActivityLog[] = data.activityLog ?? [];

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
                  {shop.domain}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: getStatusColor(shop.status) + "20",
                    color: getStatusColor(shop.status),
                    border: `1px solid ${getStatusColor(shop.status)}40`,
                  }}
                >
                  {shop.status.toUpperCase()}
                </Badge>
                <Badge
                  style={{
                    background: getPlanColor(shop.planTier) + "20",
                    color: getPlanColor(shop.planTier),
                    border: `1px solid ${getPlanColor(shop.planTier)}40`,
                  }}
                >
                  {shop.planTier.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Owner Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#1e1e2e]">
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Owner Name
                </p>
                <p className="text-white text-sm font-medium">
                  {shop.owner.name}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Email
                </p>
                <p className="text-white text-sm font-medium">
                  {shop.owner.email}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Phone
                </p>
                <p className="text-white text-sm font-medium">
                  {shop.owner.phone}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Member Since
                </p>
                <p className="text-white text-sm font-medium">
                  {new Date(shop.owner.joinDate).toLocaleDateString()}
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
                  <p className="text-gray-400 mb-2 text-xs">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {shop.usage.orders.toLocaleString()}
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
                  <p className="text-gray-400 mb-2 text-xs">
                    Shipments
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {shop.usage.shipments.toLocaleString()}
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
                  <p className="text-gray-400 mb-2 text-xs">
                    Drivers
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {shop.usage.drivers}
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
                  <p className="text-gray-400 mb-2 text-xs">
                    API Uptime
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {shop.uptime}%
                  </p>
                </div>
                <Activity size={24} className="text-emerald-500" />
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
                {billingHistory.map((record, index) => (
                  <div
                    key={record.id}
                    className={cn("py-3 flex justify-between items-center", index < billingHistory.length - 1 && "border-b border-[#1e1e2e]")}
                  >
                    <div>
                      <p className="text-white mb-1 text-sm">
                        {record.description}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(record.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-white text-sm font-semibold">
                        ${record.amount}
                      </p>
                      <Badge
                        style={{
                          background: getBillingStatusColor(record.status) + "20",
                          color: getBillingStatusColor(record.status),
                          border: `1px solid ${getBillingStatusColor(record.status)}40`,
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
              {activityLog.map((log, index) => (
                <div
                  key={log.id}
                  className={cn("py-3 flex gap-3", index < activityLog.length - 1 && "border-b border-[#1e1e2e]")}
                >
                  <div
                    className="flex-shrink-0 rounded-full w-2 h-2 mt-1.5"
                    style={{
                      background: getSeverityColor(log.severity),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white mb-1 text-sm">
                      {log.action}
                    </p>
                    <p className="text-gray-400 mb-1 text-xs">
                      {log.details}
                    </p>
                    <div className="flex gap-3 items-center">
                      <span className="text-gray-400 text-xs">By: {log.user}</span>
                      <span className="text-gray-400 text-xs">{log.timestamp}</span>
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
