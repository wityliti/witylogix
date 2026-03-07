"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

/* ═══════════════════════════════════════════════════════════
   PRODUCTS PAGE — Product cache & sync management
   ═══════════════════════════════════════════════════════════ */

interface Product {
  id: string;
  shopifyId: string;
  title: string;
  productType: string;
  vendor: string;
  weight: number | null;
  weightUnit: string;
  requiresShipping: boolean;
  inventoryQty: number;
  lastSyncAt: string;
  createdAt: string;
}

const PRODUCTS: Product[] = [
  {
    id: "prod-001",
    shopifyId: "gid://shopify/Product/6789123456",
    title: "Cardboard Shipping Box - Medium",
    productType: "Packaging",
    vendor: "PackPro",
    weight: 0.5,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 245,
    lastSyncAt: "2026-03-06T09:15:00Z",
    createdAt: "2025-10-12T08:00:00Z",
  },
  {
    id: "prod-002",
    shopifyId: "gid://shopify/Product/7890234567",
    title: "Protective Air Bubble Wrap",
    productType: "Packaging",
    vendor: "BubbleMax",
    weight: 0.8,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 189,
    lastSyncAt: "2026-03-06T09:20:00Z",
    createdAt: "2025-11-05T10:30:00Z",
  },
  {
    id: "prod-003",
    shopifyId: "gid://shopify/Product/8901345678",
    title: "Thermal Shipping Labels - 4x6",
    productType: "Labels",
    vendor: "LabelTech",
    weight: null,
    weightUnit: "lbs",
    requiresShipping: false,
    inventoryQty: 512,
    lastSyncAt: "2026-03-06T09:10:00Z",
    createdAt: "2025-12-01T14:20:00Z",
  },
  {
    id: "prod-004",
    shopifyId: "gid://shopify/Product/9012456789",
    title: "Kraft Paper Mailers",
    productType: "Packaging",
    vendor: "PackPro",
    weight: 0.3,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 78,
    lastSyncAt: "2026-03-05T16:45:00Z",
    createdAt: "2025-09-18T11:00:00Z",
  },
  {
    id: "prod-005",
    shopifyId: "gid://shopify/Product/0123567890",
    title: "Foam Corner Protectors",
    productType: "Packaging",
    vendor: "ProtectIt",
    weight: null,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 320,
    lastSyncAt: "2026-03-04T13:30:00Z",
    createdAt: "2025-10-25T09:45:00Z",
  },
  {
    id: "prod-006",
    shopifyId: "gid://shopify/Product/1234678901",
    title: "Packing Tape - 2 inch",
    productType: "Supplies",
    vendor: "TapeMaster",
    weight: 0.6,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 156,
    lastSyncAt: "2026-03-06T08:50:00Z",
    createdAt: "2025-11-14T15:20:00Z",
  },
  {
    id: "prod-007",
    shopifyId: "gid://shopify/Product/2345789012",
    title: "Poly Mailer Bags - 10x13",
    productType: "Packaging",
    vendor: "PolyPack",
    weight: 0.2,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 467,
    lastSyncAt: "2026-03-06T09:25:00Z",
    createdAt: "2025-12-08T12:10:00Z",
  },
  {
    id: "prod-008",
    shopifyId: "gid://shopify/Product/3456890123",
    title: "Insulated Shipping Box - Large",
    productType: "Packaging",
    vendor: "CoolBox",
    weight: 1.2,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 42,
    lastSyncAt: "2026-03-03T10:00:00Z",
    createdAt: "2025-08-30T08:30:00Z",
  },
  {
    id: "prod-009",
    shopifyId: "gid://shopify/Product/4567901234",
    title: "Fragile Handling Labels",
    productType: "Labels",
    vendor: "LabelTech",
    weight: null,
    weightUnit: "lbs",
    requiresShipping: false,
    inventoryQty: 892,
    lastSyncAt: "2026-03-06T09:05:00Z",
    createdAt: "2025-11-20T16:15:00Z",
  },
  {
    id: "prod-010",
    shopifyId: "gid://shopify/Product/5678012345",
    title: "Tissue Paper - White Roll",
    productType: "Packaging",
    vendor: "PackPro",
    weight: 0.4,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 203,
    lastSyncAt: "2026-03-06T09:18:00Z",
    createdAt: "2025-10-05T13:45:00Z",
  },
  {
    id: "prod-011",
    shopifyId: "gid://shopify/Product/6789123457",
    title: "Shipping Labels - Blank Stock",
    productType: "Labels",
    vendor: "LabelTech",
    weight: null,
    weightUnit: "lbs",
    requiresShipping: false,
    inventoryQty: 1205,
    lastSyncAt: "2026-03-05T14:20:00Z",
    createdAt: "2025-09-10T10:00:00Z",
  },
  {
    id: "prod-012",
    shopifyId: "gid://shopify/Product/7890234568",
    title: "Corrugated Cardboard Sheet",
    productType: "Packaging",
    vendor: "CardSource",
    weight: null,
    weightUnit: "lbs",
    requiresShipping: true,
    inventoryQty: 85,
    lastSyncAt: "2026-03-02T11:30:00Z",
    createdAt: "2025-07-22T09:20:00Z",
  },
];

