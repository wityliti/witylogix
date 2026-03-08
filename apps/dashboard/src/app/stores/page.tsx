"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import Link from "next/link";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Plus,
  Store,
  Globe,
  RefreshCw,
  Settings,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Package,
  ShoppingCart,
  Activity,
} from "lucide-react";

interface Store {
  id: string;
  name: string;
  platform: "shopify" | "woocommerce" | "custom";
  domain: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync: string;
  orderCount: number;
  productCount: number;
  syncStatus: "idle" | "syncing" | "success" | "error";
  apiKey: string;
  webhooksActive: number;
  lastSyncDuration: string;
}

interface SyncHistory {
  id: string;
  storeId: string;
  timestamp: string;
  status: "success" | "failed" | "partial";
  itemsSynced: number;
  duration: string;
  message: string;
}

const mockStores: Store[] = [
  {
    id: "store_001",
    name: "Premium Fashion Outlet",
    platform: "shopify",
    domain: "premiumfashion.myshopify.com",
    status: "connected",
    lastSync: "2026-03-06 14:30:00",
    orderCount: 8945,
    productCount: 3421,
    syncStatus: "success",
    apiKey: "sk_live_****5k8j",
    webhooksActive: 12,
    lastSyncDuration: "4m 32s",
  },
  {
    id: "store_002",
    name: "Tech Electronics Store",
    platform: "woocommerce",
    domain: "techelectronics.com",
    status: "connected",
    lastSync: "2026-03-06 14:25:00",
    orderCount: 5234,
    productCount: 2156,
    syncStatus: "success",
    apiKey: "wc_live_****9k2m",
    webhooksActive: 8,
    lastSyncDuration: "3m 15s",
  },
  {
    id: "store_003",
    name: "Organic Beauty Products",
    platform: "shopify",
    domain: "organicbeauty.myshopify.com",
    status: "connected",
    lastSync: "2026-03-06 14:10:00",
    orderCount: 3421,
    productCount: 1245,
    syncStatus: "success",
    apiKey: "sk_live_****8m4p",
    webhooksActive: 10,
    lastSyncDuration: "2m 48s",
  },
  {
    id: "store_004",
    name: "Artisan Coffee Roastery",
    platform: "custom",
    domain: "artisancoffee.com",
    status: "syncing",
    lastSync: "2026-03-06 14:35:00",
    orderCount: 1567,
    productCount: 45,
    syncStatus: "syncing",
    apiKey: "api_custom_****4n6q",
    webhooksActive: 5,
    lastSyncDuration: "45s",
  },
  {
    id: "store_005",
    name: "Home Decor Marketplace",
    platform: "woocommerce",
    domain: "homedecor.com",
    status: "connected",
    lastSync: "2026-03-06 13:50:00",
    orderCount: 2789,
    productCount: 5678,
    syncStatus: "success",
    apiKey: "wc_live_****3d7r",
    webhooksActive: 7,
    lastSyncDuration: "6m 22s",
  },
  {
    id: "store_006",
    name: "Vintage Clothing Boutique",
    platform: "shopify",
    domain: "vintageboutique.myshopify.com",
    status: "error",
    lastSync: "2026-03-05 22:15:00",
    orderCount: 1234,
    productCount: 987,
    syncStatus: "error",
    apiKey: "sk_live_****7p2w",
    webhooksActive: 0,
    lastSyncDuration: "5m 10s",
  },
];

const mockSyncHistory: SyncHistory[] = [
  {
    id: "sync_001",
    storeId: "store_001",
    timestamp: "2026-03-06 14:30:00",
    status: "success",
    itemsSynced: 245,
    duration: "4m 32s",
    message: "Sync completed successfully",
  },
  {
    id: "sync_002",
    storeId: "store_002",
    timestamp: "2026-03-06 14:25:00",
    status: "success",
    itemsSynced: 189,
    duration: "3m 15s",
    message: "Sync completed successfully",
  },
  {
    id: "sync_003",
    storeId: "store_003",
    timestamp: "2026-03-06 14:10:00",
    status: "success",
    itemsSynced: 78,
    duration: "2m 48s",
    message: "Sync completed successfully",
  },
  {
    id: "sync_004",
    storeId: "store_001",
    timestamp: "2026-03-06 10:00:00",
    status: "success",
    itemsSynced: 312,
    duration: "5m 12s",
    message: "Sync completed successfully",
  },
  {
    id: "sync_005",
    storeId: "store_006",
    timestamp: "2026-03-05 22:15:00",
    status: "failed",
    itemsSynced: 0,
    duration: "2m 05s",
    message: "API key expired - reconnection required",
  },
];

