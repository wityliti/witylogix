"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  ShoppingCart,
  Package,
  DollarSign,
  BarChart3,
  RotateCw,
  Star,
  TrendingUp,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Copy,
  Zap,
  AlertTriangle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   E-COMMERCE EXTENDED INTEGRATION PAGE
   Amazon Seller Central · eBay · Etsy · Square Online
   ═══════════════════════════════════════════════════════════ */

interface EcommerceProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSync?: string;
  activeListings: number;
  ordersMonth: number;
  revenueMonth: number;
  apiStatus: "healthy" | "degraded" | "down";
  errorMessage?: string;
}

interface InventorySyncStatus {
  id: string;
  provider: string;
  lastSync: string;
  totalSKUs: number;
  syncedSuccessfully: number;
  syncErrors: number;
  quantityVariance: number;
  status: "synced" | "syncing" | "error" | "pending";
}

interface Order {
  id: string;
  orderId: string;
  marketplace: string;
  channel: string;
  customerName: string;
  orderDate: string;
  amount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "returned" | "cancelled";
  items: number;
  shippingStatus: string;
}

interface ProductListing {
  id: string;
  sku: string;
  title: string;
  price: number;
  quantity: number;
  status: "active" | "inactive" | "delisted" | "error";
  marketplace: string;
  views: number;
  conversions: number;
  rating: number;
  reviews: number;
}

interface ReturnsRefund {
  id: string;
  orderId: string;
  marketplace: string;
  reason: string;
  status: "initiated" | "approved" | "shipped-back" | "refunded" | "denied";
  amount: number;
  initiatedDate: string;
  resolvedDate?: string;
}

interface MarketplaceAnalytic {
  marketplace: string;
  salesMonth: number;
  fees: number;
  profitMargin: number;
  orderCount: number;
  avgOrderValue: number;
  conversionRate: number;
}

interface ReviewFeedback {
  id: string;
  marketplace: string;
  orderId: string;
  rating: number;
  review: string;
  reviewer: string;
  date: string;
  status: "new" | "responding" | "resolved";
  response?: string;
}

interface FulfillmentConfig {
  marketplace: string;
  fulfillmentType: "FBA" | "FBM" | "hybrid";
  fbaPercentage?: number;
  fbmPercentage?: number;
  avgFulfillmentTime: number;
  lastUpdated: string;
}

const PROVIDERS: EcommerceProvider[] = [
  {
    id: "amazon",
    name: "Amazon Seller Central",
    logo: "🛒",
    status: "connected",
    lastSync: "2026-03-12T14:32:00Z",
    activeListings: 4567,
    ordersMonth: 3245,
    revenueMonth: 687432,
    apiStatus: "healthy",
  },
  {
    id: "ebay",
    name: "eBay",
    logo: "📦",
    status: "connected",
    lastSync: "2026-03-12T14:15:00Z",
    activeListings: 2134,
    ordersMonth: 1823,
    revenueMonth: 342156,
    apiStatus: "healthy",
  },
  {
    id: "etsy",
    name: "Etsy",
    logo: "🎨",
    status: "connected",
    lastSync: "2026-03-12T13:45:00Z",
    activeListings: 1245,
    ordersMonth: 567,
    revenueMonth: 124567,
    apiStatus: "healthy",
  },
  {
    id: "square",
    name: "Square Online",
    logo: "◇",
    status: "connected",
    lastSync: "2026-03-12T14:00:00Z",
    activeListings: 856,
    ordersMonth: 412,
    revenueMonth: 89234,
    apiStatus: "degraded",
    errorMessage: "API response time elevated",
  },
];

