"use client";

import { useState, useMemo } from "react";
import { cn } from "../../lib/utils";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Tabs } from "../../components/ui/tabs";
import { Table } from "../../components/ui/table";
import { Select } from "../../components/ui/select";
import {
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  MapPin,
  Package,
  Phone,
  ExternalLink,
  Download,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   DELIVERY PAGE — Standard Delivery Workflow Hub
   ═══════════════════════════════════════════════════════════ */

type DeliveryStatus = "pending" | "in-transit" | "completed" | "failed" | "returned";
type ExceptionReason = "customer_unavailable" | "wrong_address" | "damaged" | "refused" | "access_denied";

interface QueueOrder {
  id: string;
  orderNumber: string;
  customer: string;
  address: string;
  items: number;
  weight: number;
  timeSlot: string;
  status: DeliveryStatus;
  priority: "low" | "medium" | "high";
  zone: string;
}

interface InTransitDelivery {
  id: string;
  driverId: string;
  driverName: string;
  currentStop: string;
  stopsTotal: number;
  stopsCompleted: number;
  eta: string;
  ordersInRoute: number;
}

interface CompletedDelivery {
  id: string;
  orderNumber: string;
  customer: string;
  driver: string;
  deliveredAt: string;
  podStatus: "pending" | "collected" | "rejected";
  rating: number;
}

interface ExceptionDelivery {
  id: string;
  orderNumber: string;
  reason: ExceptionReason;
  driverNotes: string;
  attempts: number;
  lastAttempt: string;
}

const QUEUE_ORDERS: QueueOrder[] = [
  {
    id: "q-1",
    orderNumber: "ORD-2026-5401",
    customer: "Sarah Mitchell",
    address: "123 Oak Street, Apt 4B",
    items: 3,
    weight: 2.5,
    timeSlot: "09:00 - 11:00",
    status: "pending",
    priority: "high",
    zone: "Downtown Core",
  },
  {
    id: "q-2",
    orderNumber: "ORD-2026-5402",
    customer: "John Martinez",
    address: "456 Pine Avenue",
    items: 5,
    weight: 4.2,
    timeSlot: "11:00 - 13:00",
    status: "pending",
    priority: "medium",
    zone: "Midtown East",
  },
  {
    id: "q-3",
    orderNumber: "ORD-2026-5403",
    customer: "Emma Watson",
    address: "789 Elm Road, Suite 200",
    items: 2,
    weight: 1.8,
    timeSlot: "09:00 - 11:00",
    status: "pending",
    priority: "low",
    zone: "Downtown Core",
  },
  {
    id: "q-4",
    orderNumber: "ORD-2026-5404",
    customer: "Michael Chen",
    address: "321 Maple Drive",
    items: 7,
    weight: 5.6,
    timeSlot: "13:00 - 15:00",
    status: "pending",
    priority: "high",
    zone: "West Side",
  },
  {
    id: "q-5",
    orderNumber: "ORD-2026-5405",
    customer: "Jessica Brown",
    address: "654 Cedar Lane",
    items: 4,
    weight: 3.1,
    timeSlot: "11:00 - 13:00",
    status: "pending",
    priority: "medium",
    zone: "South District",
  },
];

const IN_TRANSIT_DELIVERIES: InTransitDelivery[] = [
  {
    id: "it-1",
    driverId: "drv-001",
    driverName: "Michael Brown",
    currentStop: "123 Broadway, NYC",
    stopsTotal: 12,
    stopsCompleted: 5,
    eta: "2:30 PM",
    ordersInRoute: 7,
  },
  {
    id: "it-2",
    driverId: "drv-002",
    driverName: "Sarah Connor",
    currentStop: "456 5th Ave, NYC",
    stopsTotal: 8,
    stopsCompleted: 3,
    eta: "3:15 PM",
    ordersInRoute: 5,
  },
  {
    id: "it-3",
    driverId: "drv-003",
    driverName: "Tom Hardy",
    currentStop: "789 Park Ave, NYC",
    stopsTotal: 15,
    stopsCompleted: 8,
    eta: "4:00 PM",
    ordersInRoute: 7,
  },
];

const COMPLETED_DELIVERIES: CompletedDelivery[] = [
  {
    id: "c-1",
    orderNumber: "ORD-2026-5390",
    customer: "Robert Davis",
    driver: "Michael Brown",
    deliveredAt: "09:45 AM",
    podStatus: "collected",
    rating: 5,
  },
  {
    id: "c-2",
    orderNumber: "ORD-2026-5391",
    customer: "Lisa Anderson",
    driver: "Sarah Connor",
    deliveredAt: "10:12 AM",
    podStatus: "collected",
    rating: 4,
  },
  {
    id: "c-3",
    orderNumber: "ORD-2026-5392",
    customer: "David Wilson",
    driver: "Tom Hardy",
    deliveredAt: "10:58 AM",
    podStatus: "pending",
    rating: 0,
  },
  {
    id: "c-4",
    orderNumber: "ORD-2026-5393",
    customer: "Jennifer Garcia",
    driver: "Michael Brown",
    deliveredAt: "11:23 AM",
    podStatus: "collected",
    rating: 5,
  },
  {
    id: "c-5",
    orderNumber: "ORD-2026-5394",
    customer: "Christopher Lee",
    driver: "Sarah Connor",
    deliveredAt: "11:45 AM",
    podStatus: "collected",
    rating: 4,
  },
];

const EXCEPTIONS: ExceptionDelivery[] = [
  {
    id: "ex-1",
    orderNumber: "ORD-2026-5380",
    reason: "customer_unavailable",
    driverNotes: "Customer not home, left notice",
    attempts: 1,
    lastAttempt: "09:30 AM",
  },
  {
    id: "ex-2",
    orderNumber: "ORD-2026-5381",
    reason: "wrong_address",
    driverNotes: "Address seems incorrect, building not found",
    attempts: 2,
    lastAttempt: "10:15 AM",
  },
  {
    id: "ex-3",
    orderNumber: "ORD-2026-5382",
    reason: "damaged",
    driverNotes: "Package damaged during transit, contents compromised",
    attempts: 1,
    lastAttempt: "09:50 AM",
  },
];

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState("queue");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Calculate stats
  const queueCount = QUEUE_ORDERS.length;
  const inTransitCount = IN_TRANSIT_DELIVERIES.reduce((sum, d) => sum + d.ordersInRoute, 0);
  const completedCount = COMPLETED_DELIVERIES.length;
  const exceptionRate = ((EXCEPTIONS.length / (queueCount + completedCount + EXCEPTIONS.length)) * 100).toFixed(1);

  // Filter queue orders
  const filteredQueue = useMemo(() => {
    return QUEUE_ORDERS.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (zoneFilter !== "all" && order.zone !== zoneFilter) return false;
      if (priorityFilter !== "all" && order.priority !== priorityFilter) return false;
      return true;
    });
  }, [statusFilter, zoneFilter, priorityFilter]);

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Status color mapping
  const getStatusColor = (status: DeliveryStatus | "collected" | "pending" | "rejected") => {
    const colorMap: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
      completed: "success",
      "in-transit": "info",
      pending: "warning",
      failed: "danger",
      returned: "danger",
      collected: "success",
      rejected: "danger",
    };
    return colorMap[status] || "default";
  };

  // Priority color mapping
  const getPriorityColor = (priority: "low" | "medium" | "high") => {
    const colorMap: Record<string, "default" | "info" | "warning" | "danger"> = {
      low: "default",
      medium: "info",
      high: "danger",
    };
    return colorMap[priority];
  };

  const tabs = [
    { id: "queue", label: "Queue", count: queueCount, icon: <Package className="w-4 h-4" /> },
    { id: "in-transit", label: "In Transit", count: inTransitCount, icon: <Truck className="w-4 h-4" /> },
    { id: "completed", label: "Completed", count: completedCount, icon: <CheckCircle className="w-4 h-4" /> },
    { id: "exceptions", label: "Exceptions", count: EXCEPTIONS.length, icon: <AlertCircle className="w-4 h-4" /> },
  ];

  return (
    <>
      <Header
        title="Delivery Operations"
        subtitle="Manage and track all deliveries in real-time"
        actions={
          <div className={cn("flex gap-3")}>
            <Button variant="secondary" size="md">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="primary" size="md">
              <Zap className="w-4 h-4 mr-2" />
              Batch Action
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* Top Stats Bar */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6")}>
          <StatCard
            label="Pending"
            value={queueCount}
            icon={<Package className="w-5 h-5" />}
            accentColor="var(--wl-warning-400)"
            index={0}
          />
          <StatCard
            label="In Transit"
            value={inTransitCount}
            icon={<Truck className="w-5 h-5" />}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Completed Today"
            value={completedCount}
            icon={<CheckCircle className="w-5 h-5" />}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Exception Rate"
            value={`${exceptionRate}%`}
            icon={<AlertCircle className="w-5 h-5" />}
            accentColor="var(--wl-danger-400)"
            index={3}
          />
        </div>

        {/* Tabs Navigation */}
        <div className={cn("mb-6")}>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
        </div>

        {/* Queue Tab */}
        {activeTab === "queue" && (
          <div className={cn("flex flex-col gap-4")}>
            {/* Filters */}
            <Card>
              <CardContent>
                <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4")}>
                  <Select
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "pending", label: "Pending" },
                      { value: "in-transit", label: "In Transit" },
                    ]}
                  />
                  <Select
                    label="Zone"
                    value={zoneFilter}
                    onChange={setZoneFilter}
                    options={[
                      { value: "all", label: "All Zones" },
                      { value: "Downtown Core", label: "Downtown Core" },
                      { value: "Midtown East", label: "Midtown East" },
                      { value: "West Side", label: "West Side" },
                      { value: "South District", label: "South District" },
                    ]}
                  />
                  <Select
                    label="Priority"
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={[
                      { value: "all", label: "All Priorities" },
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Batch Actions */}
            {selectedOrders.size > 0 && (
              <Card className={cn("bg-[rgba(245,166,35,0.08)]")} style={{ borderColor: "var(--wl-primary-500)" }}>
                <CardContent>
                  <div className={cn("flex items-center justify-between")}>
                    <span className="text-wl-text-secondary">
                      {selectedOrders.size} order{selectedOrders.size !== 1 ? "s" : ""} selected
                    </span>
                    <div className={cn("flex gap-2")}>
                      <Button variant="primary" size="sm">
                        Assign Driver
                      </Button>
                      <Button variant="secondary" size="sm">
                        Print Labels
                      </Button>
                      <Button variant="ghost" size="sm">
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Orders Table */}
            <Card>
              <CardContent>
                <Table<QueueOrder>
                  columns={[
                    {
                      key: "orderNumber",
                      header: "Order #",
                      sortable: true,
                      width: "120px",
                      render: (order) => (
                        <div className={cn("flex items-center gap-2")}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className={cn("cursor-pointer")}
                          />
                          <span className={cn("font-semibold font-mono")}>
                            {order.orderNumber}
                          </span>
                        </div>
                      ),
                    },
                    { key: "customer", header: "Customer", sortable: true, width: "180px" },
                    { key: "address", header: "Address", sortable: false, width: "250px" },
                    {
                      key: "items",
                      header: "Items",
                      align: "center" as const,
                      width: "80px",
                      render: (order) => (
                        <span className="font-mono">
                          {order.items}
                        </span>
                      ),
                    },
                    {
                      key: "weight",
                      header: "Weight (kg)",
                      align: "center" as const,
                      width: "100px",
                      render: (order) => (
                        <span className="font-mono">
                          {order.weight.toFixed(1)}
                        </span>
                      ),
                    },
                    { key: "timeSlot", header: "Time Slot", width: "140px" },
                    {
                      key: "priority",
                      header: "Priority",
                      width: "100px",
                      render: (order) => (
                        <Badge variant={getPriorityColor(order.priority)}>
                          {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
                        </Badge>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      width: "120px",
                      render: (order) => (
                        <Badge variant={getStatusColor(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      ),
                    },
                    {
                      key: "id",
                      header: "Actions",
                      width: "100px",
                      align: "center" as const,
                      render: () => (
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      ),
                    },
                  ]}
                  data={filteredQueue}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* In Transit Tab */}
        {activeTab === "in-transit" && (
          <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4")}>
            {IN_TRANSIT_DELIVERIES.map((delivery, i) => (
              <Card
                key={delivery.id}
                hover
                className="animate-in"
                style={{
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <CardHeader className={cn("mb-4")}>
                  <div className={cn("flex justify-between items-center w-full")}>
                    <div>
                      <h4 className={cn("text-base font-bold text-wl-text-primary m-0")}>
                        {delivery.driverName}
                      </h4>
                      <p className={cn("text-xs text-wl-text-tertiary m-0 mt-1")}>
                        Route {delivery.driverId}
                      </p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Current Stop */}
                  <div className={cn("mb-4 p-3 bg-wl-bg-surface rounded-lg")}>
                    <div className={cn("flex items-start gap-2")}>
                      <MapPin className="w-4 h-4 text-wl-info-400 mt-0.5 flex-shrink-0" />
                      <div className={cn("flex-1")}>
                        <div className={cn("text-xs text-wl-text-tertiary")}>
                          Current Stop
                        </div>
                        <div className={cn("text-sm font-semibold text-wl-text-primary mt-0.5")}>
                          {delivery.currentStop}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className={cn("mb-4")}>
                    <div className={cn("flex justify-between items-center mb-2")}>
                      <span className={cn("text-xs text-wl-text-secondary")}>
                        Progress
                      </span>
                      <span className={cn("text-xs font-semibold text-wl-text-primary font-mono")}>
                        {delivery.stopsCompleted} / {delivery.stopsTotal}
                      </span>
                    </div>
                    <div className={cn("w-full h-1.5 bg-wl-bg-surface rounded-full overflow-hidden")}>
                      <div
                        className={cn("h-full bg-wl-success-400")}
                        style={{
                          width: `${(delivery.stopsCompleted / delivery.stopsTotal) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* ETA and Orders */}
                  <div className={cn("grid grid-cols-2 gap-3 mb-4")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary")}>
                        ETA
                      </div>
                      <div className={cn("text-sm font-bold text-wl-text-primary mt-0.5")}>
                        {delivery.eta}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary")}>
                        Orders
                      </div>
                      <div className={cn("text-sm font-bold text-wl-text-primary mt-0.5")}>
                        {delivery.ordersInRoute}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={cn("flex gap-2")}>
                    <Button variant="secondary" size="sm" className={cn("flex-1")}>
                      <Phone className="w-4 h-4 mr-2" />
                      Contact
                    </Button>
                    <Button variant="ghost" size="sm" className={cn("flex-1")}>
                      Reassign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Completed Tab */}
        {activeTab === "completed" && (
          <div className={cn("flex flex-col gap-4")}>
            {/* Stats Row */}
            <Card>
              <CardContent>
                <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4")}>
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary")}>
                      Total Delivered
                    </div>
                    <div className={cn("text-2xl font-bold text-wl-text-primary mt-1")}>
                      {COMPLETED_DELIVERIES.length}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary")}>
                      On-Time %
                    </div>
                    <div className={cn("text-2xl font-bold text-wl-success-400 mt-1")}>
                      92%
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary")}>
                      Avg Delivery Time
                    </div>
                    <div className={cn("text-2xl font-bold text-wl-text-primary mt-1")}>
                      23m
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary")}>
                      Avg Rating
                    </div>
                    <div className={cn("text-2xl font-bold text-wl-info-400 mt-1")}>
                      4.7
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Completed Orders Table */}
            <Card>
              <CardContent>
                <Table<CompletedDelivery>
                  columns={[
                    { key: "orderNumber", header: "Order #", sortable: true, width: "120px" },
                    { key: "customer", header: "Customer", sortable: true, width: "180px" },
                    { key: "driver", header: "Driver", sortable: true, width: "150px" },
                    { key: "deliveredAt", header: "Delivered At", sortable: true, width: "120px" },
                    {
                      key: "podStatus",
                      header: "POD Status",
                      width: "120px",
                      render: (delivery) => (
                        <Badge variant={getStatusColor(delivery.podStatus)}>
                          {delivery.podStatus.charAt(0).toUpperCase() + delivery.podStatus.slice(1)}
                        </Badge>
                      ),
                    },
                    {
                      key: "rating",
                      header: "Rating",
                      align: "center" as const,
                      width: "80px",
                      render: (delivery) => (
                        <span style={{ color: delivery.rating > 0 ? "var(--wl-success-400)" : "var(--wl-text-tertiary)" }}>
                          {delivery.rating > 0 ? `⭐ ${delivery.rating}` : "—"}
                        </span>
                      ),
                    },
                  ]}
                  data={COMPLETED_DELIVERIES}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Exceptions Tab */}
        {activeTab === "exceptions" && (
          <Card>
            <CardContent>
              <Table<ExceptionDelivery>
                columns={[
                  { key: "orderNumber", header: "Order #", sortable: true, width: "120px" },
                  {
                    key: "reason",
                    header: "Reason",
                    width: "160px",
                    render: (exception) => {
                      const reasonMap: Record<ExceptionReason, string> = {
                        customer_unavailable: "Customer Unavailable",
                        wrong_address: "Wrong Address",
                        damaged: "Package Damaged",
                        refused: "Delivery Refused",
                        access_denied: "Access Denied",
                      };
                      return reasonMap[exception.reason];
                    },
                  },
                  { key: "driverNotes", header: "Driver Notes", width: "300px" },
                  {
                    key: "attempts",
                    header: "Attempts",
                    align: "center" as const,
                    width: "80px",
                    render: (exception) => (
                      <span className={cn("font-semibold font-mono")}>
                        {exception.attempts}
                      </span>
                    ),
                  },
                  { key: "lastAttempt", header: "Last Attempt", width: "120px" },
                  {
                    key: "id",
                    header: "Actions",
                    width: "140px",
                    align: "center" as const,
                    render: () => (
                      <div className={cn("flex gap-2")}>
                        <Button variant="ghost" size="sm">
                          Reschedule
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={EXCEPTIONS}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
