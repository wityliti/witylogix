"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
  Filter,
  Plus,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  warehouse: string;
  quantity: number;
  reorderPoint: number;
  status: "in-stock" | "low" | "out-of-stock";
}

interface StockMovement {
  id: string;
  sku: string;
  type: "in" | "out";
  quantity: number;
  reason: string;
  date: string;
}

export default function InventoryPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([
    {
      id: "1",
      sku: "SKU-001",
      name: "Wireless Headphones",
      warehouse: "Main",
      quantity: 120,
      reorderPoint: 30,
      status: "in-stock",
    },
    {
      id: "2",
      sku: "SKU-002",
      name: "USB-C Cable",
      warehouse: "Main",
      quantity: 15,
      reorderPoint: 50,
      status: "low",
    },
    {
      id: "3",
      sku: "SKU-003",
      name: "Phone Case",
      warehouse: "Secondary",
      quantity: 0,
      reorderPoint: 20,
      status: "out-of-stock",
    },
    {
      id: "4",
      sku: "SKU-004",
      name: "Screen Protector",
      warehouse: "Main",
      quantity: 250,
      reorderPoint: 50,
      status: "in-stock",
    },
    {
      id: "5",
      sku: "SKU-005",
      name: "Power Bank",
      warehouse: "Secondary",
      quantity: 8,
      reorderPoint: 15,
      status: "low",
    },
    {
      id: "6",
      sku: "SKU-006",
      name: "Charging Stand",
      warehouse: "Main",
      quantity: 45,
      reorderPoint: 20,
      status: "in-stock",
    },
  ]);

  const [movements, setMovements] = useState<StockMovement[]>([
    {
      id: "MOV-001",
      sku: "SKU-001",
      type: "in",
      quantity: 50,
      reason: "Supplier delivery",
      date: "2026-03-05",
    },
    {
      id: "MOV-002",
      sku: "SKU-002",
      type: "out",
      quantity: 5,
      reason: "Customer order #12345",
      date: "2026-03-05",
    },
    {
      id: "MOV-003",
      sku: "SKU-004",
      type: "in",
      quantity: 100,
      reason: "Stock adjustment",
      date: "2026-03-04",
    },
    {
      id: "MOV-004",
      sku: "SKU-005",
      type: "out",
      quantity: 2,
      reason: "Customer order #12346",
      date: "2026-03-04",
    },
  ]);

  const lowStockAlerts = products.filter((p) => p.status === "low" || p.status === "out-of-stock");
  const warehouses = [...new Set(products.map((p) => p.warehouse)), "all"];

  const filteredProducts = products.filter((p) => {
    const warehouseMatch = selectedWarehouse === "all" || p.warehouse === selectedWarehouse;
    const statusMatch = selectedStatus === "all" || p.status === selectedStatus;
    return warehouseMatch && statusMatch;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      "in-stock": { backgroundColor: "#22c55e", color: "#fff" },
      low: { backgroundColor: "#eab308", color: "#000" },
      "out-of-stock": { backgroundColor: "#ef4444", color: "#fff" },
    };
    return styles[status as keyof typeof styles] || styles["in-stock"];
  };

  const handleAdjustQuantity = (productId: string, newQuantity: number) => {
    setProducts(
      products.map((p) => {
        if (p.id === productId) {
          let status: "in-stock" | "low" | "out-of-stock" = "in-stock";
          if (newQuantity === 0) status = "out-of-stock";
          else if (newQuantity <= p.reorderPoint) status = "low";
          return { ...p, quantity: newQuantity, status };
        }
        return p;
      })
    );
  };

  const handleTransfer = (productId: string, fromWarehouse: string, toWarehouse: string, qty: number) => {
    setProducts(
      products.map((p) => {
        if (p.id === productId && p.warehouse === fromWarehouse) {
          return { ...p, quantity: Math.max(0, p.quantity - qty) };
        }
        if (p.sku.includes(products.find((pr) => pr.id === productId)?.sku.split("-")[1] || "") && p.warehouse === toWarehouse) {
          return { ...p, quantity: p.quantity + qty };
        }
        return p;
      })
    );
  };

  const totalInventoryValue = products.reduce((sum, p) => sum + p.quantity, 0);
  const outOfStockCount = products.filter((p) => p.status === "out-of-stock").length;
  const lowStockCount = products.filter((p) => p.status === "low").length;

  return (
    <div className={cn("min-h-screen bg-wl-bg p-6")}>
      <div className={cn("max-w-6xl mx-auto")}>
        {/* Header */}
        <div className={cn("mb-8 flex items-center justify-between")}>
          <div>
            <h1 className={cn("text-3xl font-bold text-wl-text mb-2")}>
              Inventory Management
            </h1>
            <p className={cn("text-wl-muted text-sm")}>
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
          <Card className={cn("bg-wl-card border border-wl-border")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-wl-muted text-xs font-medium")}>Total Items</p>
                <p className={cn("text-wl-text text-2xl font-bold mt-1")}>
                  {totalInventoryValue}
                </p>
              </div>
              <Package size={32} className={cn("text-wl-primary opacity-70")} />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-card border border-wl-border")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-wl-muted text-xs font-medium")}>Low Stock</p>
                <p className={cn("text-wl-text text-2xl font-bold mt-1")}>
                  {lowStockCount}
                </p>
              </div>
              <AlertTriangle size={32} className="text-yellow-500 opacity-70" />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-card border border-wl-border")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-wl-muted text-xs font-medium")}>Out of Stock</p>
                <p className={cn("text-wl-text text-2xl font-bold mt-1")}>
                  {outOfStockCount}
                </p>
              </div>
              <TrendingDown size={32} className="text-red-500 opacity-70" />
            </CardContent>
          </Card>

          <Card className={cn("bg-wl-card border border-wl-border")}>
            <CardContent className={cn("p-5 flex items-center justify-between")}>
              <div>
                <p className={cn("text-wl-muted text-xs font-medium")}>Total SKUs</p>
                <p className={cn("text-wl-text text-2xl font-bold mt-1")}>
                  {products.length}
                </p>
              </div>
              <CheckCircle size={32} className="text-green-500 opacity-70" />
            </CardContent>
          </Card>
        </div>

        <div className={cn("grid gap-6 mb-6")} style={{ gridTemplateColumns: "1fr 320px" }}>
          {/* Inventory Table */}
          <Card className={cn("bg-wl-card border border-wl-border")}>
            <CardHeader>
              <div className={cn("flex items-center justify-between")}>
                <CardTitle className={cn("text-wl-text")}>Product Inventory</CardTitle>
                <div className={cn("flex gap-2")}>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className={cn("px-2.5 py-1.5 bg-wl-bg border border-wl-border rounded text-wl-text text-xs cursor-pointer")}
                  >
                    {warehouses.map((w) => (
                      <option key={w} value={w}>
                        {w === "all" ? "All Warehouses" : w}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={cn("px-2.5 py-1.5 bg-wl-bg border border-wl-border rounded text-wl-text text-xs cursor-pointer")}
                  >
                    <option value="all">All Status</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={cn("overflow-x-auto")}>
                <table className={cn("w-full border-collapse")}>
                  <thead>
                    <tr className={cn("border-b-2 border-wl-border")}>
                      <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                        SKU
                      </th>
                      <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                        Product Name
                      </th>
                      <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                        Warehouse
                      </th>
                      <th className={cn("p-3 text-center text-wl-muted text-xs font-semibold")}>
                        Quantity
                      </th>
                      <th className={cn("p-3 text-center text-wl-muted text-xs font-semibold")}>
                        Reorder Point
                      </th>
                      <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                        Status
                      </th>
                      <th className={cn("p-3 text-center text-wl-muted text-xs font-semibold")}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={cn("border-b border-wl-border")}>
                        <td className={cn("p-3 text-wl-text text-xs font-medium font-mono")}>
                          {product.sku}
                        </td>
                        <td className={cn("p-3 text-wl-text text-sm")}>
                          {product.name}
                        </td>
                        <td className={cn("p-3 text-wl-muted text-xs")}>
                          {product.warehouse}
                        </td>
                        <td className={cn("p-3 text-wl-text text-sm text-center font-semibold")}>
                          {product.quantity}
                        </td>
                        <td className={cn("p-3 text-wl-muted text-xs text-center")}>
                          {product.reorderPoint}
                        </td>
                        <td className={cn("p-3")}>
                          <Badge style={getStatusBadge(product.status)} className="px-2 py-1 text-xs font-semibold">
                            {product.status.replace("-", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td className={cn("p-3 text-center")}>
                          <div className={cn("flex gap-1.5 justify-center")}>
                            <button
                              onClick={() => handleAdjustQuantity(product.id, product.quantity + 10)}
                              className={cn("px-2 py-1 bg-transparent border border-wl-primary rounded text-wl-primary cursor-pointer text-xs font-medium")}
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleAdjustQuantity(product.id, Math.max(0, product.quantity - 10))}
                              className={cn("px-2 py-1 bg-transparent border border-wl-primary rounded text-wl-primary cursor-pointer text-xs font-medium")}
                            >
                              -
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card className={cn("bg-wl-card border border-wl-border h-fit")}>
            <CardHeader>
              <CardTitle className={cn("text-wl-text text-base")}>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent className={cn("flex flex-col gap-3")}>
              {lowStockAlerts.length === 0 ? (
                <p className={cn("text-wl-muted text-xs text-center py-5")}>
                  All items well stocked
                </p>
              ) : (
                lowStockAlerts.map((product) => (
                  <div
                    key={product.id}
                    className={cn("p-3 bg-wl-bg rounded border border-wl-border")}
                  >
                    <div className={cn("flex items-start gap-2 mb-1.5")}>
                      <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-wl-text text-xs font-medium")}>
                          {product.name}
                        </p>
                        <p className={cn("text-wl-muted text-xs")}>
                          {product.quantity} / {product.reorderPoint}
                        </p>
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
        <Card className={cn("bg-wl-card border border-wl-border")}>
          <CardHeader>
            <CardTitle className={cn("text-wl-text")}>Stock Movement History</CardTitle>
            <CardDescription className={cn("text-wl-muted")}>Recent inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full border-collapse")}>
                <thead>
                  <tr className={cn("border-b-2 border-wl-border")}>
                    <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                      ID
                    </th>
                    <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                      SKU
                    </th>
                    <th className={cn("p-3 text-center text-wl-muted text-xs font-semibold")}>
                      Type
                    </th>
                    <th className={cn("p-3 text-center text-wl-muted text-xs font-semibold")}>
                      Quantity
                    </th>
                    <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                      Reason
                    </th>
                    <th className={cn("p-3 text-left text-wl-muted text-xs font-semibold")}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className={cn("border-b border-wl-border")}>
                      <td className={cn("p-3 text-wl-text text-xs font-medium font-mono")}>
                        {movement.id}
                      </td>
                      <td className={cn("p-3 text-wl-text text-xs font-medium font-mono")}>
                        {movement.sku}
                      </td>
                      <td className={cn("p-3 text-center")}>
                        <div className={cn("flex items-center justify-center gap-1")}>
                          {movement.type === "in" ? (
                            <>
                              <ArrowDownLeft size={14} className="text-green-500" />
                              <span className="text-green-500 text-xs font-semibold">IN</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={14} className="text-red-500" />
                              <span className="text-red-500 text-xs font-semibold">OUT</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className={cn("p-3 text-wl-text text-sm text-center font-semibold")}>
                        {movement.quantity}
                      </td>
                      <td className={cn("p-3 text-wl-muted text-xs")}>
                        {movement.reason}
                      </td>
                      <td className={cn("p-3 text-wl-muted text-xs")}>
                        {movement.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
