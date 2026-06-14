'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ShippingIntegrationsPage() {
  return (
    <>
      <Header
        title="Shipping Integrations"
        subtitle="Manage shipping carriers, labels, and tracking"
        actions={<Button variant="primary">Add Carrier</Button>}
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Shipments Today"
            value={totalShipsToday}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Total Cost"
            value={formatCurrency(totalCostToday)}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Success Rate"
            value={`${avgSuccessRate.toFixed(1)}%`}
            accentColor="#3b82f6"
            index={2}
          />
          <StatCard
            label="Avg Cost per Package"
            value={formatCurrency(totalCostToday / totalShipsToday)}
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
              <div className="grid grid-cols-4 gap-3 text-xs text-gray-400 mb-4 pb-4 border-b border-wl-border-default">
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    FROM
                  </label>
                  <input
                    type="text"
                    value="New York, NY"
                    disabled
                    className="w-full p-2 bg-wl-bg-surface border border-wl-border-default rounded text-sm text-gray-400"
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
                    className="w-full p-2 bg-wl-bg-surface border border-wl-border-default rounded text-sm text-gray-400"
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
                    className="w-full p-2 bg-wl-bg-surface border border-wl-border-default rounded text-sm text-gray-400"
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
                        : "border-wl-border-default hover:border-wl-border-default"
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

              <div className="flex gap-2 pt-3 border-t border-wl-border-default">
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
                      : "bg-transparent text-gray-400 border-wl-border-default"
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
                      : "border-wl-border-default"
                  )}
                >
                  <div
                    onClick={() =>
                      setExpandedShipment(expandedShipment === shipment.id ? null : shipment.id)
                    }
                    className="p-4 cursor-pointer hover:bg-wl-bg-elevated/30"
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
                    <div className="bg-wl-bg-elevated/50 border-t border-wl-border-default p-4">
                      <h5 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                        Delivery Timeline
                      </h5>
                      <div className="space-y-2">
                        {shipment.timeline.map((event, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 pb-2 last:pb-0 border-b border-wl-border-default last:border-0"
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
            <CardTitle>Shipping Carriers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
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
                        "border-b border-wl-border-default",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-elevated/30"
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