const INVENTORY_SYNC: InventorySyncStatus[] = [
  {
    id: "sync-001",
    provider: "Amazon Seller Central",
    lastSync: "2026-03-12T14:32:00Z",
    totalSKUs: 4567,
    syncedSuccessfully: 4534,
    syncErrors: 33,
    quantityVariance: 12,
    status: "synced",
  },
  {
    id: "sync-002",
    provider: "eBay",
    lastSync: "2026-03-12T14:15:00Z",
    totalSKUs: 2134,
    syncedSuccessfully: 2089,
    syncErrors: 45,
    quantityVariance: 28,
    status: "synced",
  },
  {
    id: "sync-003",
    provider: "Etsy",
    lastSync: "2026-03-12T13:45:00Z",
    totalSKUs: 1245,
    syncedSuccessfully: 1245,
    syncErrors: 0,
    quantityVariance: 0,
    status: "synced",
  },
  {
    id: "sync-004",
    provider: "Square Online",
    lastSync: "2026-03-12T14:00:00Z",
    totalSKUs: 856,
    syncedSuccessfully: 823,
    syncErrors: 33,
    quantityVariance: 19,
    status: "synced",
  },
];

const ORDERS: Order[] = [
  {
    id: "order-001",
    orderId: "AMZ-2026-001234",
    marketplace: "Amazon",
    channel: "FBA",
    customerName: "John Smith",
    orderDate: "2026-03-12T14:32:00Z",
    amount: 127.99,
    status: "shipped",
    items: 3,
    shippingStatus: "In Transit (Est. 3/14)",
  },
  {
    id: "order-002",
    orderId: "EBY-2026-005678",
    marketplace: "eBay",
    channel: "Marketplace",
    customerName: "Jane Doe",
    orderDate: "2026-03-12T13:15:00Z",
    amount: 89.50,
    status: "processing",
    items: 2,
    shippingStatus: "Label Created",
  },
  {
    id: "order-003",
    orderId: "ETY-2026-009012",
    marketplace: "Etsy",
    channel: "Marketplace",
    customerName: "Bob Johnson",
    orderDate: "2026-03-12T10:45:00Z",
    amount: 245.75,
    status: "delivered",
    items: 1,
    shippingStatus: "Delivered (3/11)",
  },
  {
    id: "order-004",
    orderId: "SQR-2026-003456",
    marketplace: "Square Online",
    channel: "Direct",
    customerName: "Alice Williams",
    orderDate: "2026-03-11T22:10:00Z",
    amount: 156.25,
    status: "pending",
    items: 4,
    shippingStatus: "Awaiting Fulfillment",
  },
];

const PRODUCT_LISTINGS: ProductListing[] = [
  {
    id: "prod-001",
    sku: "SKU-2024-001",
    title: "Premium Wireless Headphones",
    price: 79.99,
    quantity: 234,
    status: "active",
    marketplace: "Amazon",
    views: 5432,
    conversions: 156,
    rating: 4.7,
    reviews: 287,
  },
  {
    id: "prod-002",
    sku: "SKU-2024-002",
    title: "USB-C Phone Charger",
    price: 19.99,
    quantity: 567,
    status: "active",
    marketplace: "eBay",
    views: 8934,
    conversions: 478,
    rating: 4.5,
    reviews: 612,
  },
  {
    id: "prod-003",
    sku: "SKU-2024-003",
    title: "Handmade Ceramic Mug",
    price: 24.99,
    quantity: 45,
    status: "active",
    marketplace: "Etsy",
    views: 1234,
    conversions: 89,
    rating: 4.9,
    reviews: 143,
  },
  {
    id: "prod-004",
    sku: "SKU-2024-004",
    title: "Laptop Stand",
    price: 49.99,
    quantity: 0,
    status: "inactive",
    marketplace: "Amazon",
    views: 2123,
    conversions: 34,
    rating: 4.3,
    reviews: 56,
  },
];

const RETURNS_REFUNDS: ReturnsRefund[] = [
  {
    id: "ret-001",
    orderId: "AMZ-2026-000234",
    marketplace: "Amazon",
    reason: "Defective item",
    status: "refunded",
    amount: 129.99,
    initiatedDate: "2026-03-10T00:00:00Z",
    resolvedDate: "2026-03-12T10:00:00Z",
  },
  {
    id: "ret-002",
    orderId: "EBY-2026-004567",
    marketplace: "eBay",
    reason: "Wrong item sent",
    status: "shipped-back",
    amount: 45.50,
    initiatedDate: "2026-03-11T00:00:00Z",
  },
  {
    id: "ret-003",
    orderId: "ETY-2026-008901",
    marketplace: "Etsy",
    reason: "Damaged in shipping",
    status: "approved",
    amount: 65.25,
    initiatedDate: "2026-03-12T00:00:00Z",
  },
  {
    id: "ret-004",
    orderId: "SQR-2026-002345",
    marketplace: "Square",
    reason: "Customer changed mind",
    status: "initiated",
    amount: 199.00,
    initiatedDate: "2026-03-12T14:30:00Z",
  },
];

