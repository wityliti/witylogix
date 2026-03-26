"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  MapPin,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

interface PartnerDetail {
  id: string;
  name: string;
  category: string;
  status: string;
  totalDeliveries: number;
  averageDeliveryTime: number;
  successRate: number;
  costPerDelivery: number;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  webhookSecret: string;
  baseUrl: string;
  serviceAreas: string[];
  rateCard: {
    baseRate: number;
    perKmRate: number;
    surcharge: number;
  };
}

const MOCK_PARTNER: PartnerDetail = {
  id: "uber-direct-001",
  name: "Uber Direct",
  category: "Courier",
  status: "Active",
  totalDeliveries: 4521,
  averageDeliveryTime: 22,
  successRate: 99.1,
  costPerDelivery: 3.45,
  apiKey: "COURIER_API_KEY_PLACEHOLDER",
  apiSecret: "COURIER_API_SECRET_PLACEHOLDER",
  webhookUrl: "https://api.example.com/webhooks/courier",
  webhookSecret: "WEBHOOK_SECRET_PLACEHOLDER",
  baseUrl: "https://api.uber.com/v1",
  serviceAreas: ["NYC Metro", "Boston MA", "Philadelphia PA", "Washington DC"],
  rateCard: {
    baseRate: 2.5,
    perKmRate: 0.85,
    surcharge: 0.5,
  },
};

const MOCK_RECENT_DELIVERIES = [
  {
    id: "DEL-001",
    shipmentId: "SHIP-001",
    status: "delivered",
    origin: "Manhattan, NY",
    destination: "Brooklyn, NY",
    distance: 8.5,
    time: 22,
    cost: 3.45,
    date: "2024-03-10 14:30",
  },
  {
    id: "DEL-002",
    shipmentId: "SHIP-002",
    status: "in_transit",
    origin: "Upper East Side, NY",
    destination: "Midtown, NY",
    distance: 4.2,
    time: 15,
    cost: 2.95,
    date: "2024-03-10 13:45",
  },
  {
    id: "DEL-003",
    shipmentId: "SHIP-003",
    status: "delivered",
    origin: "Queens, NY",
    destination: "Manhattan, NY",
    distance: 12.3,
    time: 28,
    cost: 4.25,
    date: "2024-03-10 12:20",
  },
  {
    id: "DEL-004",
    shipmentId: "SHIP-004",
    status: "delivered",
    origin: "Brooklyn, NY",
    destination: "Astoria, NY",
    distance: 6.7,
    time: 18,
    cost: 3.15,
    date: "2024-03-10 11:50",
  },
  {
    id: "DEL-005",
    shipmentId: "SHIP-005",
    status: "failed",
    origin: "Manhattan, NY",
    destination: "Harlem, NY",
    distance: 5.1,
    time: 0,
    cost: 0,
    date: "2024-03-10 10:30",
  },
];

export default function PartnerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const KPICard = ({
    label,
    value,
    suffix,
    icon: Icon,
  }: {
    label: string;
    value: number | string;
    suffix?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }) => (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {suffix && <span className="text-sm text-gray-300">{suffix}</span>}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">
            {MOCK_PARTNER.name}
          </h1>
          <p className="text-gray-300">
            {MOCK_PARTNER.category} • {MOCK_PARTNER.status}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Deliveries"
              value={MOCK_PARTNER.totalDeliveries.toLocaleString()}
              icon={TrendingUp}
            />
            <KPICard
              label="Avg Delivery Time"
              value={MOCK_PARTNER.averageDeliveryTime}
              suffix="min"
              icon={MapPin}
            />
            <KPICard
              label="Success Rate"
              value={MOCK_PARTNER.successRate}
              suffix="%"
              icon={CheckCircle}
            />
            <KPICard
              label="Cost/Delivery"
              value={`$${MOCK_PARTNER.costPerDelivery.toFixed(2)}`}
            />
          </div>

          {/* Coverage Map Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Service Coverage Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-96 bg-gradient-to-br from-blue-500/10 to-blue-500/10 rounded-lg flex items-center justify-center border border-[#1e1e2e]">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-300/50 mx-auto mb-2" />
                  <p className="text-gray-300">
                    Service areas: {MOCK_PARTNER.serviceAreas.join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Deliveries */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Shipment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Route
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Distance
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Time
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wl-border-subtle">
                    {MOCK_RECENT_DELIVERIES.map((delivery) => (
                      <tr
                        key={delivery.id}
                        className="hover:bg-[#12121a]/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-white">
                          {delivery.shipmentId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {delivery.origin} → {delivery.destination}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {delivery.distance} km
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {delivery.time > 0 ? `${delivery.time}m` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          ${delivery.cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-xs font-semibold",
                              delivery.status === "delivered"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : delivery.status === "in_transit"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {delivery.status.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Shipment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Route
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Distance
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Time
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wl-border-subtle">
                    {MOCK_RECENT_DELIVERIES.map((delivery) => (
                      <tr
                        key={delivery.id}
                        className="hover:bg-[#12121a]/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-white">
                          {delivery.shipmentId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {delivery.origin} → {delivery.destination}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {delivery.distance} km
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {delivery.time > 0 ? `${delivery.time}m` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          ${delivery.cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded text-xs font-semibold",
                              delivery.status === "delivered"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : delivery.status === "in_transit"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {delivery.status.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* API Credentials */}
          <Card>
            <CardHeader>
              <CardTitle>API Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={MOCK_PARTNER.apiKey}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleCopy(MOCK_PARTNER.apiKey, "apiKey")}
                  >
                    {copiedField === "apiKey" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  API Secret
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showApiSecret ? "text" : "password"}
                    value={MOCK_PARTNER.apiSecret}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                  >
                    {showApiSecret ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleCopy(MOCK_PARTNER.apiSecret, "apiSecret")}
                  >
                    {copiedField === "apiSecret" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#1e1e2e]">
                <Button variant="danger" size="md">
                  Regenerate Credentials
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={MOCK_PARTNER.webhookUrl}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleCopy(MOCK_PARTNER.webhookUrl, "webhook")}
                  >
                    {copiedField === "webhook" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Webhook Secret
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={MOCK_PARTNER.webhookSecret}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() =>
                      handleCopy(MOCK_PARTNER.webhookSecret, "webhookSecret")
                    }
                  >
                    {copiedField === "webhookSecret" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  Base URL
                </label>
                <Input
                  type="text"
                  value={MOCK_PARTNER.baseUrl}
                  readOnly
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Rate Card */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">
                    Base Rate
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded bg-[#12121a]">
                    <span className="font-mono text-white">
                      ${MOCK_PARTNER.rateCard.baseRate.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">
                    Per KM Rate
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded bg-[#12121a]">
                    <span className="font-mono text-white">
                      ${MOCK_PARTNER.rateCard.perKmRate.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">
                    Surcharge
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded bg-[#12121a]">
                    <span className="font-mono text-white">
                      ${MOCK_PARTNER.rateCard.surcharge.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Area Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Service Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MOCK_PARTNER.serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium"
                  >
                    {area}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="secondary" size="md">
                  Manage Service Areas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA Tab */}
        <TabsContent value="sla" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Level Agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Target Delivery Time
                  </span>
                  <p className="text-2xl font-bold text-white mt-2">
                    24 hours
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[#12121a] border border-[#1e1e2e]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                    Min Success Rate
                  </span>
                  <p className="text-2xl font-bold text-white mt-2">
                    98%
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-400">
                  Current performance meets SLA requirements
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
