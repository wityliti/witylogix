"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import {
  Package,
  Truck,
  MapPin,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Filter,
  Download,
  Plus,
  MoreVertical,
  TrendingUp,
  Zap,
  Printer,
  Barcode,
  FedEx,
} from "lucide-react";

interface StandardOrder {
  id: string;
  orderNumber: string;
  recipient: string;
  city: string;
  state: string;
  zip: string;
  weight: number;
  dimensions: string;
  carrier: "USPS" | "UPS" | "FedEx" | "DHL" | null;
  trackingNumber: string | null;
  status: "pending" | "assigned" | "label_created" | "in_transit" | "delivered" | "exception";
  cost: number;
  estimatedDelivery: string;
  createdAt: string;
}

interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: "USPS" | "UPS" | "FedEx" | "DHL";
  status: "label_created" | "in_transit" | "delivered" | "exception";
  lastUpdate: string;
  estimatedDelivery: string;
  weight: number;
}

interface Carrier {
  id: string;
  name: "USPS" | "UPS" | "FedEx" | "DHL";
  icon: string;
  connected: boolean;
  accounts: number;
  successRate: number;
  avgCost: number;
  lastUsed: string;
}

const mockOrders: StandardOrder[] = [
  {
    id: "order-1001",
    orderNumber: "#WL-2026-001",
    recipient: "John Smith",
    city: "New York",
    state: "NY",
    zip: "10001",
    weight: 2.5,
    dimensions: "12x8x6",
    carrier: null,
    trackingNumber: null,
    status: "pending",
    cost: 0,
    estimatedDelivery: "Mar 10, 2026",
    createdAt: "2026-03-07",
  },
  {
    id: "order-1002",
    orderNumber: "#WL-2026-002",
    recipient: "Sarah Johnson",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    weight: 1.8,
    dimensions: "10x7x5",
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    status: "in_transit",
    cost: 28.50,
    estimatedDelivery: "Mar 11, 2026",
    createdAt: "2026-03-06",
  },
  {
    id: "order-1003",
    orderNumber: "#WL-2026-003",
    recipient: "Mike Davis",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    weight: 3.2,
    dimensions: "14x10x7",
    carrier: "FedEx",
    trackingNumber: "794618519049",
    status: "delivered",
    cost: 35.75,
    estimatedDelivery: "Mar 09, 2026",
    createdAt: "2026-03-05",
  },
  {
    id: "order-1004",
    orderNumber: "#WL-2026-004",
    recipient: "Emma Wilson",
    city: "Houston",
    state: "TX",
    zip: "77001",
    weight: 2.1,
    dimensions: "11x8x6",
    carrier: "USPS",
    trackingNumber: "9405511899223456789012",
    status: "label_created",
    cost: 18.99,
    estimatedDelivery: "Mar 12, 2026",
    createdAt: "2026-03-07",
  },
  {
    id: "order-1005",
    orderNumber: "#WL-2026-005",
    recipient: "Robert Brown",
    city: "Phoenix",
    state: "AZ",
    zip: "85001",
    weight: 4.5,
    dimensions: "16x12x8",
    carrier: "FedEx",
    trackingNumber: "794618519050",
    status: "exception",
    cost: 42.50,
    estimatedDelivery: "Mar 13, 2026",
    createdAt: "2026-03-07",
  },
];

const mockShipments: Shipment[] = [
  {
    id: "ship-1",
    orderId: "order-1002",
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    status: "in_transit",
    lastUpdate: "2026-03-08 14:32",
    estimatedDelivery: "Mar 11, 2026",
    weight: 1.8,
  },
  {
    id: "ship-2",
    orderId: "order-1003",
    trackingNumber: "794618519049",
    carrier: "FedEx",
    status: "delivered",
    lastUpdate: "2026-03-09 10:15",
    estimatedDelivery: "Mar 09, 2026",
    weight: 3.2,
  },
];

