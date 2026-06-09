"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
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

export default function InventoryPage() {
  const { items, loading, error, refetch } = useApiList<InventoryItem>('/api/v4/inventory');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const warehouses = [...new Set(items.map((p) => p.locationId).filter(Boolean))];

  const filteredItems = items.filter((p) => {
    const warehouseMatch = selectedWarehouse === "all" || p.locationId === selectedWarehouse;
    const statusMatch = selectedStatus === "all" || p.status === selectedStatus;
    return warehouseMatch && statusMatch;
  });

  const lowStockAlerts = items.filter((p) => p.status === "low-stock" || p.status === "out-of-stock");
  const outOfStockCount = items.filter((p) => p.status === "out-of-stock").length;
  const lowStockCount = items.filter((p) => p.status === "low-stock").length;
  const totalQuantity = items.reduce((sum, p) => sum + p.quantity, 0);

  const movements = items.flatMap((item) =>
    (item.recentMovements ?? []).map((m) => ({
      id: `${item.id}-${m.createdAt}`,
      sku: item.sku,
      type: m.type === "SHIP" ? ("out" as const) : ("in" as const),
      quantity: m.quantity,
      reason: m.reference ?? m.type,
      date: new Date(m.createdAt).toLocaleDateString(),
    }))
  ).slice(0, 20);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { backgroundColor: string; color: string }> = {
      "in-stock": { backgroundColor: "#22c55e", color: "#fff" },
      "low-stock": { backgroundColor: "#eab308", color: "#000" },
      "out-of-stock": { backgroundColor: "#ef4444", color: "#fff" },
    };
    return styles[status] ?? styles["in-stock"];
  };

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
          <Button variant="primary" size="md" className={cn("flex items-center gap-1.5")}>
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {/* Stats Cards */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 mb-6")}>
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>Total Quantity</p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {totalQuantity}
                </p>
              </div>
              <Package size={32} className={cn("text-blue-500 opacity-70")} />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>Low Stock</p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {lowStockCount}
                </p>
              </div>
              <AlertTriangle size={32} className="text-amber-500 opacity-70" />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>Out of Stock</p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {outOfStockCount}
                </p>
              </div>
              <TrendingDown size={32} className="text-red-500 opacity-70" />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-gray-400 text-xs font-medium")}>Total SKUs</p>
                <p className={cn("text-white text-2xl font-bold mt-1")}>
                  {items.length}
                </p>
              </div>
              <CheckCircle size={32} className="text-emerald-500 opacity-70" />
            </CardContent>
          </Card>
        </div>

        <div className={cn("grid gap-6 mb-6")} style={{ gridTemplateColumns: "1fr 320px" }}>
          {/* Inventory Table */}
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardHeader>
              <div className={cn("flex items-center justify-between")}>
                <CardTitle className={cn("text-white")}>Product Inventory</CardTitle>
                <div className={cn("flex gap-2")}>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className={cn("px-2.5 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs cursor-pointer")}
                  >
                    <option value="all">All Locations</option>
                    {warehouses.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={cn("px-2.5 py-1.5 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-xs cursor-pointer")}
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
                      <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>SKU</th>
                      <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>Product Name</th>
                      <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>Location</th>
                      <th className={cn("p-3 text-center text-gray-400 text-xs font-semibold")}>Quantity</th>
                      <th className={cn("p-3 text-center text-gray-400 text-xs font-semibold")}>Reorder Point</th>
                      <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={cn("p-6 text-center text-gray-400 text-sm")}>
                          No inventory items found
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className={cn("border-b border-wl-border-default")}>
                          <td className={cn("p-3 text-white text-xs font-medium font-mono")}>{item.sku}</td>
                          <td className={cn("p-3 text-white text-sm")}>{item.name}</td>
                          <td className={cn("p-3 text-gray-400 text-xs")}>{item.locationId}</td>
                          <td className={cn("p-3 text-white text-sm text-center font-semibold")}>{item.quantity}</td>
                          <td className={cn("p-3 text-gray-400 text-xs text-center")}>{item.reorderPoint}</td>
                          <td className={cn("p-3")}>
                            <Badge style={getStatusBadge(item.status)} className="px-2 py-1 text-xs font-semibold">
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
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default h-fit")}>
            <CardHeader>
              <CardTitle className={cn("text-white text-base")}>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent className={cn("flex flex-col gap-3")}>
              {lowStockAlerts.length === 0 ? (
                <p className={cn("text-gray-400 text-xs text-center py-5")}>
                  All items well stocked
                </p>
              ) : (
                lowStockAlerts.map((item) => (
                  <div key={item.id} className={cn("p-3 bg-wl-bg-elevated rounded border border-wl-border-default")}>
                    <div className={cn("flex items-start gap-2 mb-1.5")}>
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-white text-xs font-medium")}>{item.name}</p>
                        <p className={cn("text-gray-400 text-xs")}>{item.quantity} / {item.reorderPoint}</p>
                      </div>
                    </div>
                    <Button variant="primary" size="sm" className={cn("w-full")}>
                      Reorder
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock Movement History */}
        <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
          <CardHeader>
            <CardTitle className={cn("text-white")}>Stock Movement History</CardTitle>
            <CardDescription className={cn("text-gray-400")}>Recent inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full border-collapse")}>
                <thead>
                  <tr className={cn("border-b-2 border-wl-border-default")}>
                    <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>SKU</th>
                    <th className={cn("p-3 text-center text-gray-400 text-xs font-semibold")}>Type</th>
                    <th className={cn("p-3 text-center text-gray-400 text-xs font-semibold")}>Quantity</th>
                    <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>Reference</th>
                    <th className={cn("p-3 text-left text-gray-400 text-xs font-semibold")}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={cn("p-6 text-center text-gray-400 text-sm")}>
                        No recent movements
                      </td>
                    </tr>
                  ) : (
                    movements.map((movement) => (
                      <tr key={movement.id} className={cn("border-b border-wl-border-default")}>
                        <td className={cn("p-3 text-white text-xs font-medium font-mono")}>{movement.sku}</td>
                        <td className={cn("p-3 text-center")}>
                          <div className={cn("flex items-center justify-center gap-1")}>
                            {movement.type === "in" ? (
                              <>
                                <ArrowDownLeft size={14} className="text-emerald-500" />
                                <span className="text-emerald-500 text-xs font-semibold">IN</span>
                              </>
                            ) : (
                              <>
                                <ArrowUpRight size={14} className="text-red-500" />
                                <span className="text-red-500 text-xs font-semibold">OUT</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className={cn("p-3 text-white text-sm text-center font-semibold")}>{movement.quantity}</td>
                        <td className={cn("p-3 text-gray-400 text-xs")}>{movement.reason}</td>
                        <td className={cn("p-3 text-gray-400 text-xs")}>{movement.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