export default function StoresManagement() {
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  const getPlatformIcon = (platform: string) => {
    if (platform === "shopify") return "Shopify";
    if (platform === "woocommerce") return "WooCommerce";
    return "Custom API";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "success":
        return "#22c55e";
      case "disconnected":
      case "error":
        return "#ef4444";
      case "syncing":
        return "#f59e0b";
      default:
        return "#6C63FF";
    }
  };

  const getSyncIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 style={{ width: "16px", height: "16px", color: "var(--wl-success)" }} />;
      case "error":
        return <AlertCircle style={{ width: "16px", height: "16px", color: "var(--wl-danger)" }} />;
      case "syncing":
        return <RefreshCw style={{ width: "16px", height: "16px", color: "var(--wl-warning)", animation: "spin 1s linear infinite" }} />;
      default:
        return <Clock style={{ width: "16px", height: "16px", color: "var(--wl-muted)" }} />;
    }
  };

  return (
    <div className="bg-wl-bg">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div className="px-6 py-8 border-b border-wl-border flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-wl-text mb-2">
            Connected Stores
          </h1>
          <p className="text-wl-muted text-sm">
            Manage all your connected e-commerce stores in one place
          </p>
        </div>
        <button
          onClick={() => setShowAddStoreModal(!showAddStoreModal)}
          className="bg-wl-primary text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 cursor-pointer hover:opacity-90"
        >
          <Plus size={16} />
          Add Store
        </button>
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-wl-card border border-wl-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-muted mb-2 text-xs">
                    Connected Stores
                  </p>
                  <p className="text-2xl font-bold text-wl-text">
                    {mockStores.filter((s) => s.status !== "disconnected").length}
                  </p>
                </div>
                <Store size={28} className="text-wl-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-card border border-wl-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-muted mb-2 text-xs">
                    Total Products
                  </p>
                  <p className="text-2xl font-bold text-wl-text">
                    {mockStores.reduce((sum, s) => sum + s.productCount, 0).toLocaleString()}
                  </p>
                </div>
                <Package size={28} className="text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-card border border-wl-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-muted mb-2 text-xs">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-wl-text">
                    {mockStores.reduce((sum, s) => sum + s.orderCount, 0).toLocaleString()}
                  </p>
                </div>
                <ShoppingCart size={28} className="text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-wl-card border border-wl-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-wl-muted mb-2 text-xs">
                    Active Webhooks
                  </p>
                  <p className="text-2xl font-bold text-wl-text">
                    {mockStores.reduce((sum, s) => sum + s.webhooksActive, 0)}
                  </p>
                </div>
                <Zap size={28} className="text-wl-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Store Modal */}
        {showAddStoreModal && (
          <Card className="bg-wl-card border border-wl-border mb-6">
            <CardContent className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-wl-text">
                  Connect New Store
                </h3>
                <button
                  onClick={() => setShowAddStoreModal(false)}
                  className="bg-transparent border-none text-wl-muted cursor-pointer text-xl hover:opacity-70"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button className="p-4 bg-wl-bg border border-wl-border rounded-lg cursor-pointer flex flex-col items-center gap-2 transition-all hover:border-wl-primary hover:bg-opacity-5">
                  <Store size={24} className="text-wl-primary" />
                  <span className="text-wl-text text-sm font-medium">
                    Connect Shopify
                  </span>
                </button>

                <button className="p-4 bg-wl-bg border border-wl-border rounded-lg cursor-pointer flex flex-col items-center gap-2 transition-all hover:border-wl-primary hover:bg-opacity-5">
                  <Globe size={24} className="text-wl-primary" />
                  <span className="text-wl-text text-sm font-medium">
                    Connect WooCommerce
                  </span>
                </button>

                <button className="p-4 bg-wl-bg border border-wl-border rounded-lg cursor-pointer flex flex-col items-center gap-2 transition-all hover:border-wl-primary hover:bg-opacity-5">
                  <Zap size={24} className="text-wl-primary" />
                  <span className="text-wl-text text-sm font-medium">
                    Custom API
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {mockStores.map((store) => (
            <Card
              key={store.id}
              className="bg-wl-card border border-wl-border cursor-pointer transition-all hover:border-wl-primary"
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-wl-text mb-1">
                      {store.name}
                    </h3>
                    <p className="text-wl-muted text-xs">
                      {getPlatformIcon(store.platform)}
                    </p>
                  </div>
                  <button className="bg-transparent border-none text-wl-muted cursor-pointer p-1 hover:opacity-70">
                    <MoreVertical size={16} />
                  </button>
                </div>

                <p className="text-wl-muted mb-4 text-xs break-all">
                  {store.domain}
                </p>

                {/* Status and Sync */}
                <div className="mb-4">
                  <div className="flex gap-2 items-center mb-2">
                    <Badge
                      style={{
                        background: getStatusColor(store.status) + "20",
                        color: getStatusColor(store.status),
                        border: `1px solid ${getStatusColor(store.status)}40`,
                      }}
                    >
                      {store.status.charAt(0).toUpperCase() + store.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {getSyncIcon(store.syncStatus)}
                    <span className="text-xs text-wl-muted">
                      {store.syncStatus === "syncing"
                        ? "Syncing..."
                        : store.syncStatus === "error"
                          ? "Sync failed"
                          : `Last sync: ${new Date(store.lastSync).toLocaleTimeString()}`}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-wl-border">
                  <div>
                    <p className="text-wl-muted mb-1 text-xs">
                      Products
                    </p>
                    <p className="text-wl-text font-semibold">
                      {store.productCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-muted mb-1 text-xs">
                      Orders
                    </p>
                    <p className="text-wl-text font-semibold">
                      {store.orderCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-muted mb-1 text-xs">
                      Webhooks
                    </p>
                    <p className="text-wl-text font-semibold">
                      {store.webhooksActive}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-muted mb-1 text-xs">
                      Last Sync
                    </p>
                    <p className="text-wl-text font-semibold">
                      {store.lastSyncDuration}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="flex-1 px-2 py-2 bg-wl-bg border border-wl-border rounded text-wl-text text-xs font-medium cursor-pointer flex items-center justify-center gap-1 hover:opacity-80">
                    <RefreshCw size={12} />
                    Sync Now
                  </button>
                  <button className="flex-1 px-2 py-2 bg-wl-primary bg-opacity-10 border border-wl-primary rounded text-wl-primary text-xs font-medium cursor-pointer flex items-center justify-center gap-1 hover:opacity-80">
                    <Settings size={12} />
                    Settings
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sync History */}
        <Card className="bg-wl-card border border-wl-border">
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-wl-text mb-4">
              Recent Sync Activity
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-wl-border">
                    <th className="px-3 py-3 text-left text-wl-muted font-medium text-xs uppercase">
                      Store
                    </th>
                    <th className="px-3 py-3 text-left text-wl-muted font-medium text-xs uppercase">
                      Time
                    </th>
                    <th className="px-3 py-3 text-center text-wl-muted font-medium text-xs uppercase">
                      Status
                    </th>
                    <th className="px-3 py-3 text-right text-wl-muted font-medium text-xs uppercase">
                      Items
                    </th>
                    <th className="px-3 py-3 text-right text-wl-muted font-medium text-xs uppercase">
                      Duration
                    </th>
                    <th className="px-3 py-3 text-left text-wl-muted font-medium text-xs uppercase">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockSyncHistory.map((history, index) => {
                    const store = mockStores.find((s) => s.id === history.storeId);
                    const statusColor = getStatusColor(history.status);

                    return (
                      <tr
                        key={history.id}
                        className="border-b border-wl-border transition-all hover:bg-wl-primary hover:bg-opacity-5"
                      >
                        <td className="px-3 py-3 text-wl-text font-medium">
                          {store?.name}
                        </td>
                        <td className="px-3 py-3 text-wl-muted text-sm">
                          {new Date(history.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge
                            style={{
                              background: statusColor + "20",
                              color: statusColor,
                              border: `1px solid ${statusColor}40`,
                            }}
                          >
                            {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right text-wl-text">
                          {history.itemsSynced.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-wl-muted text-sm">
                          {history.duration}
                        </td>
                        <td className="px-3 py-3 text-wl-muted text-sm">
                          {history.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