const mockCarriers: Carrier[] = [
  {
    id: "usps",
    name: "USPS",
    icon: "📮",
    connected: true,
    accounts: 1,
    successRate: 98.5,
    avgCost: 18.99,
    lastUsed: "2 hours ago",
  },
  {
    id: "ups",
    name: "UPS",
    icon: "📦",
    connected: true,
    accounts: 2,
    successRate: 99.2,
    avgCost: 28.50,
    lastUsed: "1 hour ago",
  },
  {
    id: "fedex",
    name: "FedEx",
    icon: "🚚",
    connected: true,
    accounts: 1,
    successRate: 97.8,
    avgCost: 35.75,
    lastUsed: "30 minutes ago",
  },
  {
    id: "dhl",
    name: "DHL",
    icon: "🌍",
    connected: false,
    accounts: 0,
    successRate: 0,
    avgCost: 0,
    lastUsed: "Never",
  },
];

const statusVariant = (s: string): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    delivered: "success",
    in_transit: "primary",
    label_created: "info",
    assigned: "info",
    exception: "danger",
    pending: "warning",
  };
  return map[s] ?? "default";
};

const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    pending: "Pending Assignment",
    assigned: "Carrier Assigned",
    label_created: "Label Created",
    in_transit: "In Transit",
    delivered: "Delivered",
    exception: "Exception",
  };
  return map[s] ?? s;
};