const MARKETPLACE_ANALYTICS: MarketplaceAnalytic[] = [
  {
    marketplace: "Amazon",
    salesMonth: 687432,
    fees: 82500,
    profitMargin: 38,
    orderCount: 3245,
    avgOrderValue: 211.87,
    conversionRate: 3.2,
  },
  {
    marketplace: "eBay",
    salesMonth: 342156,
    fees: 35840,
    profitMargin: 35,
    orderCount: 1823,
    avgOrderValue: 187.65,
    conversionRate: 2.8,
  },
  {
    marketplace: "Etsy",
    salesMonth: 124567,
    fees: 12457,
    profitMargin: 42,
    orderCount: 567,
    avgOrderValue: 219.54,
    conversionRate: 4.1,
  },
  {
    marketplace: "Square Online",
    salesMonth: 89234,
    fees: 6847,
    profitMargin: 40,
    orderCount: 412,
    avgOrderValue: 216.57,
    conversionRate: 3.5,
  },
];

const REVIEWS: ReviewFeedback[] = [
  {
    id: "rev-001",
    marketplace: "Amazon",
    orderId: "AMZ-2026-001234",
    rating: 5,
    review: "Excellent product! Exceeded expectations.",
    reviewer: "John S.",
    date: "2026-03-12T14:32:00Z",
    status: "resolved",
    response: "Thank you for your 5-star review!",
  },
  {
    id: "rev-002",
    marketplace: "eBay",
    orderId: "EBY-2026-005678",
    rating: 3,
    review: "Good but packaging could be better",
    reviewer: "Jane D.",
    date: "2026-03-12T13:15:00Z",
    status: "responding",
    response: "We appreciate your feedback and will improve our packaging.",
  },
  {
    id: "rev-003",
    marketplace: "Etsy",
    orderId: "ETY-2026-009012",
    rating: 5,
    review: "Amazing quality, will buy again!",
    reviewer: "Bob J.",
    date: "2026-03-11T10:45:00Z",
    status: "resolved",
    response: "Thank you! We look forward to your next order.",
  },
  {
    id: "rev-004",
    marketplace: "Amazon",
    orderId: "AMZ-2026-000999",
    rating: 2,
    review: "Product stopped working after 2 weeks",
    reviewer: "Alex M.",
    date: "2026-03-12T12:00:00Z",
    status: "new",
  },
];

const FULFILLMENT_CONFIGS: FulfillmentConfig[] = [
  {
    marketplace: "Amazon",
    fulfillmentType: "hybrid",
    fbaPercentage: 60,
    fbmPercentage: 40,
    avgFulfillmentTime: 1.2,
    lastUpdated: "2026-03-12T00:00:00Z",
  },
  {
    marketplace: "eBay",
    fulfillmentType: "FBM",
    avgFulfillmentTime: 2.5,
    lastUpdated: "2026-03-12T00:00:00Z",
  },
  {
    marketplace: "Etsy",
    fulfillmentType: "FBM",
    avgFulfillmentTime: 3.0,
    lastUpdated: "2026-03-12T00:00:00Z",
  },
  {
    marketplace: "Square Online",
    fulfillmentType: "FBM",
    avgFulfillmentTime: 1.8,
    lastUpdated: "2026-03-12T00:00:00Z",
  },
];

interface TabState {
  tab: "providers" | "inventory" | "orders" | "listings" | "returns" | "analytics" | "reviews" | "fulfillment";
}

