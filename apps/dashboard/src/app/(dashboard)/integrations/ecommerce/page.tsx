'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Grid,
  MapPin,
  BarChart3,
  RotateCw,
  Trash2,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   E-COMMERCE PLATFORM CONFIGURATION PAGE
   ═══════════════════════════════════════════════════════════ */

interface PlatformConnection {
  id: string;
  name: string;
  slug: string;
  logo: string;
  status: "connected" | "disconnected" | "error" | "pending";
  apiKey?: string;
  lastSync?: string;
  productsSynced: number;
  ordersSynced: number;
  syncSettings: {
    productSync: { enabled: boolean; direction: "in" | "out" | "both" };
    orderSync: { enabled: boolean; direction: "in" | "out" | "both" };
    inventorySync: { enabled: boolean };
    customerSync: { enabled: boolean };
  };
  webhooks: {
    id: string;
    event: string;
    status: "active" | "failed";
    lastTriggered: string;
  }[];
}

interface ConflictRule {
  field: string;
  priority: string[];
}

const PLATFORMS: PlatformConnection[] = [
  {
    id: "shop-001",
    name: "Shopify",
    slug: "shopify",
    logo: "🛍",
    status: "connected",
    lastSync: "2026-03-12T14:32:00Z",
    productsSynced: 1247,
    ordersSynced: 3891,
    syncSettings: {
      productSync: { enabled: true, direction: "both" },
      orderSync: { enabled: true, direction: "in" },
      inventorySync: { enabled: true },
      customerSync: { enabled: true },
    },
    webhooks: [
      {
        id: "hook-001",
        event: "products/update",
        status: "active",
        lastTriggered: "2026-03-12T14:31:00Z",
      },
      {
        id: "hook-002",
        event: "orders/create",
        status: "active",
        lastTriggered: "2026-03-12T14:28:00Z",
      },
      {
        id: "hook-003",
        event: "inventory/update",
        status: "failed",
        lastTriggered: "2026-03-12T13:45:00Z",
      },
    ],
  },
  {
    id: "woo-001",
    name: "WooCommerce",
    slug: "woocommerce",
    logo: "🔧",
    status: "connected",
    lastSync: "2026-03-12T14:15:00Z",
    productsSynced: 856,
    ordersSynced: 2145,
    syncSettings: {
      productSync: { enabled: true, direction: "both" },
      orderSync: { enabled: true, direction: "both" },
      inventorySync: { enabled: true },
      customerSync: { enabled: false },
    },
    webhooks: [
      {
        id: "hook-004",
        event: "product.updated",
        status: "active",
        lastTriggered: "2026-03-12T14:12:00Z",
      },
      {
        id: "hook-005",
        event: "order.created",
        status: "active",
        lastTriggered: "2026-03-12T14:00:00Z",
      },
    ],
  },
  {
    id: "mag-001",
    name: "Magento",
    slug: "magento",
    logo: "📊",
    status: "disconnected",
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: "both" },
      orderSync: { enabled: false, direction: "in" },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: "bigc-001",
    name: "BigCommerce",
    slug: "bigcommerce",
    logo: "📈",
    status: "disconnected",
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: "both" },
      orderSync: { enabled: false, direction: "in" },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: "amz-001",
    name: "Amazon",
    slug: "amazon",
    logo: "🟠",
    status: "disconnected",
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: "in" },
      orderSync: { enabled: false, direction: "in" },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: "ebay-001",
    name: "eBay",
    slug: "ebay",
    logo: "🏷",
    status: "error",
    lastSync: "2026-03-11T10:00:00Z",
    productsSynced: 432,
    ordersSynced: 1205,
    syncSettings: {
      productSync: { enabled: true, direction: "both" },
      orderSync: { enabled: true, direction: "in" },
      inventorySync: { enabled: true },
      customerSync: { enabled: false },
    },
    webhooks: [
      {
        id: "hook-006",
        event: "ItemEnded",
        status: "failed",
        lastTriggered: "2026-03-11T09:45:00Z",
      },
    ],
  },
  {
    id: "etsy-001",
    name: "Etsy",
    slug: "etsy",
    logo: "✨",
    status: "disconnected",
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: "both" },
      orderSync: { enabled: false, direction: "in" },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
  {
    id: "sq-001",
    name: "Square Online",
    slug: "square",
    logo: "⬛",
    status: "disconnected",
    productsSynced: 0,
    ordersSynced: 0,
    syncSettings: {
      productSync: { enabled: false, direction: "both" },
      orderSync: { enabled: false, direction: "in" },
      inventorySync: { enabled: false },
      customerSync: { enabled: false },
    },
    webhooks: [],
  },
];

