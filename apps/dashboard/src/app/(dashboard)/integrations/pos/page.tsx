'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function POSIntegrationsPage() {
  return (
    <>
      <Header
        title="POS Integrations"
        subtitle="Manage point-of-sale and restaurant system connections"
        actions={<Button variant="primary">Add POS System</Button>}
      />

      <div className="p-6 bg-wl-bg-root min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Locations"
            value={totalLocations}
            change={{ value: 12.5, label: "vs last month" }}
            accentColor="#3b82f6"
            index={0}
          />
          <StatCard
            label="Orders Today"
            value={totalOrdersToday}
            change={{ value: 18.3, label: "vs yesterday" }}
            accentColor="#3b82f6"
            index={1}
          />
          <StatCard
            label="Revenue Today"
            value={formatCurrency(totalRevenueToday)}
            change={{ value: 15.7, label: "vs yesterday" }}
            accentColor="#3b82f6"
            index={2}
          />
          <StatCard
            label="Avg Order Value"
            value={formatCurrency(totalRevenueToday / totalOrdersToday)}
            change={{ value: 3.2, label: "vs avg" }}
            accentColor="#3b82f6"
            index={3}
          />
        </div>

        {/* POS Provider Cards */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
            Connected POS Systems
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {POS_PROVIDERS.map((provider) => (
              <Card key={provider.id} hover>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                      {provider.logo}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {provider.name}
                      </h3>
                      <Badge variant={provider.status === "connected" ? "success" : "danger"}>
                        {getStatusIcon(provider.status)} {provider.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-gray-300">Locations</p>
                    <p className="text-lg font-bold text-white">
                      {provider.locationsCount}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-gray-300">Terminals</p>
                    <p className="text-lg font-bold text-white">
                      {provider.terminalsCount}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-gray-300">Orders Today</p>
                    <p className="text-lg font-bold text-white">
                      {provider.ordersToday}
                    </p>
                  </div>
                  <div className="bg-wl-bg-surface rounded p-2">
                    <p className="text-xs text-gray-300">Revenue</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(provider.revenueToday)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-300 mb-3">
                  Last sync: {formatDateTime(provider.lastSync)}
                </p>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Settings
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Sync Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Location Management */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Location Terminal Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {LOCATIONS.map((location) => (
                <div
                  key={location.id}
                  onClick={() => setSelectedLocation(location.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all",
                    selectedLocation === location.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-wl-border-default hover:border-wl-border-default"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{location.name}</h4>
                      <p className="text-xs text-gray-300">{location.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatCurrency(location.revenueToday)}
                      </p>
                      <p className="text-xs text-gray-300">
                        {location.ordersToday} orders
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={getStatusColor(location.status)}>
                        {getStatusIcon(location.status)} {location.status}
                      </Badge>
                      <span className="text-gray-300">{location.terminal}</span>
                    </div>
                    <span className="text-xs text-gray-300">
                      Synced {formatDateTime(location.lastSyncTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Menu Items & Inventory</CardTitle>
            <div className="flex gap-2 ml-auto">
              {(["all", "active", "inactive", "out_of_stock"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setMenuFilterStatus(status)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md border capitalize transition-all",
                    menuFilterStatus === status
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-transparent text-gray-400 border-wl-border-default"
                  )}
                >
                  {status === "all" ? "All" : status === "out_of_stock" ? "Out of Stock" : status}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search menu items..."
                value={menuSearchTerm}
                onChange={(e) => setMenuSearchTerm(e.target.value)}
                className="w-full p-2 px-3 bg-wl-bg-surface border border-wl-border-default rounded-md text-sm text-white outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="p-3 text-left font-semibold text-gray-400">
                      Item Name
                    </th>
                    <th className="p-3 text-left font-semibold text-gray-400">
                      Category
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Price
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Stock
                    </th>
                    <th className="p-3 text-center font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="p-3 text-right font-semibold text-gray-400">
                      Last Orders
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenuItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-wl-border-default",
                        idx % 2 === 0 ? "bg-transparent" : "bg-wl-bg-elevated/30"
                      )}
                    >
                      <td className="p-3 text-white font-medium">{item.name}</td>
                      <td className="p-3 text-gray-400 text-xs">
                        <Badge variant="default">{item.category}</Badge>
                      </td>
                      <td className="p-3 text-center font-semibold text-white">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            item.quantity === 0
                              ? "text-red-500"
                              : item.quantity < 50
                              ? "text-amber-500"
                              : "text-emerald-500"
                          )}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            item.status === "active"
                              ? "success"
                              : item.status === "out_of_stock"
                              ? "danger"
                              : "default"
                          }
                        >
                          {item.status === "out_of_stock" ? "Out" : item.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-gray-400">
                        {item.lastOrders}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Order Feed */}
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Order Feed</CardTitle>
              <div className="flex gap-2 ml-auto">
                {(["all", "pending", "preparing", "ready", "completed"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilterStatus(status)}
                    className={cn(
                      "px-2 py-1 text-xs font-semibold rounded border capitalize transition-all",
                      orderFilterStatus === status
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-transparent text-gray-400 border-wl-border-default"
                    )}
                  >
                    {status === "all" ? "All" : status}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={cn(
                      "p-3 rounded-md border",
                      order.status === "completed"
                        ? "border-emerald-400/20 bg-emerald-bg/20"
                        : order.status === "ready"
                        ? "border-blue-400/20 bg-blue-bg/20"
                        : "border-amber-400/20 bg-amber-bg/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {order.orderId}
                        </p>
                        <p className="text-xs text-gray-300">{order.customer}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(order.total)}
                        </p>
                        <Badge variant={getStatusColor(order.status)} className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{order.items} items</span>
                      <span className="text-gray-300">{formatDateTime(order.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Item Performance Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Top Item Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ITEM_PERFORMANCE.map((item, idx) => (
                  <div key={idx} className="border-b border-wl-border-default last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {item.name}
                        </h4>
                        <p className="text-xs text-gray-300">
                          {item.orders} orders • {formatCurrency(item.revenue)}
                        </p>
                      </div>
                      <Badge
                        variant={item.trend === "up" ? "success" : item.trend === "down" ? "danger" : "default"}
                      >
                        {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"} {item.trend}
                      </Badge>
                    </div>
                    <div className="w-full bg-wl-bg-surface rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                        style={{
                          width: `${(item.orders / ITEM_PERFORMANCE[0].orders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
