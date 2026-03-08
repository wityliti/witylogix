"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
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
    <div className={cn("min-h-screen")} style={{ background: "linear-gradient(135deg, var(--wl-bg-primary) 0%, var(--wl-bg-secondary) 100%)" }}>
      <Header title="Standard Delivery" subtitle="Manage standard shipping orders, shipments, and carrier integrations" />

      <div className={cn("max-w-[1400px] mx-auto p-8")}>
        {/* Stats Bar */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8")}>
          <Card>
            <CardContent className={cn("pt-4 pb-4")}>
              <div className={cn("flex items-center gap-4 justify-between")}>
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-secondary")}>
                    Pending
                  </div>
                  <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                    {stats.pending}
                  </div>
                </div>
                <Clock className="w-8 h-8" style={{ color: "var(--wl-warning)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className={cn("pt-4 pb-4")}>
              <div className={cn("flex items-center gap-4 justify-between")}>
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-secondary")}>
                    In Transit
                  </div>
                  <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                    {stats.inTransit}
                  </div>
                </div>
                <Truck className="w-8 h-8" style={{ color: "var(--wl-info)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className={cn("pt-4 pb-4")}>
              <div className={cn("flex items-center gap-4 justify-between")}>
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-secondary")}>
                    Delivered Today
                  </div>
                  <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                    {stats.delivered}
                  </div>
                </div>
                <CheckCircle className="w-8 h-8" style={{ color: "var(--wl-success)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className={cn("pt-4 pb-4")}>
              <div className={cn("flex items-center gap-4 justify-between")}>
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-secondary")}>
                    Exceptions
                  </div>
                  <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                    {stats.exceptions}
                  </div>
                </div>
                <AlertCircle className="w-8 h-8" style={{ color: "var(--wl-danger)", opacity: 0.7 }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className={cn("mb-8")}>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
        </div>

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div>
            {/* Filters & Actions */}
            <Card className={cn("mb-8")}>
              <CardContent className={cn("pt-6")}>
                <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4")} style={{ marginBottom: selectedOrders.size > 0 ? "1rem" : 0 }}>
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
                  <div className={cn("flex gap-2 pt-4 border-t border-wl-border")}>
                    <span className={cn("text-sm text-wl-text-secondary flex items-center pr-4")}>
                      {selectedOrders.size} selected
                    </span>
                    <Button variant="primary" onClick={() => handleBatchAction("bulk_assign")}>
                      Assign Carrier
                    </Button>
                    <Button variant="secondary" onClick={() => handleBatchAction("bulk_print")}>
                      <Printer className="w-4 h-4 mr-2" />
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
              <CardContent className={cn("pt-6 overflow-x-auto")}>
                <table className={cn("w-full border-collapse text-sm")}>
                  <thead>
                    <tr className={cn("border-b-2 border-wl-border")}>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
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
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Order #
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Recipient
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Location
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Carrier
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Tracking
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Status
                      </th>
                      <th className={cn("p-4 text-left text-wl-text-secondary font-semibold")}>
                        Cost
                      </th>
                      <th className={cn("p-4 text-center text-wl-text-secondary font-semibold")}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, idx) => (
                      <tr
                        key={order.id}
                        className={cn("border-b border-wl-border")}
                        style={{
                          background: selectedOrders.has(order.id) ? "var(--wl-bg-tertiary)" : idx % 2 === 0 ? "transparent" : "var(--wl-bg-tertiary)",
                        }}
                      >
                        <td className={cn("p-4 text-wl-text-primary")}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </td>
                        <td className={cn("p-4 text-wl-text-primary font-semibold")}>
                          {order.orderNumber}
                        </td>
                        <td className={cn("p-4 text-wl-text-primary")}>
                          {order.recipient}
                        </td>
                        <td className={cn("p-4 text-wl-text-secondary text-xs")}>
                          {order.city}, {order.state} {order.zip}
                        </td>
                        <td className={cn("p-4 text-wl-text-primary")}>
                          {order.carrier ? (
                            <span className={cn("font-semibold")}>{order.carrier}</span>
                          ) : (
                            <span className={cn("text-wl-text-tertiary text-xs")}>—</span>
                          )}
                        </td>
                        <td className={cn("p-4 text-wl-text-secondary text-xs")} style={{ fontFamily: "monospace" }}>
                          {order.trackingNumber ? order.trackingNumber.substring(0, 12) + "..." : "—"}
                        </td>
                        <td className={cn("p-4")}>
                          <Badge variant={statusVariant(order.status)}>
                            {statusLabel(order.status)}
                          </Badge>
                        </td>
                        <td className={cn("p-4 text-wl-text-primary font-semibold")}>
                          {order.cost > 0 ? `$${order.cost.toFixed(2)}` : "—"}
                        </td>
                        <td className={cn("p-4 text-center")}>
                          <div className={cn("flex gap-2 justify-center")}>
                            {order.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsCarrierModalOpen(true)}
                                className={cn("text-xs p-1")}
                              >
                                Assign
                              </Button>
                            )}
                            {order.status === "label_created" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn("text-xs p-1")}
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
          <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6")}>
            {shipments.map((ship) => (
              <Card key={ship.id}>
                <CardHeader>
                  <div className={cn("flex items-start justify-between")}>
                    <div>
                      <CardTitle className={cn("text-base mb-1")}>
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
                  <div className={cn("flex flex-col gap-4")}>
                    <div className={cn("flex justify-between pb-3 border-b border-wl-border")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Weight</span>
                      <span className={cn("text-wl-text-primary font-semibold")}>{ship.weight} lbs</span>
                    </div>
                    <div className={cn("flex justify-between pb-3 border-b border-wl-border")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Last Update</span>
                      <span className={cn("text-wl-text-primary font-semibold")}>{ship.lastUpdate}</span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Est. Delivery</span>
                      <span className={cn("text-wl-text-primary font-semibold")}>{ship.estimatedDelivery}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" className={cn("w-full")}>
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* CARRIERS TAB */}
        {activeTab === "carriers" && (
          <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6")}>
            {mockCarriers.map((carrier) => (
              <Card key={carrier.id} className={cn("relative")}>
                <CardHeader>
                  <div className={cn("flex items-start justify-between mb-4")}>
                    <div className={cn("text-4xl")}>{carrier.icon}</div>
                    {carrier.connected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Badge variant="warning">Disconnected</Badge>
                    )}
                  </div>
                  <CardTitle className={cn("text-xl mb-1")}>
                    {carrier.name}
                  </CardTitle>
                  <CardDescription>Shipping carrier integration</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className={cn("flex flex-col gap-4")}>
                    <div className={cn("flex justify-between pb-3 border-b border-wl-border")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Connected Accounts</span>
                      <span className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {carrier.accounts}
                      </span>
                    </div>
                    <div className={cn("flex justify-between pb-3 border-b border-wl-border")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Success Rate</span>
                      <span className={cn("text-sm font-semibold")} style={{ color: carrier.successRate > 0 ? "var(--wl-success)" : "var(--wl-text-tertiary)" }}>
                        {carrier.successRate > 0 ? `${carrier.successRate}%` : "N/A"}
                      </span>
                    </div>
                    <div className={cn("flex justify-between pb-3 border-b border-wl-border")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Avg Cost / lb</span>
                      <span className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {carrier.avgCost > 0 ? `$${carrier.avgCost.toFixed(2)}` : "—"}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>Last Used</span>
                      <span className={cn("text-sm text-wl-text-primary")}>
                        {carrier.lastUsed}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  {carrier.connected ? (
                    <Button variant="secondary" className={cn("w-full")}>
                      Manage Account
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => {
                      setSelectedCarrier(carrier);
                      setIsCarrierModalOpen(true);
                    }} className={cn("w-full")}>
                      <Plus className="w-4 h-4 mr-2" />
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
          <div className={cn("flex gap-3 justify-end")}>
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
        <div className={cn("flex flex-col gap-6")}>
          {selectedCarrier ? (
            <>
              <div>
                <label className={cn("block text-xs font-semibold text-wl-text-primary mb-2")}>
                  API Key
                </label>
                <Input type="password" placeholder="Enter your API key" />
              </div>
              <div>
                <label className={cn("block text-xs font-semibold text-wl-text-primary mb-2")}>
                  Account Number
                </label>
                <Input placeholder="Your account number" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={cn("block text-xs font-semibold text-wl-text-primary mb-2")}>
                  Select Carrier
                </label>
                <Select
                  options={mockCarriers.map((c) => ({ value: c.name, label: `${c.icon} ${c.name}` }))}
                  defaultValue="UPS"
                  onChange={() => {}}
                />
              </div>
              <div>
                <label className={cn("block text-xs font-semibold text-wl-text-primary mb-2")}>
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
              <p className={cn("text-xs text-wl-text-tertiary mt-2")}>
                Selected orders: {selectedOrders.size}
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
