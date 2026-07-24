"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApiList, useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WLMap } from "@/components/map/wl-map";
import { WarehouseLayer } from "@/components/map/warehouse-layer";
import type { WarehousePin } from "@/components/map/warehouse-layer";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  List,
  MapPin,
} from "lucide-react";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  locationId: string;
  quantity: number;
  reorderPoint: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
  recentMovements?: Array<{
    itemId: string;
    type: "RECEIVE" | "SHIP" | "ADJUST" | "TRANSFER";
    quantity: number;
    reference: string | null;
    createdAt: string;
  }>;
}

function getStatusVariant(
  status: string,
): "success" | "warning" | "danger" | "default" {
  if (status === "in-stock") return "success";
  if (status === "low-stock") return "warning";
  if (status === "out-of-stock") return "danger";
  return "default";
}

export default function InventoryPage() {
  const { items, loading, error, refetch } =
    useApiList<InventoryItem>("/api/v4/inventory");
  const {
    data: warehouseData,
    loading: warehouseLoading,
    error: warehouseError,
  } = useApiQuery<{ data: WarehousePin[] }>("/api/v4/inventory/warehouses");

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [view, setView] = useState<"list" | "map">("list");

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const warehouses = [
    ...new Set(items.map((p) => p.locationId).filter(Boolean)),
  ];

  const filteredItems = items.filter((p) => {
    const warehouseMatch =
      selectedWarehouse === "all" || p.locationId === selectedWarehouse;
    const statusMatch = selectedStatus === "all" || p.status === selectedStatus;
    return warehouseMatch && statusMatch;
  });

  const lowStockAlerts = items.filter(
    (p) => p.status === "low-stock" || p.status === "out-of-stock",
  );
  const outOfStockCount = items.filter(
    (p) => p.status === "out-of-stock",
  ).length;
  const lowStockCount = items.filter((p) => p.status === "low-stock").length;
  const totalQuantity = items.reduce((sum, p) => sum + p.quantity, 0);

  const movements = items
    .flatMap((item) =>
      (item.recentMovements ?? []).map((m) => ({
        id: `${item.id}-${m.createdAt}`,
        sku: item.sku,
        type: m.type === "SHIP" ? ("out" as const) : ("in" as const),
        quantity: m.quantity,
        reason: m.reference ?? m.type,
        date: new Date(m.createdAt).toLocaleDateString(),
      })),
    )
    .slice(0, 20);

  const warehousePins: WarehousePin[] = warehouseData?.data ?? [];

  return (
    <div className={cn("min-h-screen bg-wl-bg-root p-6")}>
      <div className={cn("max-w-6xl mx-auto")}>
        {/* Header */}
        <div className={cn("mb-8 flex items-center justify-between")}>
          <div>
            <h1 className={cn("text-3xl font-bold text-white mb-2")}>
              Inventory Management
            </h1>
            <p className={cn("text-gray-400 text-sm")}>
              Track and manage product inventory across warehouses
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            className={cn("flex items-center gap-1.5")}
          >
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {/* Stats Cards */}
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6",
          )}
        >
          <Card
            className={cn("bg-wl-bg-surface border border-wl-border-default")}
          >
            <CardContent
              className={cn("p-5 flex items-center justify-between")}
            >
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>
                  Total Quantity
                </p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {totalQuantity.toLocaleString()}
                </p>
              </div>
              <Package size={32} className={cn("text-blue-500 opacity-70")} />
            </CardContent>
          </Card>

          <Card
            className={cn("bg-wl-bg-surface border border-wl-border-default")}
          >
            <CardContent
              className={cn("p-5 flex items-center justify-between")}
            >
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>
                  Low Stock
                </p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {lowStockCount}
                </p>
              </div>
              <AlertTriangle size={32} className="text-amber-500 opacity-70" />
            </CardContent>
          </Card>

          <Card
            className={cn("bg-wl-bg-surface border border-wl-border-default")}
          >
            <CardContent
              className={cn("p-5 flex items-center justify-between")}
            >
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>
                  Out of Stock
                </p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {outOfStockCount}
                </p>
              </div>
              <TrendingDown size={32} className="text-red-500 opacity-70" />
            </CardContent>
          </Card>

          <Card
            className={cn("bg-wl-bg-surface border border-wl-border-default")}
          >
            <CardContent
              className={cn("p-5 flex items-center justify-between")}
            >
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>
                  Total SKUs
                </p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {items.length}
                </p>
              </div>
              <CheckCircle size={32} className="text-emerald-500 opacity-70" />
            </CardContent>
          </Card>
        </div>

        {/* View Toggle */}
        <div className={cn("flex items-center gap-2 mb-4")}>
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
              view === "list"
                ? "bg-wl-primary-500 text-white"
                : "bg-wl-bg-elevated text-gray-400 hover:text-white border border-wl-border-default",
            )}
          >
            <List size={14} />
            List
          </button>
          <button
            onClick={() => setView("map")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
              view === "map"
                ? "bg-wl-primary-500 text-white"
                : "bg-wl-bg-elevated text-gray-400 hover:text-white border border-wl-border-default",
            )}
          >
            <MapPin size={14} />
            Map
          </button>
        </div>

        {view === "map" ? (
          /* ── MAP VIEW ─────────────────────────────────────────── */
          <Card
            className={cn(
              "bg-wl-bg-surface border border-wl-border-default mb-6",
            )}
          >
            <CardHeader>
              <CardTitle className={cn("text-white")}>Warehouse Map</CardTitle>
              <CardDescription className={cn("text-gray-400")}>
                Stock levels by warehouse location — bubble size scales with
                quantity
              </CardDescription>
            </CardHeader>
            <CardContent className={cn("p-0 overflow-hidden rounded-b-lg")}>
              {warehouseLoading ? (
                <div
                  className={cn(
                    "h-[480px] flex items-center justify-center bg-wl-bg-elevated",
                  )}
                >
                  <div className={cn("flex flex-col items-center gap-3")}>
                    <div
                      className={cn(
                        "w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin",
                      )}
                    />
                    <p className={cn("text-gray-400 text-sm")}>
                      Loading warehouse data…
                    </p>
                  </div>
                </div>
              ) : warehouseError ? (
                <div
                  className={cn(
                    "h-[480px] flex items-center justify-center bg-wl-bg-elevated",
                  )}
                >
                  <ErrorState
                    message={warehouseError.message}
                    onRetry={() => {}}
                  />
                </div>
              ) : warehousePins.length === 0 ? (
                <div
                  className={cn(
                    "h-[480px] flex flex-col items-center justify-center bg-wl-bg-elevated gap-3",
                  )}
                >
                  <MapPin size={40} className="text-gray-600" />
                  <p className={cn("text-gray-400 text-sm")}>
                    No warehouse coordinates configured
                  </p>
                  <p className={cn("text-gray-500 text-xs")}>
                    Add latitude / longitude to your locations to see them here
                  </p>
                </div>
              ) : (
                <div className={cn("h-[480px]")}>
                  <WLMap center={[0, 20]} zoom={2} className="w-full h-full">
                    <WarehouseLayer warehouses={warehousePins} />
                  </WLMap>
                </div>
              )}

              {/* Legend */}
              {!warehouseLoading &&
                !warehouseError &&
                warehousePins.length > 0 && (
                  <div
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 border-t border-wl-border-default text-xs text-gray-400 flex-wrap",
                    )}
                  >
                    <span className="font-medium text-gray-300">
                      Stock stress:
                    </span>
                    {[
                      { color: "#3b82f6", label: "Healthy (0%)" },
                      { color: "#22c55e", label: "Moderate (50%)" },
                      { color: "#f59e0b", label: "High (85%)" },
                      { color: "#ef4444", label: "Critical (100%)" },
                    ].map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        ) : (
          /* ── LIST VIEW ────────────────────────────────────────── */
          <div
            className={cn(
              "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-6",
            )}
          >
            {/* Inventory Table */}
            <Card
              className={cn("bg-wl-bg-surface border border-wl-border-default")}
            >
              <CardHeader>
                <div
                  className={cn(
                    "flex items-center justify-between flex-wrap gap-2",
                  )}
                >
                  <CardTitle className={cn("text-white")}>
                    Product Inventory
                  </CardTitle>
                  <div className={cn("flex gap-2")}>
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className={cn(
                        "px-2.5 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs cursor-pointer",
                      )}
                    >
                      <option value="all">All Locations</option>
                      {warehouses.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className={cn(
                        "px-2.5 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs cursor-pointer",
                      )}
                    >
                      <option value="all">All Status</option>
                      <option value="in-stock">In Stock</option>
                      <option value="low-stock">Low Stock</option>
                      <option value="out-of-stock">Out of Stock</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn("overflow-x-auto")}>
                  <table className={cn("w-full border-collapse")}>
                    <thead>
                      <tr className={cn("border-b-2 border-wl-border-default")}>
                        <th
                          className={cn(
                            "p-3 text-left text-gray-400 text-xs font-semibold",
                          )}
                        >
                          SKU
                        </th>
                        <th
                          className={cn(
                            "p-3 text-left text-gray-400 text-xs font-semibold",
                          )}
                        >
                          Product Name
                        </th>
                        <th
                          className={cn(
                            "p-3 text-left text-gray-400 text-xs font-semibold",
                          )}
                        >
                          Location
                        </th>
                        <th
                          className={cn(
                            "p-3 text-center text-gray-400 text-xs font-semibold",
                          )}
                        >
                          Quantity
                        </th>
                        <th
                          className={cn(
                            "p-3 text-center text-gray-400 text-xs font-semibold",
                          )}
                        >
                          Reorder Point
                        </th>
                        <th
                          className={cn(
                            "p-3 text-left text-gray-400 text-xs font-semibold",
                          )}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className={cn(
                              "p-6 text-center text-gray-400 text-sm",
                            )}
                          >
                            No inventory items found
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr
                            key={item.id}
                            className={cn(
                              "border-b border-wl-border-default hover:bg-wl-bg-elevated/50 transition-colors",
                            )}
                          >
                            <td
                              className={cn(
                                "p-3 text-white text-xs font-medium font-mono",
                              )}
                            >
                              {item.sku}
                            </td>
                            <td className={cn("p-3 text-white text-sm")}>
                              {item.name}
                            </td>
                            <td className={cn("p-3 text-gray-400 text-xs")}>
                              {item.locationId}
                            </td>
                            <td
                              className={cn(
                                "p-3 text-white text-sm text-center font-semibold",
                              )}
                            >
                              {item.quantity}
                            </td>
                            <td
                              className={cn(
                                "p-3 text-gray-400 text-xs text-center",
                              )}
                            >
                              {item.reorderPoint}
                            </td>
                            <td className={cn("p-3")}>
                              <Badge
                                variant={getStatusVariant(item.status)}
                                className="px-2 py-1 text-xs font-semibold"
                              >
                                {item.status.replace(/-/g, " ").toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Low Stock Alerts */}
            <Card
              className={cn(
                "bg-wl-bg-surface border border-wl-border-default h-fit",
              )}
            >
              <CardHeader>
                <CardTitle className={cn("text-white text-base")}>
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className={cn("flex flex-col gap-3")}>
                {lowStockAlerts.length === 0 ? (
                  <p className={cn("text-gray-400 text-xs text-center py-5")}>
                    All items well stocked
                  </p>
                ) : (
                  lowStockAlerts.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3 bg-wl-bg-elevated rounded border border-wl-border-default",
                      )}
                    >
                      <div className={cn("flex items-start gap-2 mb-1.5")}>
                        <AlertTriangle
                          size={14}
                          className="text-amber-500 mt-0.5 flex-shrink-0"
                        />
                        <div>
                          <p className={cn("text-white text-xs font-medium")}>
                            {item.name}
                          </p>
                          <p className={cn("text-gray-400 text-xs")}>
                            {item.quantity} / {item.reorderPoint}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className={cn("w-full")}
                      >
                        Reorder
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stock Movement History — list view only */}
        {view === "list" && (
          <Card
            className={cn("bg-wl-bg-surface border border-wl-border-default")}
          >
            <CardHeader>
              <CardTitle className={cn("text-white")}>
                Stock Movement History
              </CardTitle>
              <CardDescription className={cn("text-gray-400")}>
                Recent inventory transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn("overflow-x-auto")}>
                <table className={cn("w-full border-collapse")}>
                  <thead>
                    <tr className={cn("border-b-2 border-wl-border-default")}>
                      <th
                        className={cn(
                          "p-3 text-left text-gray-400 text-xs font-semibold",
                        )}
                      >
                        SKU
                      </th>
                      <th
                        className={cn(
                          "p-3 text-center text-gray-400 text-xs font-semibold",
                        )}
                      >
                        Type
                      </th>
                      <th
                        className={cn(
                          "p-3 text-center text-gray-400 text-xs font-semibold",
                        )}
                      >
                        Quantity
                      </th>
                      <th
                        className={cn(
                          "p-3 text-left text-gray-400 text-xs font-semibold",
                        )}
                      >
                        Reference
                      </th>
                      <th
                        className={cn(
                          "p-3 text-left text-gray-400 text-xs font-semibold",
                        )}
                      >
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className={cn(
                            "p-6 text-center text-gray-400 text-sm",
                          )}
                        >
                          No recent movements
                        </td>
                      </tr>
                    ) : (
                      movements.map((movement) => (
                        <tr
                          key={movement.id}
                          className={cn(
                            "border-b border-wl-border-default hover:bg-wl-bg-elevated/50 transition-colors",
                          )}
                        >
                          <td
                            className={cn(
                              "p-3 text-white text-xs font-medium font-mono",
                            )}
                          >
                            {movement.sku}
                          </td>
                          <td className={cn("p-3 text-center")}>
                            <div
                              className={cn(
                                "flex items-center justify-center gap-1",
                              )}
                            >
                              {movement.type === "in" ? (
                                <>
                                  <ArrowDownLeft
                                    size={14}
                                    className="text-emerald-500"
                                  />
                                  <span className="text-emerald-500 text-xs font-semibold">
                                    IN
                                  </span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight
                                    size={14}
                                    className="text-red-500"
                                  />
                                  <span className="text-red-500 text-xs font-semibold">
                                    OUT
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td
                            className={cn(
                              "p-3 text-white text-sm text-center font-semibold",
                            )}
                          >
                            {movement.quantity}
                          </td>
                          <td className={cn("p-3 text-gray-400 text-xs")}>
                            {movement.reason}
                          </td>
                          <td className={cn("p-3 text-gray-400 text-xs")}>
                            {movement.date}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