const formatDateTime = (isoStr: string): string => {
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

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "type" | "lastSyncAt">("title");
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // Calculate stats
  const syncedToday = PRODUCTS.filter((p) => {
    const syncDate = new Date(p.lastSyncAt);
    const today = new Date();
    return syncDate.toLocaleDateString() === today.toLocaleDateString();
  }).length;
  const missingWeight = PRODUCTS.filter((p) => p.weight === null && p.requiresShipping).length;
  const missingType = PRODUCTS.filter((p) => !p.productType).length;

  // Filter and sort
  const filtered = useMemo(() => {
    let result = PRODUCTS.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.vendor.toLowerCase().includes(q) &&
          !p.shopifyId.includes(q)
        ) {
          return false;
        }
      }

      if (selectedFilters.has("requiresShipping") && !p.requiresShipping) return false;
      if (selectedFilters.has("missingWeight") && p.weight !== null) return false;

      for (const filter of selectedFilters) {
        if (filter !== "requiresShipping" && filter !== "missingWeight" && filter !== p.vendor) {
          continue;
        }
        if (filter === p.vendor) return true;
      }

      if (selectedFilters.has("requiresShipping") || selectedFilters.has("missingWeight")) {
        return true;
      }

      if (selectedFilters.size === 0) return true;
      return false;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "type":
          return a.productType.localeCompare(b.productType);
        case "lastSyncAt":
          return new Date(b.lastSyncAt).getTime() - new Date(a.lastSyncAt).getTime();
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [search, sortBy, selectedFilters]);

  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(selectedFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    setSelectedFilters(newFilters);
    setCurrentPage(1);
  };

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const vendors = Array.from(new Set(PRODUCTS.map((p) => p.vendor)));

  return (
    <>
      <Header
        title="Products"
        subtitle={`${PRODUCTS.length} total · ${syncedToday} synced today`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              + Export CSV
            </Button>
            <Button variant="primary" size="md">
              + Sync Products
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Products"
            value={PRODUCTS.length}
            change={{ value: 8.5, label: "vs last month" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Synced Today"
            value={syncedToday}
            change={{ value: 22.0, label: "vs yesterday" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Missing Weight"
            value={missingWeight}
            change={{ value: -15.3, label: "vs last week" }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Missing Type"
            value={missingType}
            change={{ value: 0, label: "no change" }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* Search and Sort Bar */}
        <div className="flex gap-4 mb-5 items-center flex-wrap">
          <div className="flex-1 flex-grow-0 w-[300px] max-w-96">
            <input
              type="text"
              placeholder="Search products, vendor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            className="p-1 px-3 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans cursor-pointer outline-none"
          >
            <option value="title">Sort by Title</option>
            <option value="type">Sort by Type</option>
            <option value="lastSyncAt">Sort by Last Sync</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 mb-5 flex-wrap items-center">
          <span className="text-xs font-semibold text-wl-text-secondary">
            Filters:
          </span>

          <button
            onClick={() => toggleFilter("requiresShipping")}
            className={cn(
              "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans",
              selectedFilters.has("requiresShipping")
                ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
            )}
          >
            Requires Shipping
          </button>

          <button
            onClick={() => toggleFilter("missingWeight")}
            className={cn(
              "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans",
              selectedFilters.has("missingWeight")
                ? "bg-wl-warning-500 text-wl-text-inverse border-wl-warning-500"
                : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
            )}
          >
            Missing Weight
          </button>

          {vendors.map((vendor) => (
            <button
              key={vendor}
              onClick={() => toggleFilter(vendor)}
              className={cn(
                "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans",
                selectedFilters.has(vendor)
                  ? "bg-wl-info-500 text-wl-text-inverse border-wl-info-500"
                  : "bg-transparent text-wl-text-secondary border-wl-border-subtle"
              )}
            >
              {vendor}
            </button>
          ))}

          {selectedFilters.size > 0 && (
            <button
              onClick={() => {
                setSelectedFilters(new Set());
                setCurrentPage(1);
              }}
              className="p-1 px-3 rounded-full border border-wl-border-subtle text-xs font-semibold cursor-pointer font-sans bg-transparent text-wl-text-tertiary"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <Card className="mb-5 p-4 bg-wl-primary-500 border border-wl-primary-600">
            <div className="flex gap-4 items-center justify-between">
              <div className="text-wl-text-inverse text-sm font-semibold">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? "s" : ""} selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    alert(`Re-syncing ${selectedProducts.size} products...`);
                    setSelectedProducts(new Set());
                  }}
                >
                  Re-sync
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete ${selectedProducts.size} product(s)?`)) {
                      setSelectedProducts(new Set());
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Products Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary w-10">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === paginatedItems.length && paginatedItems.length > 0}
                      onChange={() => {
                        if (selectedProducts.size === paginatedItems.length) {
                          setSelectedProducts(new Set());
                        } else {
                          const newSelected = new Set(selectedProducts);
                          paginatedItems.forEach((p) => newSelected.add(p.id));
                          setSelectedProducts(newSelected);
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Title</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Type</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Vendor</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Weight</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Shipping</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Inventory</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Last Sync</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Shopify ID</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "border-b border-wl-border-subtle transition-colors duration-fast",
                      idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay"
                    )}
                  >
                    <td className="p-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-3 px-4 text-wl-text-primary font-semibold">
                      {product.title}
                    </td>
                    <td className="p-3 px-4 text-wl-text-secondary">
                      {product.productType}
                    </td>
                    <td className="p-3 px-4 text-wl-text-secondary">
                      {product.vendor}
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary">
                      {product.weight ? `${product.weight} ${product.weightUnit}` : (
                        <span className="text-wl-danger-400 font-semibold">Missing</span>
                      )}
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={product.requiresShipping ? "primary" : "default"}>
                        {product.requiresShipping ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-semibold">
                      {product.inventoryQty}
                    </td>
                    <td className="p-3 px-4 text-wl-text-tertiary text-xs">
                      {formatDateTime(product.lastSyncAt)}
                    </td>
                    <td className="p-3 px-4 text-wl-text-tertiary text-xs">
                      {product.shopifyId.split("/").pop()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span>Page {currentPage} of {totalPages}</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