export default function StandardDeliveryPage() {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState<StandardOrder[]>(mockOrders);
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayOrders = orders.filter((o) => o.createdAt === today.toISOString().split("T")[0]);

    return {
      pending: orders.filter((o) => o.status === "pending").length,
      inTransit: orders.filter((o) => o.status === "in_transit").length,
      delivered: todayOrders.filter((o) => o.status === "delivered").length,
      exceptions: orders.filter((o) => o.status === "exception").length,
    };
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (carrierFilter !== "all" && order.carrier !== carrierFilter) return false;
      return true;
    });
  }, [orders, statusFilter, carrierFilter]);

  const handleAssignCarrier = (orderId: string, carrier: "USPS" | "UPS" | "FedEx" | "DHL") => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const trackingMap: Record<string, string> = {
            USPS: "9405511899223456789012",
            UPS: "1Z999AA10123456784",
            FedEx: "794618519049",
            DHL: "1234567890",
          };
          return {
            ...o,
            carrier,
            trackingNumber: trackingMap[carrier],
            status: "label_created",
            cost: carrier === "USPS" ? 18.99 : carrier === "UPS" ? 28.50 : carrier === "FedEx" ? 35.75 : 42.0,
          };
        }
        return o;
      })
    );
  };

  const handleBatchAction = (action: string) => {
    if (selectedOrders.size === 0) return;

    if (action === "bulk_assign") {
      setIsCarrierModalOpen(true);
    } else if (action === "bulk_print") {
      alert(`Printing labels for ${selectedOrders.size} orders...`);
    } else if (action === "bulk_update") {
      alert(`Updating status for ${selectedOrders.size} orders...`);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const tabs = [
    { id: "orders", label: "Orders", count: orders.length, icon: "📋" },
    { id: "shipments", label: "Shipments", count: shipments.length, icon: "📦" },
    { id: "carriers", label: "Carriers", count: mockCarriers.length, icon: "🚚" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, var(--wl-bg-primary) 0%, var(--wl-bg-secondary) 100%)" }}>
      <Header title="Standard Delivery" subtitle="Manage standard shipping orders, shipments, and carrier integrations" />

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem 1rem" }}>
        {/* Stats Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <Card>
            <CardContent style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--wl-text-secondary)" }}>
                    Pending
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--wl-text-primary)" }}>
                    {stats.pending}
                  </div>
                </div>
                <Clock className="w-8 h-8" style={{ color: "var(--wl-warning)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--wl-text-secondary)" }}>
                    In Transit
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--wl-text-primary)" }}>
                    {stats.inTransit}
                  </div>
                </div>
                <Truck className="w-8 h-8" style={{ color: "var(--wl-info)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--wl-text-secondary)" }}>
                    Delivered Today
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--wl-text-primary)" }}>
                    {stats.delivered}
                  </div>
                </div>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--wl-success)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--wl-text-secondary)" }}>
                    Exceptions
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--wl-text-primary)" }}>
                    {stats.exceptions}
                  </div>
                </div>
                <AlertCircle className="w-8 h-8" style={{ color: "var(--wl-danger)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: "2rem" }}>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
        </div>

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            {/* Filters & Actions */}
            <Card style={{ marginBottom: "2rem" }}>
              <CardContent style={{ paddingTop: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: selectedOrders.size > 0 ? "1rem" : 0 }}>
                  <Select
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "pending", label: "Pending" },
                      { value: "label_created", label: "Label Created" },
                      { value: "in_transit", label: "In Transit" },
                      { value: "delivered", label: "Delivered" },
                      { value: "exception", label: "Exception" },
                    ]}
                    defaultValue={statusFilter}
                    onChange={(val) => setStatusFilter(val)}
                  />
                  <Select
                    options={[
                      { value: "all", label: "All Carriers" },
                      { value: "USPS", label: "USPS" },
                      { value: "UPS", label: "UPS" },
                      { value: "FedEx", label: "FedEx" },
                      { value: "DHL", label: "DHL" },
                    ]}
                    defaultValue={carrierFilter}
                    onChange={(val) => setCarrierFilter(val)}
                  />
                  <Input placeholder="Search order #..." />
                </div>

                {/* Batch Actions */}
                {selectedOrders.size > 0 && (
                  <div style={{ display: "flex", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--wl-border)" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--wl-text-secondary)", display: "flex", alignItems: "center", paddingRight: "1rem" }}>
                      {selectedOrders.size} selected
                    </span>
                    <Button variant="primary" onClick={() => handleBatchAction("bulk_assign")}>
                      Assign Carrier
                    </Button>
                    <Button variant="secondary" onClick={() => handleBatchAction("bulk_print")}>
                      <Printer className="w-4 h-4" style={{ marginRight: "0.5rem" }} />
                      Print Labels
                    </Button>
                    <Button variant="secondary" onClick={() => handleBatchAction("bulk_update")}>
                      Update Status
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardContent style={{ paddingTop: "1.5rem", overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--wl-border)" }}>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
                            } else {
                              setSelectedOrders(new Set());
                            }
                          }}
                        />
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Order #
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Recipient
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Location
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Carrier
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Tracking
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Status
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Cost
                      </th>
                      <th style={{ padding: "1rem", textAlign: "center", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, idx) => (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: "1px solid var(--wl-border)",
                          background: selectedOrders.has(order.id) ? "var(--wl-bg-tertiary)" : idx % 2 === 0 ? "transparent" : "var(--wl-bg-tertiary)",
                        }}
                      >
                        <td style={{ padding: "1rem", color: "var(--wl-text-primary)" }}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-primary)", fontWeight: "600" }}>
                          {order.orderNumber}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-primary)" }}>
                          {order.recipient}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-secondary)", fontSize: "0.85rem" }}>
                          {order.city}, {order.state} {order.zip}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-primary)" }}>
                          {order.carrier ? (
                            <span style={{ fontWeight: "600" }}>{order.carrier}</span>
                          ) : (
                            <span style={{ color: "var(--wl-text-tertiary)", fontSize: "0.85rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-secondary)", fontSize: "0.85rem", fontFamily: "monospace" }}>
                          {order.trackingNumber ? order.trackingNumber.substring(0, 12) + "..." : "—"}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <Badge variant={statusVariant(order.status)}>
                            {statusLabel(order.status)}
                          </Badge>
                        </td>
                        <td style={{ padding: "1rem", color: "var(--wl-text-primary)", fontWeight: "600" }}>
                          {order.cost > 0 ? `$${order.cost.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                            {order.status === "pending" && (
                              <Button
                                variant="ghost"
                                onClick={() => setIsCarrierModalOpen(true)}
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                              >
                                Assign
                              </Button>
                            )}
                            {order.status === "label_created" && (
                              <Button
                                variant="ghost"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                              >
                                <Printer className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SHIPMENTS TAB */}
        {activeTab === "shipments" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" }}>
            {shipments.map((ship) => (
              <Card key={ship.id}>
                <CardHeader>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <CardTitle style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>
                        {ship.carrier} Shipment
                      </CardTitle>
                      <CardDescription>{ship.trackingNumber}</CardDescription>
                    </div>
                    <Badge variant={statusVariant(ship.status)}>
                      {ship.status === "label_created" ? "Label Created" : ship.status === "in_transit" ? "In Transit" : "Delivered"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--wl-border)" }}>
                      <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.85rem" }}>Weight</span>
                      <span style={{ color: "var(--wl-text-primary)", fontWeight: "600" }}>{ship.weight} lbs</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--wl-border)" }}>
                      <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.85rem" }}>Last Update</span>
                      <span style={{ color: "var(--wl-text-primary)", fontWeight: "600" }}>{ship.lastUpdate}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--wl-text-secondary)", fontSize: "0.85rem" }}>Est. Delivery</span>
                      <span style={{ color: "var(--wl-text-primary)", fontWeight: "600" }}>{ship.estimatedDelivery}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" style={{ width: "100%" }}>
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* CARRIERS TAB */}
        {activeTab === "carriers" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
            {mockCarriers.map((carrier) => (
              <Card key={carrier.id} style={{ position: "relative" }}>
                <CardHeader>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "2.5rem" }}>{carrier.icon}</div>
                    {carrier.connected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Badge variant="warning">Disconnected</Badge>
                    )}
                  </div>
                  <CardTitle style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>
                    {carrier.name}
                  </CardTitle>
                  <CardDescription>Shipping carrier integration</CardDescription>
                </CardHeader>

                <CardContent>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--wl-border)" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>Connected Accounts</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--wl-text-primary)" }}>
                        {carrier.accounts}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--wl-border)" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>Success Rate</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600", color: carrier.successRate > 0 ? "var(--wl-success)" : "var(--wl-text-tertiary)" }}>
                        {carrier.successRate > 0 ? `${carrier.successRate}%` : "N/A"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", borderBottom: "1px solid var(--wl-border)" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>Avg Cost / lb</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--wl-text-primary)" }}>
                        {carrier.avgCost > 0 ? `$${carrier.avgCost.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>Last Used</span>
                      <span style={{ fontSize: "0.9rem", color: "var(--wl-text-primary)" }}>
                        {carrier.lastUsed}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  {carrier.connected ? (
                    <Button variant="secondary" style={{ width: "100%" }}>
                      Manage Account
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => {
                      setSelectedCarrier(carrier);
                      setIsCarrierModalOpen(true);
                    }} style={{ width: "100%" }}>
                      <Plus className="w-4 h-4" style={{ marginRight: "0.5rem" }} />
                      Connect
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Carrier Modal */}
      <Modal
        isOpen={isCarrierModalOpen}
        onClose={() => {
          setIsCarrierModalOpen(false);
          setSelectedCarrier(null);
        }}
        title={selectedCarrier ? `Connect ${selectedCarrier.name}` : "Assign Carrier to Orders"}
        size="md"
        footer={
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCarrierModalOpen(false);
                setSelectedCarrier(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => {
              setIsCarrierModalOpen(false);
              setSelectedCarrier(null);
            }}>
              {selectedCarrier ? "Connect" : "Assign"}
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {selectedCarrier ? (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
                  API Key
                </label>
                <Input type="password" placeholder="Enter your API key" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
                  Account Number
                </label>
                <Input placeholder="Your account number" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
                  Select Carrier
                </label>
                <Select
                  options={mockCarriers.map((c) => ({ value: c.name, label: `${c.icon} ${c.name}` }))}
                  defaultValue="UPS"
                  onChange={() => {}}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
                  Shipping Service
                </label>
                <Select
                  options={[
                    { value: "ground", label: "Ground" },
                    { value: "express", label: "Express" },
                    { value: "overnight", label: "Overnight" },
                  ]}
                  defaultValue="ground"
                  onChange={() => {}}
                />
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--wl-text-tertiary)", marginTop: "0.5rem" }}>
                Selected orders: {selectedOrders.size}
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
