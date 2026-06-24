"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, GripVertical, Edit2, Trash2, Image as ImageIcon, Search } from "lucide-react";
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface Collection {
  id: string;
  title: string;
  type: "auto" | "manual";
  productCount: number;
  status: "active" | "draft";
  lastUpdated: string;
  description: string;
  imageUrl?: string;
  sortRules?: string[];
  products?: { id: string; title: string; sku: string }[];
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

export default function CollectionsPage() {
  const { items, loading, error, refetch } = useApiList<Collection>('/api/v4/collections');
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "auto" | "manual">("all");
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"title" | "productCount" | "lastUpdated">("title");
  const [currentPage, setCurrentPage] = useState(1);

  const handleRemoveProduct = async (collectionId: string, productId: string) => {
    setRemovingProductId(productId);
    try {
      await api.delete(`/api/v4/collections/${collectionId}/products`, {
        body: JSON.stringify({ productIds: [productId] }),
      } as RequestInit);
      await refetch();
    } finally {
      setRemovingProductId(null);
    }
  };

  const pageSize = 10;

  const totalCollections = items.length;
  const totalProducts = items.reduce((sum, c) => sum + c.productCount, 0);
  const autoCollections = items.filter((c) => c.type === "auto").length;
  const manualCollections = items.filter((c) => c.type === "manual").length;

  const filtered = useMemo(() => {
    const result = items.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "productCount":
          return b.productCount - a.productCount;
        case "lastUpdated":
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return result;
  }, [items, search, typeFilter, sortBy]);

  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="w-full bg-wl-bg-root min-h-screen">
      <Header
        title="Collections"
        subtitle={`${totalCollections} total · ${totalProducts} products · ${autoCollections} auto`}
        actions={
          <Button variant="primary" size="md">
            + New Collection
          </Button>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard label="Total Collections" value={totalCollections} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard label="Total Products" value={totalProducts} accentColor="var(--wl-success-400)" index={1} />
          <StatCard label="Auto Collections" value={autoCollections} accentColor="var(--wl-info-400)" index={2} />
          <StatCard label="Manual Collections" value={manualCollections} accentColor="var(--wl-warning-400)" index={3} />
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-5 items-center flex-wrap">
          <div className="flex-1 min-w-[300px] max-w-[400px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors duration-200"
            />
          </div>

          <div className="flex gap-1">
            {(["all", "auto", "manual"] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setTypeFilter(type); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all capitalize",
                  typeFilter === type
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-transparent text-gray-400 border-wl-border-default"
                )}
              >
                {type === "all" ? "All Types" : type}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setCurrentPage(1); }}
            className="px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors duration-200"
          >
            <option value="title">Sort by Title</option>
            <option value="productCount">Sort by Product Count</option>
            <option value="lastUpdated">Sort by Last Updated</option>
          </select>
        </div>

        {/* Table */}
        <Card className="bg-wl-bg-surface border-wl-border-default overflow-hidden p-0 mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-default bg-wl-bg-root">
                  <th className="p-3 px-4 text-left font-semibold text-gray-400 w-10"> </th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Title</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Type</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Products</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Status</th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-400">Last Updated</th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      No collections found
                    </td>
                  </tr>
                )}
                {paginatedItems.map((collection, idx) => (
                  <>
                    <tr
                      key={collection.id}
                      className={cn(
                        "border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-elevated/40"
                      )}
                    >
                      <td
                        className="p-3 px-4 text-center cursor-pointer text-gray-400"
                        onClick={() => setExpandedCollection(expandedCollection === collection.id ? null : collection.id)}
                      >
                        {expandedCollection === collection.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </td>
                      <td className="p-3 px-4 text-white font-medium">{collection.title}</td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={collection.type === "auto" ? "info" : "default"}>{collection.type}</Badge>
                      </td>
                      <td className="p-3 px-4 text-center text-white font-semibold">{collection.productCount}</td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={collection.status === "active" ? "success" : "warning"}>{collection.status}</Badge>
                      </td>
                      <td className="p-3 px-4 text-gray-400 text-xs">{formatDateTime(collection.lastUpdated)}</td>
                      <td className="p-3 px-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="secondary" size="sm"><Edit2 size={14} /></Button>
                          <Button variant="danger" size="sm"><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>

                    {expandedCollection === collection.id && (
                      <tr key={`${collection.id}-expanded`} className="border-b border-wl-border-default bg-wl-bg-elevated/40">
                        <td colSpan={7} className="p-0">
                          <div className="p-4">
                            <div className="grid gap-6 grid-cols-[200px_1fr]">
                              <div>
                                <div className="bg-wl-bg-elevated border border-dashed border-wl-border-default rounded-lg h-45 flex items-center justify-center mb-3 text-gray-500">
                                  <ImageIcon size={32} opacity={0.5} />
                                </div>
                                <p className="text-xs text-gray-400 m-0">{collection.description}</p>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-white mb-3">Products in Collection</h4>
                                <div className="flex flex-col gap-2 mb-4">
                                  {collection.products?.map((product) => (
                                    <div key={product.id} className="flex items-center gap-3 p-2 px-3 bg-wl-bg-elevated rounded-lg hover:bg-wl-bg-elevated/80 transition-colors">
                                      <GripVertical size={14} className="text-gray-500 cursor-grab" />
                                      <div className="flex-1">
                                        <p className="text-sm text-white m-0 font-medium">{product.title}</p>
                                        <p className="text-xs text-gray-400 m-0 mt-1">SKU: {product.sku}</p>
                                      </div>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={removingProductId === product.id}
                                        onClick={() => handleRemoveProduct(collection.id, product.id)}
                                      >
                                        {removingProductId === product.id ? 'Removing…' : 'Remove'}
                                      </Button>
                                    </div>
                                  ))}
                                  {(!collection.products || collection.products.length === 0) && (
                                    <p className="text-sm text-gray-500 italic">No products in this collection</p>
                                  )}
                                </div>

                                {collection.type === "auto" && collection.sortRules && collection.sortRules.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-white mb-2">Sort Rules</h4>
                                    <ul className="list-none p-0 m-0 flex flex-col gap-2">
                                      {collection.sortRules.map((rule, rIdx) => (
                                        <li key={rIdx} className="text-sm text-gray-400 p-2 px-3 bg-wl-bg-elevated rounded-lg">
                                          {rule}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-wl-border-default bg-wl-bg-elevated/40 text-sm text-gray-400">
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                Previous
              </Button>
              <span className="flex items-center gap-2">Page {currentPage} of {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
