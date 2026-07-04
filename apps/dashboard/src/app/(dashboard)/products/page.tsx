"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   items PAGE — Product cache & sync management
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
  const { items, loading, error, refetch, pagination } =
    useApiList<Product>("/api/v4/products");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "type" | "lastSyncAt">(
    "title",
  );
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(
    new Set(),
  );
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const pageSize = 10;

  // Calculate stats
  const syncedToday = items.filter((p) => {
    const syncDate = new Date(p.lastSyncAt);
    const today = new Date();
    return syncDate.toLocaleDateString() === today.toLocaleDateString();
  }).length;
  const missingWeight = items.filter(
    (p) => p.weight === null && p.requiresShipping,
  ).length;
  const missingType = items.filter((p) => !p.productType).length;

  // Filter and sort
  const filtered = useMemo(() => {
    let result = items.filter((p) => {
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

      if (selectedFilters.has("requiresShipping") && !p.requiresShipping)
        return false;
      if (selectedFilters.has("missingWeight") && p.weight !== null)
        return false;

      for (const filter of selectedFilters) {
        if (
          filter !== "requiresShipping" &&
          filter !== "missingWeight" &&
          filter !== p.vendor
        ) {
          continue;
        }
        if (filter === p.vendor) return true;
      }

      if (
        selectedFilters.has("requiresShipping") ||
        selectedFilters.has("missingWeight")
      ) {
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
          return (
            new Date(b.lastSyncAt).getTime() - new Date(a.lastSyncAt).getTime()
          );
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [search, sortBy, selectedFilters]);

  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
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

  const vendors = Array.from(new Set(items.map((p) => p.vendor)));

  return (
    <>
      <Header
        title="Products"
        subtitle={`${items.length} total · ${syncedToday} synced today`}
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

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Products"
            value={items.length}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Synced Today"
            value={syncedToday}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Missing Weight"
            value={missingWeight}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Missing Type"
            value={missingType}
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
              className={cn(
                "w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-white text-sm font-sans outline-none",
              )}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            className={cn(
              "p-1 px-3 bg-wl-bg-elevated border border-wl-border-default rounded-md text-white text-sm font-sans cursor-pointer outline-none",
            )}
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
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-transparent text-wl-text-secondary border-wl-border-default",
            )}
          >
            Requires Shipping
          </button>

          <button
            onClick={() => toggleFilter("missingWeight")}
            className={cn(
              "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans",
              selectedFilters.has("missingWeight")
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-transparent text-wl-text-secondary border-wl-border-default",
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
                  ? "bg-cyan-500 text-white border-cyan-500"
                  : "bg-transparent text-wl-text-secondary border-wl-border-default",
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
              className={cn(
                "p-1 px-3 rounded-full border border-wl-border-default text-xs font-semibold cursor-pointer font-sans bg-transparent text-wl-text-tertiary",
              )}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Sync info banner */}
        {syncInfo && (
          <div
            className={cn(
              "mb-4 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-between",
            )}
          >
            <span className="text-blue-300 text-sm">{syncInfo}</span>
            <button
              onClick={() => setSyncInfo(null)}
              className="text-blue-400 hover:text-blue-200 text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <Card
            className={cn(
              "mb-5 p-4 border",
              deleteConfirm
                ? "bg-red-900/30 border-red-600"
                : "bg-blue-500 border-blue-600",
            )}
          >
            {deleteConfirm ? (
              <div className="flex gap-4 items-center justify-between">
                <div className="text-white text-sm font-semibold">
                  Delete {selectedProducts.size} product
                  {selectedProducts.size !== 1 ? "s" : ""}? This cannot be
                  undone.
                </div>
                <div className="flex gap-2 items-center">
                  {deleteError && (
                    <span className="text-red-300 text-xs">{deleteError}</span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={deleteLoading}
                    onClick={() => {
                      setDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deleteLoading}
                    onClick={async () => {
                      setDeleteLoading(true);
                      setDeleteError(null);
                      try {
                        await Promise.all(
                          Array.from(selectedProducts).map((id) =>
                            api.delete(`/api/v4/products/${id}`),
                          ),
                        );
                        setSelectedProducts(new Set());
                        setDeleteConfirm(false);
                        refetch();
                      } catch {
                        setDeleteError(
                          "Failed to delete some products. Please try again.",
                        );
                      } finally {
                        setDeleteLoading(false);
                      }
                    }}
                  >
                    {deleteLoading ? "Deleting…" : "Confirm Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 items-center justify-between">
                <div className="text-white text-sm font-semibold">
                  {selectedProducts.size} product
                  {selectedProducts.size !== 1 ? "s" : ""} selected
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSyncInfo(
                        "Product sync is triggered from Shopify. Visit your Shopify admin to force a product sync.",
                      );
                      setSelectedProducts(new Set());
                    }}
                  >
                    Re-sync
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Products Table */}
        <Card
          className={cn(
            "overflow-hidden p-0 bg-wl-bg-surface border border-wl-border-default",
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr
                  className={cn(
                    "border-b border-wl-border-default bg-wl-bg-elevated",
                  )}
                >
                  <th
                    className={cn(
                      "p-3 px-4 text-center font-semibold text-wl-text-secondary w-10",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selectedProducts.size === paginatedItems.length &&
                        paginatedItems.length > 0
                      }
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
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-wl-text-secondary",
                    )}
                  >
                    Title
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-wl-text-secondary",
                    )}
                  >
                    Type
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-wl-text-secondary",
                    )}
                  >
                    Vendor
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-center font-semibold text-wl-text-secondary",
                    )}
                  >
                    Weight
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-center font-semibold text-wl-text-secondary",
                    )}
                  >
                    Shipping
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-center font-semibold text-wl-text-secondary",
                    )}
                  >
                    Inventory
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-wl-text-secondary",
                    )}
                  >
                    Last Sync
                  </th>
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-wl-text-secondary",
                    )}
                  >
                    Shopify ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "border-b border-wl-border-default transition-colors duration-fast",
                      idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-elevated",
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
                    <td className={cn("p-3 px-4 text-white font-semibold")}>
                      {product.title}
                    </td>
                    <td className={cn("p-3 px-4 text-wl-neutral-300")}>
                      {product.productType}
                    </td>
                    <td className={cn("p-3 px-4 text-wl-neutral-300")}>
                      {product.vendor}
                    </td>
                    <td
                      className={cn("p-3 px-4 text-center text-wl-neutral-300")}
                    >
                      {product.weight ? (
                        `${product.weight} ${product.weightUnit}`
                      ) : (
                        <span className="text-red-400 font-semibold">
                          Missing
                        </span>
                      )}
                    </td>
                    <td className={cn("p-3 px-4 text-center")}>
                      <Badge
                        variant={
                          product.requiresShipping ? "primary" : "default"
                        }
                      >
                        {product.requiresShipping ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "p-3 px-4 text-center text-white font-semibold",
                      )}
                    >
                      {product.inventoryQty}
                    </td>
                    <td
                      className={cn("p-3 px-4 text-wl-text-tertiary text-xs")}
                    >
                      {formatDateTime(product.lastSyncAt)}
                    </td>
                    <td
                      className={cn("p-3 px-4 text-wl-text-tertiary text-xs")}
                    >
                      {product.shopifyId.split("/").pop()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className={cn(
              "flex items-center justify-between p-4 border-t border-wl-border-default bg-wl-bg-elevated text-sm text-wl-text-secondary",
            )}
          >
            <div>
              Showing{" "}
              {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}{" "}
              to {Math.min(currentPage * pageSize, filtered.length)} of{" "}
              {filtered.length}
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
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
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
