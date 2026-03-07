"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

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
    return (
      syncDate.toLocaleDateString() === today.toLocaleDateString()
    );
  }).length;
  const missingWeight = PRODUCTS.filter((p) => p.weight === null && p.requiresShipping).length;
  const missingType = PRODUCTS.filter((p) => !p.productType).length;

  // Filter and sort
  const filtered = useMemo(() => {
    let result = PRODUCTS.filter((p) => {
      // Search filter
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

      // Active filters
      if (selectedFilters.has("requiresShipping") && !p.requiresShipping) return false;
      if (selectedFilters.has("missingWeight") && p.weight !== null) return false;

      // Vendor filter
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
          <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
            <Button variant="secondary" size="md">
              + Export CSV
            </Button>
            <Button variant="primary" size="md">
              + Sync Products
            </Button>
          </div>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Search products, vendor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-4)",
                background: "var(--wl-bg-elevated)",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                outline: "none",
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            style={{
              padding: "var(--wl-space-1) var(--wl-space-3)",
              background: "var(--wl-bg-elevated)",
              border: "1px solid var(--wl-border-default)",
              borderRadius: "var(--wl-radius-md)",
              color: "var(--wl-text-primary)",
              fontSize: "var(--wl-text-sm)",
              fontFamily: "var(--wl-font-sans)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="title">Sort by Title</option>
            <option value="type">Sort by Type</option>
            <option value="lastSyncAt">Sort by Last Sync</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-2)",
            marginBottom: "var(--wl-space-5)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
            Filters:
          </span>

          {/* Requires Shipping Filter */}
          <button
            onClick={() => toggleFilter("requiresShipping")}
            style={{
              padding: "var(--wl-space-1) var(--wl-space-3)",
              borderRadius: "var(--wl-radius-full)",
              border: "1px solid",
              fontSize: "var(--wl-text-xs)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--wl-font-sans)",
              background: selectedFilters.has("requiresShipping") ? "var(--wl-primary-500)" : "transparent",
              color: selectedFilters.has("requiresShipping") ? "var(--wl-text-inverse)" : "var(--wl-text-secondary)",
              borderColor: selectedFilters.has("requiresShipping") ? "var(--wl-primary-500)" : "var(--wl-border-subtle)",
            }}
          >
            Requires Shipping
          </button>

          {/* Missing Weight Filter */}
          <button
            onClick={() => toggleFilter("missingWeight")}
            style={{
              padding: "var(--wl-space-1) var(--wl-space-3)",
              borderRadius: "var(--wl-radius-full)",
              border: "1px solid",
              fontSize: "var(--wl-text-xs)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--wl-font-sans)",
              background: selectedFilters.has("missingWeight") ? "var(--wl-warning-500)" : "transparent",
              color: selectedFilters.has("missingWeight") ? "var(--wl-text-inverse)" : "var(--wl-text-secondary)",
              borderColor: selectedFilters.has("missingWeight") ? "var(--wl-warning-500)" : "var(--wl-border-subtle)",
            }}
          >
            Missing Weight
          </button>

          {/* Vendor Filters */}
          {vendors.map((vendor) => (
            <button
              key={vendor}
              onClick={() => toggleFilter(vendor)}
              style={{
                padding: "var(--wl-space-1) var(--wl-space-3)",
                borderRadius: "var(--wl-radius-full)",
                border: "1px solid",
                fontSize: "var(--wl-text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--wl-font-sans)",
                background: selectedFilters.has(vendor) ? "var(--wl-info-500)" : "transparent",
                color: selectedFilters.has(vendor) ? "var(--wl-text-inverse)" : "var(--wl-text-secondary)",
                borderColor: selectedFilters.has(vendor) ? "var(--wl-info-500)" : "var(--wl-border-subtle)",
              }}
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
              style={{
                padding: "var(--wl-space-1) var(--wl-space-3)",
                borderRadius: "var(--wl-radius-full)",
                border: "1px solid var(--wl-border-subtle)",
                fontSize: "var(--wl-text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--wl-font-sans)",
                background: "transparent",
                color: "var(--wl-text-tertiary)",
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <Card
            style={{
              marginBottom: "var(--wl-space-5)",
              padding: "var(--wl-space-4)",
              background: "var(--wl-primary-500)",
              border: "1px solid var(--wl-primary-600)",
            }}
          >
            <div style={{ display: "flex", gap: "var(--wl-space-4)", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ color: "var(--wl-text-inverse)", fontSize: "var(--wl-text-sm)", fontWeight: 600 }}>
                {selectedProducts.size} product{selectedProducts.size !== 1 ? "s" : ""} selected
              </div>
              <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
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
        <Card style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--wl-text-sm)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--wl-border-subtle)",
                    background: "var(--wl-bg-overlay)",
                  }}
                >
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)", width: 40 }}>
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
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Title
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Type
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Vendor
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Weight
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Shipping
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Inventory
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Last Sync
                  </th>
                  <th style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "left", fontWeight: 600, color: "var(--wl-text-secondary)" }}>
                    Shopify ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((product, idx) => (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: "1px solid var(--wl-border-subtle)",
                      background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                      transition: "background var(--wl-duration-fast)",
                    }}
                  >
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                      {product.title}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-secondary)" }}>
                      {product.productType}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-secondary)" }}>
                      {product.vendor}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-secondary)" }}>
                      {product.weight ? `${product.weight} ${product.weightUnit}` : (
                        <span style={{ color: "var(--wl-danger-400)", fontWeight: 600 }}>Missing</span>
                      )}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center" }}>
                      <Badge variant={product.requiresShipping ? "primary" : "default"}>
                        {product.requiresShipping ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", textAlign: "center", color: "var(--wl-text-primary)", fontWeight: 600 }}>
                      {product.inventoryQty}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-tertiary)", fontSize: "var(--wl-text-xs)" }}>
                      {formatDateTime(product.lastSyncAt)}
                    </td>
                    <td style={{ padding: "var(--wl-space-3) var(--wl-space-4)", color: "var(--wl-text-tertiary)", fontSize: "var(--wl-text-xs)" }}>
                      {product.shopifyId.split("/").pop()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--wl-space-4)",
              borderTop: "1px solid var(--wl-border-subtle)",
              background: "var(--wl-bg-overlay)",
              fontSize: "var(--wl-text-sm)",
              color: "var(--wl-text-secondary)",
            }}
          >
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div style={{ display: "flex", gap: "var(--wl-space-2)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
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