const CONFLICT_RULES: ConflictRule[] = [
  {
    field: "price",
    priority: ["Shopify", "WooCommerce", "Manual Override"],
  },
  {
    field: "inventory_level",
    priority: ["WooCommerce", "Shopify", "Manual Override"],
  },
  {
    field: "product_title",
    priority: ["Shopify", "WooCommerce", "Amazon"],
  },
  {
    field: "order_status",
    priority: ["Manual Override", "Shopify", "WooCommerce"],
  },
];

export default function ECommerceIntegrationPage() {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(
    "shop-001"
  );
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "mapping" | "webhooks" | "conflict"
  >("overview");

  const connected = PLATFORMS.filter((p) => p.status === "connected");
  const totalProducts = PLATFORMS.reduce((sum, p) => sum + p.productsSynced, 0);
  const totalOrders = PLATFORMS.reduce((sum, p) => sum + p.ordersSynced, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "pending":
        return <Clock className="w-5 h-5 text-amber-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">Connected</Badge>;
      case "error":
        return <Badge variant="danger">Error</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="default">Disconnected</Badge>;
    }
  };

  return (
    <>
      <Header
        title="E-Commerce Platforms"
        subtitle={`${connected.length} connected · ${totalProducts.toLocaleString()} products · ${totalOrders.toLocaleString()} orders`}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">
                {connected.length}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Connected Platforms
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">
                {totalProducts.toLocaleString()}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Total Products Synced
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">
                {totalOrders.toLocaleString()}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Total Orders Synced
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-white">
                {PLATFORMS.filter((p) => p.status === "error").length}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Sync Errors
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-[#1a1a2e] rounded-lg p-1 mb-8">
          {(
            [
              "overview",
              "mapping",
              "webhooks",
              "conflict",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                selectedTab === tab
                  ? "bg-blue-500 text-white"
                  : "text-gray-500 hover:text-gray-400"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === "overview" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                Platform Status
              </h2>
              <Button
                variant="primary"
                className="inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Connect Platform
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {PLATFORMS.map((platform) => (
                <Card
                  key={platform.id}
                  className={cn(
                    "bg-[#1a1a2e] border-[#1e1e2e] cursor-pointer transition-all hover:border-blue-500/50",
                    expandedPlatform === platform.id && "ring-1 ring-wl-primary-500"
                  )}
                  onClick={() =>
                    setExpandedPlatform(
                      expandedPlatform === platform.id ? null : platform.id
                    )
                  }
                >
                  <CardContent className="pt-6">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{platform.logo}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {platform.name}
                          </h3>
                          <div className="flex gap-2 mt-1">
                            {getStatusBadge(platform.status)}
                            {platform.lastSync && (
                              <span className="text-xs text-gray-500">
                                Last sync:{" "}
                                {new Date(platform.lastSync).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {platform.status === "connected" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-500"
                            >
                              <RotateCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-500"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <ChevronRight
                          className={cn(
                            "w-5 h-5 text-gray-500 transition-transform",
                            expandedPlatform === platform.id && "rotate-90"
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedPlatform === platform.id && (
                      <div className="mt-6 pt-6 border-t border-[#1e1e2e] space-y-6">
                        {/* Sync Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">
                              Products Synced
                            </div>
                            <div className="text-2xl font-bold text-white mt-1">
                              {platform.productsSynced.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">
                              Orders Synced
                            </div>
                            <div className="text-2xl font-bold text-white mt-1">
                              {platform.ordersSynced.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">
                              Product Sync
                            </div>
                            <div className="text-sm font-medium text-white mt-1">
                              {platform.syncSettings.productSync.direction.toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">
                              Order Sync
                            </div>
                            <div className="text-sm font-medium text-white mt-1">
                              {platform.syncSettings.orderSync.direction.toUpperCase()}
                            </div>
                          </div>
                        </div>

                        {/* Sync Settings */}
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-3">
                            Sync Settings
                          </h4>
                          <div className="space-y-2">
                            {[
                              {
                                label: "Product Sync",
                                enabled:
                                  platform.syncSettings.productSync.enabled,
                              },
                              {
                                label: "Order Sync",
                                enabled: platform.syncSettings.orderSync.enabled,
                              },
                              {
                                label: "Inventory Sync",
                                enabled:
                                  platform.syncSettings.inventorySync.enabled,
                              },
                              {
                                label: "Customer Sync",
                                enabled:
                                  platform.syncSettings.customerSync.enabled,
                              },
                            ].map((setting) => (
                              <div
                                key={setting.label}
                                className="flex items-center justify-between"
                              >
                                <span className="text-sm text-gray-400">
                                  {setting.label}
                                </span>
                                <Badge
                                  variant={
                                    setting.enabled ? "success" : "default"
                                  }
                                >
                                  {setting.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Webhooks */}
                        {platform.webhooks.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-white mb-3">
                              Webhooks ({platform.webhooks.length})
                            </h4>
                            <div className="space-y-2">
                              {platform.webhooks.map((hook) => (
                                <div
                                  key={hook.id}
                                  className="flex items-center justify-between p-2 bg-[#12121a] rounded text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">
                                      {hook.event}
                                    </span>
                                    <Badge
                                      variant={
                                        hook.status === "active"
                                          ? "success"
                                          : "danger"
                                      }
                                      dot
                                    >
                                      {hook.status}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      hook.lastTriggered
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {platform.status === "connected" && (
                          <div className="flex gap-2 pt-4 border-t border-[#1e1e2e]">
                            <Button variant="secondary" size="sm">
                              Edit Configuration
                            </Button>
                            <Button variant="danger" size="sm">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Disconnect
                            </Button>
                          </div>
                        )}
                        {platform.status === "disconnected" && (
                          <Button variant="primary" size="sm" className="w-full">
                            Connect {platform.name}
                          </Button>
                        )}
                        {platform.status === "error" && (
                          <div className="p-3 bg-red-900 rounded text-sm text-red-400">
                            Sync failed. Check webhooks configuration and try
                            again.
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Product Mapping Tab */}
        {selectedTab === "mapping" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">
              Product Mapping
            </h2>

            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid className="w-5 h-5" />
                  Category Mapping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      shopify: "Electronics > Computers",
                      woo: "Technology > Laptops",
                      amazon: "Computers & Accessories",
                    },
                    {
                      shopify: "Clothing > T-Shirts",
                      woo: "Apparel > Men's Shirts",
                      amazon: "Clothing, Shoes & Jewelry",
                    },
                    {
                      shopify: "Home > Kitchen",
                      woo: "Home & Garden > Kitchen",
                      amazon: "Home, Kitchen & Dining",
                    },
                  ].map((mapping, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]"
                    >
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Shopify
                          </div>
                          <div className="text-sm font-medium text-white mt-1">
                            {mapping.shopify}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            External
                          </div>
                          <div className="text-sm font-medium text-white mt-1">
                            {mapping.woo} / {mapping.amazon}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Variant Mapping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      attribute: "Size",
                      shopify: "size (xs, s, m, l, xl)",
                      woo: "size (small, medium, large)",
                    },
                    {
                      attribute: "Color",
                      shopify: "color (red, blue, green)",
                      woo: "color (rouge, bleu, vert)",
                    },
                    {
                      attribute: "Material",
                      shopify: "material (cotton, polyester)",
                      woo: "fabric (cotton, poly)",
                    },
                  ].map((variant, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]"
                    >
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                        {variant.attribute}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">
                            Shopify
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {variant.shopify}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            WooCommerce
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {variant.woo}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Webhooks Tab */}
        {selectedTab === "webhooks" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">
              Webhook Configuration
            </h2>

            <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {PLATFORMS.filter((p) => p.webhooks.length > 0).map((platform) => (
                    <div
                      key={platform.id}
                      className="border border-[#1e1e2e] rounded-lg p-4"
                    >
                      <h3 className="font-semibold text-white mb-3">
                        {platform.name} Webhooks
                      </h3>
                      <div className="space-y-2">
                        {platform.webhooks.map((hook) => (
                          <div
                            key={hook.id}
                            className="flex items-center justify-between p-3 bg-[#12121a] rounded"
                          >
                            <div>
                              <div className="text-sm font-medium text-white">
                                {hook.event}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Last triggered:{" "}
                                {new Date(hook.lastTriggered).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  hook.status === "active"
                                    ? "success"
                                    : "danger"
                                }
                                dot
                              >
                                {hook.status}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500"
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conflict Resolution Tab */}
        {selectedTab === "conflict" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">
                Conflict Resolution Rules
              </h2>
              <p className="text-sm text-gray-500">
                Define priority rules for when the same product field is
                synced from multiple platforms
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {CONFLICT_RULES.map((rule) => (
                <Card key={rule.field} className="bg-[#1a1a2e] border-[#1e1e2e]">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-white mb-4">
                      {rule.field.replace(/_/g, " ")}
                    </h3>
                    <div className="flex items-center gap-2">
                      {rule.priority.map((source, idx) => (
                        <div key={source} className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-medium">
                            {idx + 1}. {source}
                          </div>
                          {idx < rule.priority.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                    >
                      Edit Priority
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-[#12121a] border border-blue-500/20">
              <CardHeader>
                <CardTitle>Order Import Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-white">
                    Filter by Status
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      "pending",
                      "processing",
                      "completed",
                      "cancelled",
                    ].map((status) => (
                      <Badge key={status} variant="primary">
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white">
                    Date Range
                  </label>
                  <div className="text-sm text-gray-400 mt-2">
                    Last 90 days
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white">
                    Fulfillment Type
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["shipped", "in_transit", "delivered"].map((type) => (
                      <Badge key={type} variant="info">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
