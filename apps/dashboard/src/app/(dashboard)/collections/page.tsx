"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, GripVertical, Edit2, Trash2, Image as ImageIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   COLLECTIONS PAGE — Product collections from Shopify sync
   ═══════════════════════════════════════════════════════════ */

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

const COLLECTIONS: Collection[] = [
  {
    id: "coll-001",
    title: "Summer Sale",
    type: "manual",
    productCount: 24,
    status: "active",
    lastUpdated: "2026-03-05T14:30:00Z",
    description: "Seasonal summer products and clearance items",
    sortRules: [],
    products: [
      { id: "prod-001", title: "Beach Towel Set", sku: "BTS-001" },
      { id: "prod-002", title: "Sunscreen SPF 50", sku: "SUN-050" },
      { id: "prod-003", title: "Swim Trunks", sku: "SWIM-001" },
      { id: "prod-004", title: "Beach Umbrella", sku: "UMB-001" },
    ],
  },
  {
    id: "coll-002",
    title: "Best Sellers",
    type: "auto",
    productCount: 32,
    status: "active",
    lastUpdated: "2026-03-06T09:15:00Z",
    description: "Top-performing products based on sales volume",
    sortRules: ["sales > 100 units/month", "rating >= 4.5 stars"],
    products: [
      { id: "prod-005", title: "Wireless Earbuds", sku: "EARB-001" },
      { id: "prod-006", title: "Phone Case Pro", sku: "CASE-PRO" },
      { id: "prod-007", title: "Portable Charger", sku: "CHAR-PORT" },
      { id: "prod-008", title: "Screen Protector", sku: "SCRN-PROT" },
    ],
  },
  {
    id: "coll-003",
    title: "New Arrivals",
    type: "auto",
    productCount: 18,
    status: "active",
    lastUpdated: "2026-03-06T08:45:00Z",
    description: "Recently added products to the store",
    sortRules: ["created_at > 30 days ago"],
    products: [
      { id: "prod-009", title: "Smart Watch", sku: "WATCH-001" },
      { id: "prod-010", title: "Laptop Stand", sku: "STAND-001" },
      { id: "prod-011", title: "Mechanical Keyboard", sku: "KEYB-001" },
    ],
  },
  {
    id: "coll-004",
    title: "Premium Products",
    type: "auto",
    productCount: 16,
    status: "active",
    lastUpdated: "2026-03-04T16:20:00Z",
    description: "High-end and luxury items",
    sortRules: ["price > $500", "tag contains premium"],
    products: [
      { id: "prod-012", title: "Premium Headphones", sku: "HEAD-PREM" },
      { id: "prod-013", title: "Designer Backpack", sku: "BAG-DES" },
    ],
  },
  {
    id: "coll-005",
    title: "Clearance",
    type: "manual",
    productCount: 42,
    status: "active",
    lastUpdated: "2026-03-03T11:00:00Z",
    description: "Discounted and clearance items",
    sortRules: [],
    products: [
      { id: "prod-014", title: "Clearance Shirts", sku: "SHIRT-CLR" },
      { id: "prod-015", title: "Discounted Shoes", sku: "SHOE-DIS" },
    ],
  },
  {
    id: "coll-006",
    title: "Gift Ideas",
    type: "manual",
    productCount: 28,
    status: "active",
    lastUpdated: "2026-02-28T13:45:00Z",
    description: "Curated gift recommendations",
    sortRules: [],
    products: [
      { id: "prod-016", title: "Gift Set Bundle", sku: "GIFT-001" },
      { id: "prod-017", title: "Luxury Candle", sku: "CAND-LUX" },
    ],
  },
  {
    id: "coll-007",
    title: "Seasonal",
    type: "auto",
    productCount: 35,
    status: "active",
    lastUpdated: "2026-03-02T10:30:00Z",
    description: "Products for current season",
    sortRules: ["tag contains seasonal", "stock > 5"],
    products: [
      { id: "prod-018", title: "Spring Collection", sku: "SPRI-001" },
      { id: "prod-019", title: "Easter Specials", sku: "EAST-001" },
    ],
  },
  {
    id: "coll-008",
    title: "Featured",
    type: "manual",
    productCount: 12,
    status: "draft",
    lastUpdated: "2026-02-25T15:10:00Z",
    description: "Highlighted products for home page",
    sortRules: [],
    products: [
      { id: "prod-020", title: "Featured Item 1", sku: "FEAT-001" },
      { id: "prod-021", title: "Featured Item 2", sku: "FEAT-002" },
    ],
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

export default function CollectionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "auto" | "manual">("all");
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"title" | "productCount" | "lastUpdated">("title");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // Calculate stats
  const totalCollections = COLLECTIONS.length;
  const totalProducts = COLLECTIONS.reduce((sum, c) => sum + c.productCount, 0);
  const autoCollections = COLLECTIONS.filter((c) => c.type === "auto").length;
  const manualCollections = COLLECTIONS.filter((c) => c.type === "manual").length;

  // Filter and sort
  const filtered = useMemo(() => {
    let result = COLLECTIONS.filter((c) => {
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
  }, [search, typeFilter, sortBy]);

  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <>
      <Header
        title="Collections"
        subtitle={`${totalCollections} total · ${totalProducts} products · ${autoCollections} auto`}
        actions={
          <Button variant="primary" size="md">
            + New Collection
          </Button>
        }
      />

      <div className={cn("p-6")}>
        {/* Stats Grid */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6")}>
          <StatCard
            label="Total Collections"
            value={totalCollections}
            change={{ value: 2.5, label: "vs last month" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Total Products"
            value={totalProducts}
            change={{ value: 18.3, label: "vs last month" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Auto Collections"
            value={autoCollections}
            change={{ value: 0, label: "no change" }}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Manual Collections"
            value={manualCollections}
            change={{ value: 2.5, label: "vs last month" }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          {/* Search */}
          <div className={cn("flex-1 min-w-[300px] max-w-[400px]")}>
            <input
              type="text"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className={cn("w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans outline-none")}
            />
          </div>

          {/* Type Filter */}
          <div className={cn("flex gap-1")}>
            {(["all", "auto", "manual"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer font-sans transition-all capitalize",
                  typeFilter === type
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                )}
              >
                {type === "all" ? "All Types" : type}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            className={cn("p-1 px-3 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans cursor-pointer outline-none")}
          >
            <option value="title">Sort by Title</option>
            <option value="productCount">Sort by Product Count</option>
            <option value="lastUpdated">Sort by Last Updated</option>
          </select>
        </div>

        {/* Collections Table */}
        <Card className={cn("overflow-hidden p-0 mb-6")}>
          <div className={cn("overflow-x-auto")}>
            <table className={cn("w-full border-collapse text-sm")}>
              <thead>
                <tr className={cn("border-b border-wl-border-subtle bg-wl-bg-overlay")}>
                  <th className={cn("p-3 px-4 text-left font-semibold text-wl-text-secondary w-10")}> </th>
                  <th className={cn("p-3 px-4 text-left font-semibold text-wl-text-secondary")}>Title</th>
                  <th className={cn("p-3 px-4 text-center font-semibold text-wl-text-secondary")}>Type</th>
                  <th className={cn("p-3 px-4 text-center font-semibold text-wl-text-secondary")}>Products</th>
                  <th className={cn("p-3 px-4 text-center font-semibold text-wl-text-secondary")}>Status</th>
                  <th className={cn("p-3 px-4 text-left font-semibold text-wl-text-secondary")}>Last Updated</th>
                  <th className={cn("p-3 px-4 text-center font-semibold text-wl-text-secondary")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((collection, idx) => (
                  <tbody key={collection.id}>
                    <tr className={cn("border-b border-wl-border-subtle", idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-overlay")}>
                      <td className={cn("p-3 px-4 text-center cursor-pointer")} onClick={() => setExpandedCollection(expandedCollection === collection.id ? null : collection.id)}>
                        {expandedCollection === collection.id ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </td>
                      <td className={cn("p-3 px-4 text-wl-text-primary font-medium")}>{collection.title}</td>
                      <td className={cn("p-3 px-4 text-center")}>
                        <Badge variant={collection.type === "auto" ? "info" : "default"}>{collection.type}</Badge>
                      </td>
                      <td className={cn("p-3 px-4 text-center text-wl-text-primary font-semibold")}>{collection.productCount}</td>
                      <td className={cn("p-3 px-4 text-center")}>
                        <Badge variant={collection.status === "active" ? "success" : "warning"}>{collection.status}</Badge>
                      </td>
                      <td className={cn("p-3 px-4 text-wl-text-tertiary text-xs")}>{formatDateTime(collection.lastUpdated)}</td>
                      <td className={cn("p-3 px-4 text-center")}>
                        <div className={cn("flex gap-1 justify-center")}>
                          <Button variant="secondary" size="sm"><Edit2 size={14} /></Button>
                          <Button variant="danger" size="sm"><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedCollection === collection.id && (
                      <tr className={cn("border-b border-wl-border-subtle bg-wl-bg-overlay")}>
                        <td colSpan={7} className={cn("p-0")}>
                          <div className={cn("p-4")}>
                            <div className={cn("grid gap-6 grid-cols-[200px_1fr]")}>
                              {/* Collection Image & Meta */}
                              <div>
                                <div className={cn("bg-wl-bg-elevated border border-dashed border-wl-border-default rounded-lg h-45 flex items-center justify-center mb-3 text-wl-text-secondary")}>
                                  <ImageIcon size={32} opacity={0.5} />
                                </div>
                                <p className={cn("text-xs text-wl-text-secondary m-0")}>{collection.description}</p>
                              </div>

                              {/* Products List */}
                              <div>
                                <h4 className={cn("text-sm font-semibold text-wl-text-primary mb-3")}>Products in Collection</h4>
                                <div className={cn("flex flex-col gap-2 mb-4")}>
                                  {collection.products?.map((product, pIdx) => (
                                    <div key={product.id} className={cn("flex items-center gap-3 p-2 px-3 bg-wl-bg-elevated rounded-lg")}>
                                      <GripVertical size={14} className={cn("text-wl-text-tertiary cursor-grab")} />
                                      <div className={cn("flex-1")}>
                                        <p className={cn("text-sm text-wl-text-primary m-0 font-medium")}>{product.title}</p>
                                        <p className={cn("text-xs text-wl-text-secondary m-0 mt-1")}>SKU: {product.sku}</p>
                                      </div>
                                      <Button variant="danger" size="sm" onClick={() => alert(`Removing ${product.title} (mock)`)}>
                                        Remove
                                      </Button>
                                    </div>
                                  ))}
                                </div>

                                {/* Sort Rules for Auto Collections */}
                                {collection.type === "auto" && collection.sortRules && collection.sortRules.length > 0 && (
                                  <div>
                                    <h4 className={cn("text-sm font-semibold text-wl-text-primary mb-2")}>Sort Rules</h4>
                                    <ul className={cn("list-none p-0 m-0 flex flex-col gap-2")}>
                                      {collection.sortRules.map((rule, rIdx) => (
                                        <li key={rIdx} className={cn("text-sm text-wl-text-secondary p-2 px-3 bg-wl-bg-elevated rounded-lg")}>
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
                  </tbody>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={cn("flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary")}>
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className={cn("flex gap-2")}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className={cn("flex items-center gap-2")}>
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
