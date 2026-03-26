'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════
   SHIPPING INTEGRATION PAGE — Multi-carrier & label management
   ═══════════════════════════════════════════════════════════ */

interface ShippingCarrier {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected";
  shipsToday: number;
  avgCostPerPackage: number;
  deliverySuccessRate: number;
  apiBalance: number;
}

interface ShipmentTracking {
  id: string;
  trackingNumber: string;
  carrier: string;
  customer: string;
  origin: string;
  destination: string;
  status: "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed";
  weight: number;
  cost: number;
  estimatedDelivery: string;
  lastUpdate: string;
  timeline: Array<{ status: string; timestamp: string; location: string }>;
}

interface RateQuote {
  id: string;
  carrier: string;
  serviceType: string;
  weight: number;
  origin: string;
  destination: string;
  cost: number;
  deliveryDays: number;
  selected: boolean;
}

interface ShippingAnalytic {
  date: string;
  shipmentsCount: number;
  totalCost: number;
  costPerPackage: number;
  successRate: number;
  avgDeliveryTime: number;
}

const SHIPPING_CARRIERS: ShippingCarrier[] = [
  {
    id: "shippo",
    name: "Shippo",
    logo: "SP",
    status: "connected",
    shipsToday: 245,
    avgCostPerPackage: 6.50,
    deliverySuccessRate: 98.5,
    apiBalance: 1250.75,
  },
  {
    id: "shipstation",
    name: "ShipStation",
    logo: "SS",
    status: "connected",
    shipsToday: 189,
    avgCostPerPackage: 7.20,
    deliverySuccessRate: 97.8,
    apiBalance: 850.40,
  },
  {
    id: "easypost",
    name: "EasyPost",
    logo: "EP",
    status: "connected",
    shipsToday: 156,
    avgCostPerPackage: 6.75,
    deliverySuccessRate: 98.2,
    apiBalance: 2100.50,
  },
  {
    id: "fedex",
    name: "FedEx Direct",
    logo: "FX",
    status: "disconnected",
    shipsToday: 0,
    avgCostPerPackage: 8.50,
    deliverySuccessRate: 0,
    apiBalance: 0,
  },
];

const SHIPMENTS: ShipmentTracking[] = [
  {
    id: "ship-001",
    trackingNumber: "1Z999AA10123456784",
    carrier: "Shippo",
    customer: "John Doe",
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    status: "in_transit",
    weight: 2.5,
    cost: 8.45,
    estimatedDelivery: "2026-03-15",
    lastUpdate: "2026-03-12T14:30:00Z",
    timeline: [
      { status: "Picked Up", timestamp: "2026-03-12T08:15:00Z", location: "New York, NY" },
      { status: "In Transit", timestamp: "2026-03-12T14:30:00Z", location: "Chicago, IL" },
    ],
  },
  {
    id: "ship-002",
    trackingNumber: "794618519263",
    carrier: "ShipStation",
    customer: "Jane Smith",
    origin: "Chicago, IL",
    destination: "Miami, FL",
    status: "out_for_delivery",
    weight: 1.8,
    cost: 7.20,
    estimatedDelivery: "2026-03-14",
    lastUpdate: "2026-03-12T13:45:00Z",
    timeline: [
      { status: "Picked Up", timestamp: "2026-03-10T09:00:00Z", location: "Chicago, IL" },
      { status: "In Transit", timestamp: "2026-03-11T16:20:00Z", location: "Atlanta, GA" },
      { status: "Out for Delivery", timestamp: "2026-03-12T13:45:00Z", location: "Miami, FL" },
    ],
  },
  {
    id: "ship-003",
    trackingNumber: "1234567890123",
    carrier: "EasyPost",
    customer: "Bob Johnson",
    origin: "Seattle, WA",
    destination: "Boston, MA",
    status: "delivered",
    weight: 3.2,
    cost: 9.15,
    estimatedDelivery: "2026-03-14",
    lastUpdate: "2026-03-12T11:20:00Z",
    timeline: [
      { status: "Picked Up", timestamp: "2026-03-09T07:30:00Z", location: "Seattle, WA" },
      { status: "In Transit", timestamp: "2026-03-10T15:40:00Z", location: "Denver, CO" },
      { status: "In Transit", timestamp: "2026-03-11T18:50:00Z", location: "Chicago, IL" },
      { status: "Delivered", timestamp: "2026-03-12T11:20:00Z", location: "Boston, MA" },
    ],
  },
  {
    id: "ship-004",
    trackingNumber: "987654321098",
    carrier: "Shippo",
    customer: "Alice Williams",
    origin: "Denver, CO",
    destination: "Portland, OR",
    status: "picked_up",
    weight: 2.1,
    cost: 6.80,
    estimatedDelivery: "2026-03-16",
    lastUpdate: "2026-03-12T10:00:00Z",
    timeline: [
      { status: "Picked Up", timestamp: "2026-03-12T10:00:00Z", location: "Denver, CO" },
    ],
  },
  {
    id: "ship-005",
    trackingNumber: "5555666677778888",
    carrier: "ShipStation",
    customer: "Charlie Brown",
    origin: "Phoenix, AZ",
    destination: "Dallas, TX",
    status: "pending",
    weight: 1.5,
    cost: 5.95,
    estimatedDelivery: "2026-03-17",
    lastUpdate: "2026-03-12T09:30:00Z",
    timeline: [
      { status: "Label Created", timestamp: "2026-03-12T09:30:00Z", location: "Phoenix, AZ" },
    ],
  },
  {
    id: "ship-006",
    trackingNumber: "9999888877776666",
    carrier: "EasyPost",
    customer: "Diana Prince",
    origin: "San Francisco, CA",
    destination: "New York, NY",
    status: "failed",
    weight: 2.8,
    cost: 7.50,
    estimatedDelivery: "2026-03-13",
    lastUpdate: "2026-03-11T16:45:00Z",
    timeline: [
      { status: "Picked Up", timestamp: "2026-03-11T08:15:00Z", location: "San Francisco, CA" },
      {
        status: "Delivery Failed",
        timestamp: "2026-03-11T16:45:00Z",
        location: "New York, NY",
      },
    ],
  },
];

