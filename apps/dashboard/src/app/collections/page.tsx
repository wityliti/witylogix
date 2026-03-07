"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
              placeholder="Search collections..."
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

          {/* Type Filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "auto", "manual"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-full)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  transition: `all var(--wl-duration-fast)`,
                  background: typeFilter === type ? "var(--wl-primary-500)" : "transparent",
                  color: typeFilter === type ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: typeFilter === type ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  textTransform: "capitalize",
                }}
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
            <option value="productCount">Sort by Product Count</option>
            <option value="lastUpdated">Sort by Last Updated</option>
          </select>
        </div>

        {/* Collections Table */}
        <Card style={{ overflow: "hidden", padding: 0, marginBottom: "var(--wl-space-6)" }}>
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
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                      width: 40,
                    }}
                  >
                    {" "}
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Products
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Last Updated
                  </th>
                  <th
                    style={{
                      padding: "var(--wl-space-3) var(--wl-space-4)",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--wl-text-secondary)",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((collection, idx) => (
                  <tbody key={collection.id}>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--wl-border-subtle)",
                        background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-overlay)",
                        transition: "background var(--wl-duration-fast)",
                      }}
                    >
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          textAlign: "center",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setExpandedCollection(
                            expandedCollection === collection.id
                              ? null
                              : collection.id
                          )
                        }
                      >
                        {expandedCollection === collection.id ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {collection.title}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          textAlign: "center",
                        }}
                      >
                        <Badge
                          variant={collection.type === "auto" ? "info" : "default"}
                        >
                          {collection.type}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          textAlign: "center",
                          color: "var(--wl-text-primary)",
                          fontWeight: 600,
                        }}
                      >
                        {collection.productCount}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          textAlign: "center",
                        }}
                      >
                        <Badge
                          variant={
                            collection.status === "active"
                              ? "success"
                              : "warning"
                          }
                        >
                          {collection.status}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          color: "var(--wl-text-tertiary)",
                          fontSize: "var(--wl-text-xs)",
                        }}
                      >
                        {formatDateTime(collection.lastUpdated)}
                      </td>
                      <td
                        style={{
                          padding: "var(--wl-space-3) var(--wl-space-4)",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <Button variant="secondary" size="sm">
                            <Edit2 size={14} />
                          </Button>
                          <Button variant="danger" size="sm">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {expandedCollection === collection.id && (
                      <tr
                        style={{
                          borderBottom: "1px solid var(--wl-border-subtle)",
                          background: "var(--wl-bg-overlay)",
                        }}
                      >
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: "var(--wl-space-4)" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "200px 1fr",
                                gap: "var(--wl-space-6)",
                              }}
                            >
                              {/* Collection Image & Meta */}
                              <div>
                                <div
                                  style={{
                                    background: "var(--wl-bg-elevated)",
                                    border: "1px dashed var(--wl-border-default)",
                                    borderRadius: "var(--wl-radius-md)",
                                    height: 180,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: "var(--wl-space-3)",
                                    color: "var(--wl-text-secondary)",
                                  }}
                                >
                                  <ImageIcon size={32} opacity={0.5} />
                                </div>
                                <p
                                  style={{
                                    fontSize: "var(--wl-text-xs)",
                                    color: "var(--wl-text-secondary)",
                                    margin: 0,
                                  }}
                                >
                                  {collection.description}
                                </p>
                              </div>

                              {/* Products List */}
                              <div>
                                <h4
                                  style={{
                                    fontSize: "var(--wl-text-sm)",
                                    fontWeight: 600,
                                    color: "var(--wl-text-primary)",
                                    marginBottom: "var(--wl-space-3)",
                                  }}
                                >
                                  Products in Collection
                                </h4>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "var(--wl-space-2)",
                                    marginBottom: "var(--wl-space-4)",
                                  }}
                                >
                                  {collection.products?.map((product, pIdx) => (
                                    <div
                                      key={product.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "var(--wl-space-3)",
                                        padding: "var(--wl-space-2) var(--wl-space-3)",
                                        background: "var(--wl-bg-elevated)",
                                        borderRadius: "var(--wl-radius-md)",
                                      }}
                                    >
                                      <GripVertical
                                        size={14}
                                        style={{
                                          color: "var(--wl-text-tertiary)",
                                          cursor: "grab",
                                        }}
                                      />
                                      <div style={{ flex: 1 }}>
                                        <p
                                          style={{
                                            fontSize: "var(--wl-text-sm)",
                                            color: "var(--wl-text-primary)",
                                            margin: 0,
                                            fontWeight: 500,
                                          }}
                                        >
                                          {product.title}
                                        </p>
                                        <p
                                          style={{
                                            fontSize: "var(--wl-text-xs)",
                                            color: "var(--wl-text-secondary)",
                                            margin: "var(--wl-space-1) 0 0 0",
                                          }}
                                        >
                                          SKU: {product.sku}
                                        </p>
                                      </div>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() =>
                                          alert(`Removing ${product.title} (mock)`)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  ))}
                                </div>

                                {/* Sort Rules for Auto Collections */}
                                {collection.type === "auto" &&
                                  collection.sortRules &&
                                  collection.sortRules.length > 0 && (
                                    <div>
                                      <h4
                                        style={{
                                          fontSize: "var(--wl-text-sm)",
                                          fontWeight: 600,
                                          color: "var(--wl-text-primary)",
                                          marginBottom: "var(--wl-space-2)",
                                        }}
                                      >
                                        Sort Rules
                                      </h4>
                                      <ul
                                        style={{
                                          listStyle: "none",
                                          padding: 0,
                                          margin: 0,
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "var(--wl-space-2)",
                                        }}
                                      >
                                        {collection.sortRules.map((rule, rIdx) => (
                                          <li
                                            key={rIdx}
                                            style={{
                                              fontSize: "var(--wl-text-sm)",
                                              color: "var(--wl-text-secondary)",
                                              padding: "var(--wl-space-2) var(--wl-space-3)",
                                              background: "var(--wl-bg-elevated)",
                                              borderRadius: "var(--wl-radius-md)",
                                            }}
                                          >
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
              Showing{" "}
              {paginatedItems.length > 0
                ? (currentPage - 1) * pageSize + 1
                : 0}{" "}
              to {Math.min(currentPage * pageSize, filtered.length)} of{" "}
              {filtered.length}
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
                <span>
                  Page {currentPage} of {totalPages}
                </span>
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
