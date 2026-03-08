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
    <div style={{ background: "var(--wl-bg)" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "32px 24px",
          borderBottom: "1px solid var(--wl-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "var(--wl-text)",
              margin: "0 0 8px 0",
            }}
          >
            Connected Stores
          </h1>
          <p style={{ color: "var(--wl-muted)", margin: "0", fontSize: "14px" }}>
            Manage all your connected e-commerce stores in one place
          </p>
        </div>
        <button
          onClick={() => setShowAddStoreModal(!showAddStoreModal)}
          style={{
            background: "var(--wl-primary)",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Plus style={{ width: "16px", height: "16px" }} />
          Add Store
        </button>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Summary Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Connected Stores
                  </p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {mockStores.filter((s) => s.status !== "disconnected").length}
                  </p>
                </div>
                <Store style={{ width: "28px", height: "28px", color: "var(--wl-primary)" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Total Products
                  </p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {mockStores.reduce((sum, s) => sum + s.productCount, 0).toLocaleString()}
                  </p>
                </div>
                <Package style={{ width: "28px", height: "28px", color: "#8b5cf6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Total Orders
                  </p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {mockStores.reduce((sum, s) => sum + s.orderCount, 0).toLocaleString()}
                  </p>
                </div>
                <ShoppingCart style={{ width: "28px", height: "28px", color: "#3b82f6" }} />
              </div>
            </CardContent>
          </Card>

          <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: "var(--wl-muted)", margin: "0 0 8px 0", fontSize: "12px" }}>
                    Active Webhooks
                  </p>
                  <p style={{ fontSize: "28px", fontWeight: "700", color: "var(--wl-text)", margin: "0" }}>
                    {mockStores.reduce((sum, s) => sum + s.webhooksActive, 0)}
                  </p>
                </div>
                <Zap style={{ width: "28px", height: "28px", color: "var(--wl-success)" }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Store Modal */}
        {showAddStoreModal && (
          <Card
            style={{
              background: "var(--wl-card)",
              border: "1px solid var(--wl-border)",
              marginBottom: "24px",
            }}
          >
            <CardContent style={{ padding: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text)", margin: "0" }}>
                  Connect New Store
                </h3>
                <button
                  onClick={() => setShowAddStoreModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--wl-muted)",
                    cursor: "pointer",
                    fontSize: "20px",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                <button
                  style={{
                    padding: "16px",
                    background: "var(--wl-bg)",
                    border: "1px solid var(--wl-border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-primary)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(108, 99, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-border)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg)";
                  }}
                >
                  <Store style={{ width: "24px", height: "24px", color: "var(--wl-primary)" }} />
                  <span style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>
                    Connect Shopify
                  </span>
                </button>

                <button
                  style={{
                    padding: "16px",
                    background: "var(--wl-bg)",
                    border: "1px solid var(--wl-border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-primary)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(108, 99, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-border)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg)";
                  }}
                >
                  <Globe style={{ width: "24px", height: "24px", color: "var(--wl-primary)" }} />
                  <span style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>
                    Connect WooCommerce
                  </span>
                </button>

                <button
                  style={{
                    padding: "16px",
                    background: "var(--wl-bg)",
                    border: "1px solid var(--wl-border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-primary)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(108, 99, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--wl-border)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--wl-bg)";
                  }}
                >
                  <Zap style={{ width: "24px", height: "24px", color: "var(--wl-primary)" }} />
                  <span style={{ color: "var(--wl-text)", fontSize: "14px", fontWeight: "500" }}>
                    Custom API
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {mockStores.map((store) => (
            <Card
              key={store.id}
              style={{
                background: "var(--wl-card)",
                border: "1px solid var(--wl-border)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--wl-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--wl-border)";
              }}
            >
              <CardContent style={{ padding: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "var(--wl-text)",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {store.name}
                    </h3>
                    <p style={{ color: "var(--wl-muted)", margin: "0", fontSize: "12px" }}>
                      {getPlatformIcon(store.platform)}
                    </p>
                  </div>
                  <button
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--wl-muted)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    <MoreVertical style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>

                <p style={{ color: "var(--wl-muted)", margin: "0 0 16px 0", fontSize: "12px", wordBreak: "break-all" }}>
                  {store.domain}
                </p>

                {/* Status and Sync */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
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

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {getSyncIcon(store.syncStatus)}
                    <span style={{ fontSize: "12px", color: "var(--wl-muted)" }}>
                      {store.syncStatus === "syncing"
                        ? "Syncing..."
                        : store.syncStatus === "error"
                          ? "Sync failed"
                          : `Last sync: ${new Date(store.lastSync).toLocaleTimeString()}`}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "16px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid var(--wl-border)",
                  }}
                >
                  <div>
                    <p style={{ color: "var(--wl-muted)", margin: "0 0 4px 0", fontSize: "11px" }}>
                      Products
                    </p>
                    <p style={{ color: "var(--wl-text)", margin: "0", fontSize: "16px", fontWeight: "600" }}>
                      {store.productCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--wl-muted)", margin: "0 0 4px 0", fontSize: "11px" }}>
                      Orders
                    </p>
                    <p style={{ color: "var(--wl-text)", margin: "0", fontSize: "16px", fontWeight: "600" }}>
                      {store.orderCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--wl-muted)", margin: "0 0 4px 0", fontSize: "11px" }}>
                      Webhooks
                    </p>
                    <p style={{ color: "var(--wl-text)", margin: "0", fontSize: "16px", fontWeight: "600" }}>
                      {store.webhooksActive}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--wl-muted)", margin: "0 0 4px 0", fontSize: "11px" }}>
                      Last Sync
                    </p>
                    <p style={{ color: "var(--wl-text)", margin: "0", fontSize: "16px", fontWeight: "600" }}>
                      {store.lastSyncDuration}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "4px",
                      color: "var(--wl-text)",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <RefreshCw style={{ width: "12px", height: "12px" }} />
                    Sync Now
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "rgba(108, 99, 255, 0.1)",
                      border: "1px solid var(--wl-primary)",
                      borderRadius: "4px",
                      color: "var(--wl-primary)",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <Settings style={{ width: "12px", height: "12px" }} />
                    Settings
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sync History */}
        <Card style={{ background: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
          <CardContent style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--wl-text)", margin: "0 0 16px 0" }}>
              Recent Sync Activity
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--wl-border)" }}>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Store
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Time
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Items
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      Duration
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        color: "var(--wl-muted)",
                        fontWeight: "500",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
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
                        style={{
                          borderBottom: "1px solid var(--wl-border)",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "rgba(108, 99, 255, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "12px", color: "var(--wl-text)" }}>
                          <span style={{ fontWeight: "500" }}>{store?.name}</span>
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "13px" }}>
                          {new Date(history.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
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
                        <td style={{ padding: "12px", textAlign: "right", color: "var(--wl-text)" }}>
                          {history.itemsSynced.toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", color: "var(--wl-muted)", fontSize: "13px" }}>
                          {history.duration}
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "13px" }}>
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