const RATE_QUOTES: RateQuote[] = [
  {
    id: "quote-001",
    carrier: "Shippo Ground",
    serviceType: "Ground",
    weight: 2.5,
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    cost: 6.50,
    deliveryDays: 5,
    selected: true,
  },
  {
    id: "quote-002",
    carrier: "Shippo Express",
    serviceType: "Express",
    weight: 2.5,
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    cost: 18.75,
    deliveryDays: 2,
    selected: false,
  },
  {
    id: "quote-003",
    carrier: "ShipStation Standard",
    serviceType: "Standard",
    weight: 2.5,
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    cost: 7.20,
    deliveryDays: 4,
    selected: false,
  },
  {
    id: "quote-004",
    carrier: "EasyPost Priority",
    serviceType: "Priority",
    weight: 2.5,
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    cost: 15.50,
    deliveryDays: 3,
    selected: false,
  },
  {
    id: "quote-005",
    carrier: "EasyPost International",
    serviceType: "International",
    weight: 2.5,
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    cost: 24.99,
    deliveryDays: 7,
    selected: false,
  },
];

const ANALYTICS: ShippingAnalytic[] = [
  {
    date: "2026-03-12",
    shipmentsCount: 590,
    totalCost: 3892.50,
    costPerPackage: 6.59,
    successRate: 98.3,
    avgDeliveryTime: 4.2,
  },
  {
    date: "2026-03-11",
    shipmentsCount: 534,
    totalCost: 3654.75,
    costPerPackage: 6.84,
    successRate: 97.9,
    avgDeliveryTime: 4.5,
  },
  {
    date: "2026-03-10",
    shipmentsCount: 487,
    totalCost: 3289.40,
    costPerPackage: 6.75,
    successRate: 98.1,
    avgDeliveryTime: 4.3,
  },
  {
    date: "2026-03-09",
    shipmentsCount: 456,
    totalCost: 3012.80,
    costPerPackage: 6.60,
    successRate: 98.5,
    avgDeliveryTime: 4.1,
  },
  {
    date: "2026-03-08",
    shipmentsCount: 512,
    totalCost: 3456.45,
    costPerPackage: 6.75,
    successRate: 97.6,
    avgDeliveryTime: 4.4,
  },
];

