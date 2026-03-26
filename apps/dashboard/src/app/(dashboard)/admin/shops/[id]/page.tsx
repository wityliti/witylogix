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

const mockShopDetail: ShopDetail = {
  id: "shop_001",
  name: "Elegant Boutique",
  domain: "elegantboutique.com",
  planTier: "enterprise",
  status: "active",
  owner: {
    name: "Sarah Anderson",
    email: "sarah.anderson@elegantboutique.com",
    phone: "+1 (555) 123-4567",
    joinDate: "2024-01-15",
  },
  usage: {
    orders: 4523,
    shipments: 4456,
    drivers: 12,
    apiCalls: 450000,
    apiCallsLimit: 1000000,
  },
  billing: {
    currentPlan: "Enterprise",
    monthlyFee: 999,
    nextBillingDate: "2026-04-06",
    status: "active",
  },
  createdAt: "2024-01-15",
  lastActive: "2026-03-06 14:32:10",
  uptime: 99.98,
};

const mockBillingHistory: BillingRecord[] = [
  {
    id: "bill_001",
    date: "2026-03-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_002",
    date: "2026-02-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_003",
    date: "2026-01-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_004",
    date: "2025-12-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_005",
    date: "2025-11-06",
    description: "Enterprise Plan - Monthly",
    amount: 999,
    status: "paid",
  },
  {
    id: "bill_006",
    date: "2025-10-06",
    description: "Growth Plan - Monthly",
    amount: 499,
    status: "paid",
  },
];

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

export default function AdminShopDetail({ params }: { params: { id: string } }) {
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
                  {mockShopDetail.name}
                </h1>
                <p className="text-gray-400 text-sm">
                  {mockShopDetail.domain}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Badge
                  style={{
                    background: getStatusColor(mockShopDetail.status) + "20",
                    color: getStatusColor(mockShopDetail.status),
                    border: `1px solid ${getStatusColor(mockShopDetail.status)}40`,
                  }}
                >
                  {mockShopDetail.status.toUpperCase()}
                </Badge>
                <Badge
                  style={{
                    background: getPlanColor(mockShopDetail.planTier) + "20",
                    color: getPlanColor(mockShopDetail.planTier),
                    border: `1px solid ${getPlanColor(mockShopDetail.planTier)}40`,
                  }}
                >
                  {mockShopDetail.planTier.toUpperCase()}
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
                  {mockShopDetail.owner.name}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Email
                </p>
                <p className="text-white text-sm font-medium">
                  {mockShopDetail.owner.email}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Phone
                </p>
                <p className="text-white text-sm font-medium">
                  {mockShopDetail.owner.phone}
                </p>
              </div>
              <div>
                <p className="text-gray-400 mb-1 text-xs">
                  Member Since
                </p>
                <p className="text-white text-sm font-medium">
                  {new Date(mockShopDetail.owner.joinDate).toLocaleDateString()}
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
                    {mockShopDetail.usage.orders.toLocaleString()}
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
                    {mockShopDetail.usage.shipments.toLocaleString()}
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
                    {mockShopDetail.usage.drivers}
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
                    {mockShopDetail.uptime}%
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
                      width: `${(mockShopDetail.usage.apiCalls / mockShopDetail.usage.apiCallsLimit) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-gray-400 text-xs">
                  {mockShopDetail.usage.apiCalls.toLocaleString()} /{" "}
                  {mockShopDetail.usage.apiCallsLimit.toLocaleString()} calls
                </p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-semibold">
                  {((mockShopDetail.usage.apiCalls / mockShopDetail.usage.apiCallsLimit) * 100).toFixed(1)}%
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
                    {mockShopDetail.billing.currentPlan}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Monthly Fee
                  </p>
                  <p className="text-white text-sm font-medium">
                    ${mockShopDetail.billing.monthlyFee}/month
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Next Billing Date
                  </p>
                  <p className="text-white text-sm font-medium">
                    {new Date(mockShopDetail.billing.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 text-xs">
                    Status
                  </p>
                  <Badge
                    style={{
                      background: getBillingStatusColor(mockShopDetail.billing.status) + "20",
                      color: getBillingStatusColor(mockShopDetail.billing.status),
                      border: `1px solid ${getBillingStatusColor(mockShopDetail.billing.status)}40`,
                    }}
                  >
                    {mockShopDetail.billing.status.toUpperCase()}
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
                {mockBillingHistory.map((record, index) => (
                  <div
                    key={record.id}
                    className={cn("py-3 flex justify-between items-center", index < mockBillingHistory.length - 1 && "border-b border-[#1e1e2e]")}
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
              {mockActivityLog.map((log, index) => (
                <div
                  key={log.id}
                  className={cn("py-3 flex gap-3", index < mockActivityLog.length - 1 && "border-b border-[#1e1e2e]")}
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
