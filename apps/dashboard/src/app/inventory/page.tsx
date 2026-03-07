"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
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
    <div style={{ minHeight: "100vh", backgroundColor: "var(--wl-bg)", padding: "24px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "700", color: "var(--wl-text)", marginBottom: "8px" }}>
              Inventory Management
            </h1>
            <p style={{ color: "var(--wl-muted)", fontSize: "14px" }}>
              Track and manage product inventory across warehouses
            </p>
          </div>
          <Button
            style={{
              backgroundColor: "var(--wl-primary)",
              color: "white",
              border: "none",
              padding: "10px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--wl-muted)", fontSize: "12px", fontWeight: "500" }}>Total Items</p>
                <p style={{ color: "var(--wl-text)", fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                  {totalInventoryValue}
                </p>
              </div>
              <Package size={32} style={{ color: "var(--wl-primary)", opacity: 0.7 }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--wl-muted)", fontSize: "12px", fontWeight: "500" }}>Low Stock</p>
                <p style={{ color: "var(--wl-text)", fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                  {lowStockCount}
                </p>
              </div>
              <AlertTriangle size={32} style={{ color: "#eab308", opacity: 0.7 }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--wl-muted)", fontSize: "12px", fontWeight: "500" }}>Out of Stock</p>
                <p style={{ color: "var(--wl-text)", fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                  {outOfStockCount}
                </p>
              </div>
              <TrendingDown size={32} style={{ color: "#ef4444", opacity: 0.7 }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardContent style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "var(--wl-muted)", fontSize: "12px", fontWeight: "500" }}>Total SKUs</p>
                <p style={{ color: "var(--wl-text)", fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
                  {products.length}
                </p>
              </div>
              <CheckCircle size={32} style={{ color: "#22c55e", opacity: 0.7 }} />
            </CardContent>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", marginBottom: "24px" }}>
          {/* Inventory Table */}
          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
            <CardHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <CardTitle style={{ color: "var(--wl-text)" }}>Product Inventory</CardTitle>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "4px",
                      color: "var(--wl-text)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
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
                    style={{
                      padding: "6px 10px",
                      backgroundColor: "var(--wl-bg)",
                      border: "1px solid var(--wl-border)",
                      borderRadius: "4px",
                      color: "var(--wl-text)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
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
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--wl-border)" }}>
                      <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        SKU
                      </th>
                      <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Product Name
                      </th>
                      <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Warehouse
                      </th>
                      <th style={{ padding: "12px", textAlign: "center", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Quantity
                      </th>
                      <th style={{ padding: "12px", textAlign: "center", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Reorder Point
                      </th>
                      <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Status
                      </th>
                      <th style={{ padding: "12px", textAlign: "center", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} style={{ borderBottom: "1px solid var(--wl-border)" }}>
                        <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", fontFamily: "monospace" }}>
                          {product.sku}
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "13px" }}>
                          {product.name}
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px" }}>
                          {product.warehouse}
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "13px", textAlign: "center", fontWeight: "600" }}>
                          {product.quantity}
                        </td>
                        <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px", textAlign: "center" }}>
                          {product.reorderPoint}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <Badge style={{ ...getStatusBadge(product.status), padding: "4px 8px", fontSize: "11px", fontWeight: "600" }}>
                            {product.status.replace("-", " ").toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            <button
                              onClick={() => handleAdjustQuantity(product.id, product.quantity + 10)}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "transparent",
                                border: "1px solid var(--wl-primary)",
                                borderRadius: "4px",
                                color: "var(--wl-primary)",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleAdjustQuantity(product.id, Math.max(0, product.quantity - 10))}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "transparent",
                                border: "1px solid var(--wl-primary)",
                                borderRadius: "4px",
                                color: "var(--wl-primary)",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
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
          <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)", height: "fit-content" }}>
            <CardHeader>
              <CardTitle style={{ color: "var(--wl-text)", fontSize: "16px" }}>Low Stock Alerts</CardTitle>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {lowStockAlerts.length === 0 ? (
                <p style={{ color: "var(--wl-muted)", fontSize: "12px", textAlign: "center", padding: "20px 0" }}>
                  All items well stocked
                </p>
              ) : (
                lowStockAlerts.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--wl-bg)",
                      borderRadius: "6px",
                      border: "1px solid var(--wl-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                      <AlertTriangle size={14} style={{ color: "#eab308", marginTop: "2px", flexShrink: 0 }} />
                      <div>
                        <p style={{ color: "var(--wl-text)", fontSize: "12px", fontWeight: "500" }}>
                          {product.name}
                        </p>
                        <p style={{ color: "var(--wl-muted)", fontSize: "11px" }}>
                          {product.quantity} / {product.reorderPoint}
                        </p>
                      </div>
                    </div>
                    <Button
                      style={{
                        width: "100%",
                        padding: "4px",
                        backgroundColor: "var(--wl-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "500",
                        cursor: "pointer",
                      }}
                    >
                      Reorder
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock Movement History */}
        <Card style={{ backgroundColor: "var(--wl-card)", border: "1px solid var(--wl-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--wl-text)" }}>Stock Movement History</CardTitle>
            <CardDescription style={{ color: "var(--wl-muted)" }}>Recent inventory transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--wl-border)" }}>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      ID
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      SKU
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Type
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Quantity
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Reason
                    </th>
                    <th style={{ padding: "12px", textAlign: "left", color: "var(--wl-muted)", fontSize: "12px", fontWeight: "600" }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} style={{ borderBottom: "1px solid var(--wl-border)" }}>
                      <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", fontFamily: "monospace" }}>
                        {movement.id}
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "12px", fontWeight: "500", fontFamily: "monospace" }}>
                        {movement.sku}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          {movement.type === "in" ? (
                            <>
                              <ArrowDownLeft size={14} style={{ color: "#22c55e" }} />
                              <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "600" }}>IN</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={14} style={{ color: "#ef4444" }} />
                              <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: "600" }}>OUT</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-text)", fontSize: "13px", textAlign: "center", fontWeight: "600" }}>
                        {movement.quantity}
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px" }}>
                        {movement.reason}
                      </td>
                      <td style={{ padding: "12px", color: "var(--wl-muted)", fontSize: "12px" }}>
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