const getStatusColor = (status: string): "success" | "warning" | "info" | "danger" | "default" => {
  switch (status) {
    case "delivered":
      return "success";
    case "out_for_delivery":
    case "in_transit":
    case "picked_up":
      return "warning";
    case "pending":
      return "info";
    case "failed":
      return "danger";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case "delivered":
      return "✓";
    case "out_for_delivery":
      return "⟿";
    case "in_transit":
      return "→";
    case "picked_up":
      return "◐";
    case "pending":
      return "⧐";
    case "failed":
      return "✕";
    default:
      return "○";
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return "—";
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

export default function ShippingIntegrationPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("shippo");
  const [shipmentFilterStatus, setShipmentFilterStatus] = useState<"all" | "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed">("all");
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);

  // Calculate stats
  const connectedCount = SHIPPING_CARRIERS.filter((c) => c.status === "connected").length;
  const totalShipsToday = SHIPPING_CARRIERS.reduce((sum, c) => sum + c.shipsToday, 0);
  const avgSuccessRate =
    SHIPPING_CARRIERS.filter((c) => c.status === "connected").reduce(
      (sum, c) => sum + c.deliverySuccessRate,
      0
    ) / connectedCount;
  const totalCostToday = SHIPPING_CARRIERS.reduce((sum, c) => sum + c.shipsToday * c.avgCostPerPackage, 0);

  const filteredShipments = useMemo(
    () =>
      SHIPMENTS.filter((shipment) => {
        if (shipmentFilterStatus !== "all" && shipment.status !== shipmentFilterStatus)
          return false;
        return true;
      }),
    [shipmentFilterStatus]
  );

  const selectedCarrierData = SHIPPING_CARRIERS.find((c) => c.id === selectedCarrier);

  return (
    <>
      <Header
        title="Shipping Integration"
        subtitle={`${connectedCount} connected carriers · ${totalShipsToday} shipments today`}
        actions={
          <Button variant="primary" size="md">
            + Generate Label
          </Button>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Shipments Today"
            value={totalShipsToday}
            change={{ value: 15.8, label: "vs yesterday" }}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Total Cost"
            value={formatCurrency(totalCostToday)}
            change={{ value: 5.2, label: "vs yesterday" }}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Success Rate"
            value={`${avgSuccessRate.toFixed(1)}%`}
            change={{ value: 0.8, label: "vs avg" }}
            accentColor="#3b82f6"
            index={2}
          />
          <StatCard
            label="Avg Cost per Package"
            value={formatCurrency(totalCostToday / totalShipsToday)}
            change={{ value: -2.1, label: "vs target" }}
            accentColor="#3b82f6"
            index={3}
          />
        </div>

        {/* Carrier Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Connected Shipping Carriers
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {SHIPPING_CARRIERS.map((carrier) => (
              <Card
                key={carrier.id}
                hover
                onClick={() => setSelectedCarrier(carrier.id)}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedCarrier === carrier.id && "ring-2 ring-blue-500"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                      {carrier.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {carrier.name}
                      </h3>
                      <Badge variant={carrier.status === "connected" ? "success" : "default"}>
                        {carrier.status === "connected" ? "● " : "○ "}
                        {carrier.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {carrier.status === "connected" && (
                  <div className="space-y-2 text-xs text-gray-400 mb-4">
                    <div className="flex justify-between">
                      <span>Ships Today:</span>
                      <span className="text-white font-semibold">
                        {carrier.shipsToday}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Cost:</span>
                      <span className="text-white font-semibold">
                        {formatCurrency(carrier.avgCostPerPackage)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="text-emerald-500 font-semibold">
                        {carrier.deliverySuccessRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>API Balance:</span>
                      <span className="text-white font-semibold">
                        {formatCurrency(carrier.apiBalance)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Settings
                  </Button>
                  {carrier.status === "connected" && (
                    <Button variant="ghost" size="sm" className="flex-1">
                      Get Rates
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Rate Comparison Tool */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Rate Comparison & Label Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3 text-xs text-gray-400 mb-4 pb-4 border-b border-[#1e1e2e]">
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    FROM
                  </label>
                  <input
                    type="text"
                    value="New York, NY"
                    disabled
                    className="w-full p-2 bg-[#12121a] border border-[#1e1e2e] rounded text-sm text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    TO
                  </label>
                  <input
                    type="text"
                    value="Los Angeles, CA"
                    disabled
                    className="w-full p-2 bg-[#12121a] border border-[#1e1e2e] rounded text-sm text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    WEIGHT
                  </label>
                  <input
                    type="number"
                    value={2.5}
                    disabled
                    className="w-full p-2 bg-[#12121a] border border-[#1e1e2e] rounded text-sm text-gray-400"
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="primary" size="sm" className="w-full">
                    Get Rates
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {RATE_QUOTES.map((quote) => (
                  <div
                    key={quote.id}
                    className={cn(
                      "p-3 rounded-md border cursor-pointer transition-all",
                      quote.selected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[#1e1e2e] hover:border-[#1e1e2e]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white">
                          {quote.carrier}
                        </h4>
                        <p className="text-xs text-gray-300">
                          Delivery in {quote.deliveryDays} days
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(quote.cost)}
                          </p>
                        </div>
                        <input
                          type="radio"
                          checked={quote.selected}
                          onChange={() => {}}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#1e1e2e]">
                <Button variant="primary" size="sm" className="flex-1">
                  Generate Label
                </Button>
                <Button variant="secondary" size="sm" className="flex-1">
                  Batch Labels
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Dashboard */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Shipment Tracking</CardTitle>
            <div className="flex gap-2 ml-auto">
              {(["all", "pending", "picked_up", "in_transit", "out_for_delivery", "delivered", "failed"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setShipmentFilterStatus(status)}
                  className={cn(
                    "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                    shipmentFilterStatus === status
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-transparent text-gray-400 border-[#1e1e2e]"
                  )}
                >
                  {status === "all"
                    ? "All"
                    : status === "out_for_delivery"
                    ? "Out for Delivery"
                    : status === "picked_up"
                    ? "Picked Up"
                    : status === "in_transit"
                    ? "Transit"
                    : status}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className={cn(
                    "rounded-lg border overflow-hidden transition-all",
                    expandedShipment === shipment.id
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-[#1e1e2e]"
                  )}
                >
                  <div
                    onClick={() =>
                      setExpandedShipment(expandedShipment === shipment.id ? null : shipment.id)
                    }
                    className="p-4 cursor-pointer hover:bg-[#1a1a2e]/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white">
                          {shipment.trackingNumber}
                        </h4>
                        <p className="text-xs text-gray-300">
                          {shipment.customer} • {shipment.origin} → {shipment.destination}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusColor(shipment.status)}>
                          {getStatusIcon(shipment.status)} {shipment.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-gray-300">Carrier:</span>
                        <p className="font-semibold text-white">{shipment.carrier}</p>
                      </div>
                      <div>
                        <span className="text-gray-300">Weight:</span>
                        <p className="font-semibold text-white">
                          {shipment.weight} kg
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-300">Cost:</span>
                        <p className="font-semibold text-white">
                          {formatCurrency(shipment.cost)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-300">Est. Delivery:</span>
                        <p className="font-semibold text-white">
                          {new Date(shipment.estimatedDelivery).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {expandedShipment === shipment.id && (
                    <div className="bg-[#1a1a2e]/50 border-t border-[#1e1e2e] p-4">
                      <h5 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                        Delivery Timeline
                      </h5>
                      <div className="space-y-2">
                        {shipment.timeline.map((event, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 pb-2 last:pb-0 border-b border-[#1e1e2e] last:border-0"
                          >
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-white">
                                {event.status}
                              </p>
                              <p className="text-xs text-gray-300">
                                {formatDateTime(event.timestamp)} • {event.location}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="p-3 text-left font-semibold text-gray-400">Date</th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Shipments
                    </th>
                    <th className="p-3 text-right font-semibold text-gray-400">
                      Total Cost
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Avg Cost
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Success
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Avg Delivery
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ANALYTICS.map((analytic, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-[#1e1e2e]",
                        idx % 2 === 0 ? "bg-transparent" : "bg-[#1a1a2e]/30"
                      )}
                    >
                      <td className="p-3 text-white font-semibold">
                        {new Date(analytic.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-3 text-center text-white font-semibold">
                        {analytic.shipmentsCount}
                      </td>
                      <td className="p-3 text-right text-white font-semibold">
                        {formatCurrency(analytic.totalCost)}
                      </td>
                      <td className="p-3 text-center text-white font-semibold">
                        {formatCurrency(analytic.costPerPackage)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="success">{analytic.successRate}%</Badge>
                      </td>
                      <td className="p-3 text-center text-gray-400">
                        {analytic.avgDeliveryTime}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