const getStatusColor = (status: string): "success" | "danger" | "warning" | "default" => {
  switch (status) {
    case "connected":
    case "active":
    case "shipped":
    case "delivered":
    case "synced":
    case "healthy":
    case "resolved":
    case "refunded":
      return "success";
    case "error":
    case "delisted":
    case "denied":
    case "down":
    case "new":
    case "cancelled":
      return "danger";
    case "disconnected":
    case "pending":
    case "processing":
    case "inactive":
    case "syncing":
    case "degraded":
    case "approved":
    case "shipped-back":
    case "responding":
    case "initiated":
      return "warning";
    default:
      return "default";
  }
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return "—";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

export default function EcommerceExtendedIntegrationPage() {
  const [tabState, setTabState] = useState<TabState>({ tab: "providers" });
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "processing" | "shipped" | "delivered">("all");
  const [listingFilter, setListingFilter] = useState<"all" | "active" | "inactive" | "error">("all");
  const [returnsFilter, setReturnsFilter] = useState<"all" | "initiated" | "approved" | "refunded">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "new" | "responding" | "resolved">("all");
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  // Calculate statistics
  const connectedProviders = PROVIDERS.filter((p) => p.status === "connected").length;
  const totalListings = PROVIDERS.reduce((sum, p) => sum + p.activeListings, 0);
  const totalOrdersMonth = PROVIDERS.reduce((sum, p) => sum + p.ordersMonth, 0);
  const totalRevenueMonth = PROVIDERS.reduce((sum, p) => sum + p.revenueMonth, 0);
  const totalSKUs = INVENTORY_SYNC.reduce((sum, s) => sum + s.totalSKUs, 0);
  const pendingReviews = REVIEWS.filter((r) => r.status === "new").length;
  const openReturns = RETURNS_REFUNDS.filter((r) => r.status === "initiated").length;

  const filteredOrders = useMemo(
    () =>
      ORDERS.filter((order) => {
        if (orderFilter !== "all" && order.status !== orderFilter) return false;
        return true;
      }),
    [orderFilter]
  );

  const filteredListings = useMemo(
    () =>
      PRODUCT_LISTINGS.filter((listing) => {
        if (listingFilter !== "all" && listing.status !== listingFilter) return false;
        return true;
      }),
    [listingFilter]
  );

  const filteredReturns = useMemo(
    () =>
      RETURNS_REFUNDS.filter((ret) => {
        if (returnsFilter !== "all" && ret.status !== returnsFilter) return false;
        return true;
      }),
    [returnsFilter]
  );

  const filteredReviews = useMemo(
    () =>
      REVIEWS.filter((review) => {
        if (reviewFilter !== "all" && review.status !== reviewFilter) return false;
        return true;
      }),
    [reviewFilter]
  );

  return (
    <>
      <Header
        title="E-Commerce Extended"
        subtitle={`${connectedProviders} marketplaces · ${formatNumber(totalOrdersMonth)} orders this month`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Marketplace
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 mb-8 sticky top-0 z-10">
        <div className="px-6 flex items-center gap-8 overflow-x-auto">
          {[
            { id: "providers", label: "Providers" },
            { id: "inventory", label: "Inventory Sync" },
            { id: "orders", label: "Orders" },
            { id: "listings", label: "Listings" },
            { id: "returns", label: "Returns/Refunds" },
            { id: "analytics", label: "Analytics" },
            { id: "reviews", label: "Reviews" },
            { id: "fulfillment", label: "Fulfillment" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabState({ tab: t.id as TabState["tab"] })}
              className={cn(
                "px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tabState.tab === t.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* PROVIDERS TAB */}
        {tabState.tab === "providers" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Connected Marketplaces" value={connectedProviders.toString()} trend="up" />
              <StatCard label="Active Listings" value={formatNumber(totalListings)} trend="up" />
              <StatCard label="Orders (Month)" value={formatNumber(totalOrdersMonth)} trend="up" />
              <StatCard label="Revenue (Month)" value={formatCurrency(totalRevenueMonth)} trend="up" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {PROVIDERS.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{provider.logo}</div>
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <Badge variant={getStatusColor(provider.status)}>● {provider.status}</Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm">
                        <RotateCw className="w-4 h-4" />
                        Sync
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Active Listings</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.activeListings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Orders</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.ordersMonth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(provider.revenueMonth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">API Status</p>
                      <Badge variant={getStatusColor(provider.apiStatus)}>{provider.apiStatus}</Badge>
                    </div>
                  </CardContent>
                  {provider.errorMessage && (
                    <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{provider.errorMessage}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* INVENTORY SYNC TAB */}
        {tabState.tab === "inventory" && (
          <div className="space-y-6">
            <StatCard label="Total SKUs" value={formatNumber(totalSKUs)} trend="up" />

            <Card>
              <CardHeader>
                <CardTitle>Multi-Marketplace Inventory Sync</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Quantity, pricing, and listing synchronization</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {INVENTORY_SYNC.map((sync) => (
                    <div key={sync.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium">{sync.provider}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Last synced: {formatDateTime(sync.lastSync)}</p>
                        </div>
                        <Badge variant={getStatusColor(sync.status)}>{sync.status}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Total SKUs</p>
                          <p className="text-lg font-bold">{formatNumber(sync.totalSKUs)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Successfully Synced</p>
                          <p className="text-lg font-bold">{formatNumber(sync.syncedSuccessfully)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Sync Errors</p>
                          <p className={cn("text-lg font-bold", sync.syncErrors > 0 && "text-red-600")}>
                            {sync.syncErrors}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Quantity Variance</p>
                          <p className={cn("text-lg font-bold", sync.quantityVariance > 0 && "text-yellow-600")}>
                            {sync.quantityVariance}
                          </p>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${(sync.syncedSuccessfully / sync.totalSKUs) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Zap className="w-4 h-4" />
                    Sync All Now
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4" />
                    Bulk Import
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ORDERS TAB */}
        {tabState.tab === "orders" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Order Import Configuration</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Channel attribution & order routing</p>
                </div>
                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-medium">{order.orderId}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{order.customerName}</p>
                        </div>
                        <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Marketplace</p>
                          <p className="font-medium">{order.marketplace}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Channel</p>
                          <p className="font-medium">{order.channel}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Amount</p>
                          <p className="font-bold text-green-600">{formatCurrency(order.amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Items</p>
                          <p className="font-medium">{order.items}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Shipping</p>
                          <p className="text-xs font-mono">{order.shippingStatus}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LISTINGS TAB */}
        {tabState.tab === "listings" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Product Listing Management</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Create, update, bulk operations</p>
                </div>
                <select
                  value={listingFilter}
                  onChange={(e) => setListingFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Listings</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="error">Error</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">SKU</th>
                        <th className="text-left py-3 px-4 font-semibold">Title</th>
                        <th className="text-left py-3 px-4 font-semibold">Price</th>
                        <th className="text-left py-3 px-4 font-semibold">Qty</th>
                        <th className="text-left py-3 px-4 font-semibold">Marketplace</th>
                        <th className="text-left py-3 px-4 font-semibold">Views</th>
                        <th className="text-left py-3 px-4 font-semibold">Rating</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredListings.map((listing) => (
                        <tr key={listing.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-mono text-xs">{listing.sku}</td>
                          <td className="py-3 px-4">{listing.title}</td>
                          <td className="py-3 px-4 font-bold">{formatCurrency(listing.price)}</td>
                          <td className="py-3 px-4">{listing.quantity}</td>
                          <td className="py-3 px-4">{listing.marketplace}</td>
                          <td className="py-3 px-4">{formatNumber(listing.views)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                              {listing.rating}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusColor(listing.status)}>{listing.status}</Badge>
                          </td>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4" />
                    New Listing
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4" />
                    Bulk Import
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* RETURNS/REFUNDS TAB */}
        {tabState.tab === "returns" && (
          <div className="space-y-6">
            <StatCard label="Open Returns" value={openReturns.toString()} trend="down" />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Returns & Refund Workflow</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Configuration & tracking</p>
                </div>
                <select
                  value={returnsFilter}
                  onChange={(e) => setReturnsFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Returns</option>
                  <option value="initiated">Initiated</option>
                  <option value="approved">Approved</option>
                  <option value="refunded">Refunded</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredReturns.map((ret) => (
                    <div key={ret.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-medium">{ret.orderId}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{ret.marketplace}</p>
                        </div>
                        <Badge variant={getStatusColor(ret.status)}>{ret.status}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Reason</p>
                          <p className="font-medium">{ret.reason}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Amount</p>
                          <p className="font-bold text-red-600">{formatCurrency(ret.amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Initiated</p>
                          <p className="font-mono text-xs">{new Date(ret.initiatedDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button variant="secondary" size="sm">
                            <Eye className="w-4 h-4" />
                            Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tabState.tab === "analytics" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Analytics</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Sales, fees, and profit margins by channel</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {MARKETPLACE_ANALYTICS.map((analytic) => (
                    <div key={analytic.marketplace} className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-medium">{analytic.marketplace}</p>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(analytic.salesMonth)}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">This Month</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Fees</p>
                          <p className="font-bold">{formatCurrency(analytic.fees)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Profit Margin</p>
                          <p className="font-bold">{analytic.profitMargin}%</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Orders</p>
                          <p className="font-bold">{analytic.orderCount}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Avg Order Value</p>
                          <p className="font-bold">{formatCurrency(analytic.avgOrderValue)}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Conversion Rate</p>
                          <p className="font-bold">{analytic.conversionRate}%</p>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${analytic.profitMargin}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export Report
                  </Button>
                  <Button variant="secondary" size="sm">
                    <BarChart3 className="w-4 h-4" />
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* REVIEWS TAB */}
        {tabState.tab === "reviews" && (
          <div className="space-y-6">
            <StatCard label="Pending Reviews" value={pendingReviews.toString()} trend="up" />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Review & Feedback Monitoring</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Customer feedback management & response</p>
                </div>
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Reviews</option>
                  <option value="new">New</option>
                  <option value="responding">Responding</option>
                  <option value="resolved">Resolved</option>
                </select>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredReviews.map((review) => (
                  <Card key={review.id} className="border-l-4 border-l-yellow-500">
                    <CardHeader
                      className="pb-3 cursor-pointer"
                      onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                    >
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4"
                                fill={i < review.rating ? "currentColor" : "none"}
                                color={i < review.rating ? "gold" : "gray"}
                              />
                            ))}
                          </div>
                          <span>{review.reviewer}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusColor(review.status)}>{review.status}</Badge>
                          <ChevronRight className={cn("w-4 h-4 transition", expandedReview === review.id && "rotate-90")} />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    {expandedReview === review.id && (
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Review</p>
                          <p className="text-sm">{review.review}</p>
                        </div>
                        {review.response && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Your Response</p>
                            <p className="text-sm text-green-700 dark:text-green-300">{review.response}</p>
                          </div>
                        )}
                        {review.status === "new" && (
                          <Button variant="primary" size="sm" className="w-full">
                            Write Response
                          </Button>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* FULFILLMENT TAB */}
        {tabState.tab === "fulfillment" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>FBA/FBM Fulfillment Settings</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Amazon FBA, Fulfillment by Merchant configuration</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {FULFILLMENT_CONFIGS.map((config) => (
                    <div key={config.marketplace} className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{config.marketplace}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Avg fulfillment: {config.avgFulfillmentTime} days</p>
                        </div>
                        <Badge variant="success" className="text-xs">
                          {config.fulfillmentType}
                        </Badge>
                      </div>
                      {config.fulfillmentType === "hybrid" && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">FBA</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded">
                                <div className="h-full bg-blue-500" style={{ width: `${config.fbaPercentage}%` }} />
                              </div>
                              <span className="text-xs font-bold">{config.fbaPercentage}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">FBM</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded">
                                <div className="h-full bg-green-500" style={{ width: `${config.fbmPercentage}%` }} />
                              </div>
                              <span className="text-xs font-bold">{config.fbmPercentage}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        <Button variant="secondary" size="sm">
                          <Settings className="w-4 h-4" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
