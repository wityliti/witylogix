"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  MapPin,
  Wrench,
  Package,
  DollarSign,
  Calendar,
  MessageSquare,
  RotateCw,
  Smartphone,
  Trash2,
  Eye,
  Download,
  Upload,
  Edit,
  Copy,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   FIELD SERVICE PROVIDER INTEGRATION PAGE
   ServiceTitan · Jobber · Housecall Pro · FieldEdge
   ═══════════════════════════════════════════════════════════ */

interface FieldServiceProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSync?: string;
  techniciansSynced: number;
  jobsSynced: number;
  customersCount: number;
  monthlyRevenue: number;
  errorMessage?: string;
}

interface TechnicianDispatch {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: "available" | "on-job" | "break" | "offline";
  currentLocation: string;
  completedToday: number;
  avgRating: number;
  certifications: string[];
  nextAvailable: string;
}

interface WorkOrder {
  id: string;
  customerName: string;
  address: string;
  serviceType: string;
  status: "pending" | "scheduled" | "in-progress" | "completed" | "cancelled";
  scheduledDate: string;
  estimatedDuration: number;
  assignedTech: string;
  revenue: number;
  notes: string;
}

interface ServiceTerritory {
  id: string;
  name: string;
  zipCodes: string[];
  technicianCount: number;
  jobsPerMonth: number;
  avgResponseTime: number;
  coverage: number;
}

interface CommunicationTemplate {
  id: string;
  name: string;
  type: "appointment-reminder" | "eta-update" | "completion-notification" | "cancellation";
  content: string;
  enabled: boolean;
  triggerTime: string;
}

interface EquipmentInventory {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantityOnHand: number;
  quantityMinimum: number;
  unitCost: number;
  lastUpdated: string;
}

interface RevenueByService {
  serviceType: string;
  count: number;
  totalRevenue: number;
  avgPrice: number;
  margin: number;
}

const PROVIDERS: FieldServiceProvider[] = [
  {
    id: "servicetitan",
    name: "ServiceTitan",
    logo: "🔧",
    status: "connected",
    lastSync: "2026-03-12T14:32:00Z",
    techniciansSynced: 245,
    jobsSynced: 8934,
    customersCount: 12456,
    monthlyRevenue: 456789,
  },
  {
    id: "jobber",
    name: "Jobber",
    logo: "📋",
    status: "connected",
    lastSync: "2026-03-12T14:15:00Z",
    techniciansSynced: 178,
    jobsSynced: 6234,
    customersCount: 8932,
    monthlyRevenue: 325612,
  },
  {
    id: "housecall",
    name: "Housecall Pro",
    logo: "🏠",
    status: "connected",
    lastSync: "2026-03-12T13:45:00Z",
    techniciansSynced: 156,
    jobsSynced: 5123,
    customersCount: 7645,
    monthlyRevenue: 287453,
  },
  {
    id: "fieldedge",
    name: "FieldEdge",
    logo: "📱",
    status: "disconnected",
    techniciansSynced: 0,
    jobsSynced: 0,
    customersCount: 0,
    monthlyRevenue: 0,
  },
];

const TECHNICIANS: TechnicianDispatch[] = [
  {
    id: "tech-001",
    name: "John Smith",
    phone: "555-0101",
    email: "john.smith@contractor.com",
    status: "on-job",
    currentLocation: "123 Main St, Springfield",
    completedToday: 3,
    avgRating: 4.8,
    certifications: ["HVAC", "Plumbing", "Electrical"],
    nextAvailable: "2026-03-12T16:00:00Z",
  },
  {
    id: "tech-002",
    name: "Sarah Johnson",
    phone: "555-0102",
    email: "sarah.johnson@contractor.com",
    status: "available",
    currentLocation: "456 Oak Ave, Springfield",
    completedToday: 2,
    avgRating: 4.9,
    certifications: ["HVAC", "Appliance Repair"],
    nextAvailable: "2026-03-12T14:45:00Z",
  },
  {
    id: "tech-003",
    name: "Michael Chen",
    phone: "555-0103",
    email: "michael.chen@contractor.com",
    status: "break",
    currentLocation: "789 Elm St, Springfield",
    completedToday: 4,
    avgRating: 4.7,
    certifications: ["Electrical", "Solar"],
    nextAvailable: "2026-03-12T15:30:00Z",
  },
  {
    id: "tech-004",
    name: "Emily Rodriguez",
    phone: "555-0104",
    email: "emily.rodriguez@contractor.com",
    status: "on-job",
    currentLocation: "321 Pine Rd, Springfield",
    completedToday: 2,
    avgRating: 4.6,
    certifications: ["Plumbing", "Gas Fitting"],
    nextAvailable: "2026-03-12T17:30:00Z",
  },
  {
    id: "tech-005",
    name: "David Wilson",
    phone: "555-0105",
    email: "david.wilson@contractor.com",
    status: "available",
    currentLocation: "654 Cedar Ln, Springfield",
    completedToday: 1,
    avgRating: 4.5,
    certifications: ["HVAC", "Refrigeration"],
    nextAvailable: "2026-03-12T15:00:00Z",
  },
];

const WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-001",
    customerName: "Robert Thompson",
    address: "123 Main St, Springfield",
    serviceType: "HVAC Repair",
    status: "in-progress",
    scheduledDate: "2026-03-12T10:00:00Z",
    estimatedDuration: 2.5,
    assignedTech: "John Smith",
    revenue: 450,
    notes: "AC compressor making noise",
  },
  {
    id: "wo-002",
    customerName: "Patricia Lee",
    address: "456 Oak Ave, Springfield",
    serviceType: "Plumbing Installation",
    status: "scheduled",
    scheduledDate: "2026-03-12T14:00:00Z",
    estimatedDuration: 4,
    assignedTech: "Sarah Johnson",
    revenue: 1200,
    notes: "Water heater replacement + bathroom fixtures",
  },
  {
    id: "wo-003",
    customerName: "James Martin",
    address: "789 Elm St, Springfield",
    serviceType: "Electrical Inspection",
    status: "completed",
    scheduledDate: "2026-03-12T09:00:00Z",
    estimatedDuration: 1.5,
    assignedTech: "Michael Chen",
    revenue: 350,
    notes: "Safety inspection - passed with recommendations",
  },
  {
    id: "wo-004",
    customerName: "Linda Anderson",
    address: "321 Pine Rd, Springfield",
    serviceType: "Appliance Repair",
    status: "pending",
    scheduledDate: "2026-03-13T10:00:00Z",
    estimatedDuration: 1.5,
    assignedTech: "Unassigned",
    revenue: 250,
    notes: "Refrigerator repair - not cooling",
  },
];

const SERVICE_TERRITORIES: ServiceTerritory[] = [
  {
    id: "st-001",
    name: "North Zone",
    zipCodes: ["62701", "62702", "62703"],
    technicianCount: 25,
    jobsPerMonth: 456,
    avgResponseTime: 45,
    coverage: 98,
  },
  {
    id: "st-002",
    name: "South Zone",
    zipCodes: ["62704", "62705", "62706"],
    technicianCount: 18,
    jobsPerMonth: 312,
    avgResponseTime: 52,
    coverage: 96,
  },
  {
    id: "st-003",
    name: "East Zone",
    zipCodes: ["62707", "62708", "62709"],
    technicianCount: 22,
    jobsPerMonth: 389,
    avgResponseTime: 48,
    coverage: 97,
  },
  {
    id: "st-004",
    name: "West Zone",
    zipCodes: ["62710", "62711", "62712"],
    technicianCount: 15,
    jobsPerMonth: 234,
    avgResponseTime: 60,
    coverage: 92,
  },
];

const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    id: "ct-001",
    name: "Appointment Reminder",
    type: "appointment-reminder",
    content: "Hi {customer_name}, your appointment is scheduled for {date} at {time}. Please confirm your availability.",
    enabled: true,
    triggerTime: "24h-before",
  },
  {
    id: "ct-002",
    name: "ETA Update",
    type: "eta-update",
    content: "Hi {customer_name}, our technician {tech_name} is on the way. ETA: {eta}",
    enabled: true,
    triggerTime: "30m-before-arrival",
  },
  {
    id: "ct-003",
    name: "Work Completion",
    type: "completion-notification",
    content: "Hi {customer_name}, your service has been completed. Please rate your experience.",
    enabled: true,
    triggerTime: "immediately",
  },
  {
    id: "ct-004",
    name: "Cancellation Notice",
    type: "cancellation",
    content: "Hi {customer_name}, your appointment on {date} has been cancelled. We'll reschedule shortly.",
    enabled: false,
    triggerTime: "immediately",
  },
];

const EQUIPMENT: EquipmentInventory[] = [
  {
    id: "eq-001",
    name: "HVAC Compressor Unit",
    sku: "HVAC-COMP-001",
    category: "HVAC",
    quantityOnHand: 12,
    quantityMinimum: 5,
    unitCost: 450,
    lastUpdated: "2026-03-12T10:00:00Z",
  },
  {
    id: "eq-002",
    name: "Water Heater 50gal",
    sku: "WH-50-001",
    category: "Plumbing",
    quantityOnHand: 8,
    quantityMinimum: 3,
    unitCost: 650,
    lastUpdated: "2026-03-12T09:30:00Z",
  },
  {
    id: "eq-003",
    name: "Circuit Breaker Panel 200A",
    sku: "CB-200A-001",
    category: "Electrical",
    quantityOnHand: 2,
    quantityMinimum: 3,
    unitCost: 850,
    lastUpdated: "2026-03-11T14:00:00Z",
  },
  {
    id: "eq-004",
    name: "Refrigerant R410A",
    sku: "REFR-R410A",
    category: "HVAC",
    quantityOnHand: 45,
    quantityMinimum: 20,
    unitCost: 85,
    lastUpdated: "2026-03-12T11:00:00Z",
  },
  {
    id: "eq-005",
    name: "PVC Pipe 2in",
    sku: "PIPE-PVC-2",
    category: "Plumbing",
    quantityOnHand: 156,
    quantityMinimum: 50,
    unitCost: 12,
    lastUpdated: "2026-03-12T08:45:00Z",
  },
];

const REVENUE_BY_SERVICE: RevenueByService[] = [
  {
    serviceType: "HVAC Repair",
    count: 342,
    totalRevenue: 128450,
    avgPrice: 375,
    margin: 48,
  },
  {
    serviceType: "Plumbing",
    count: 287,
    totalRevenue: 156234,
    avgPrice: 545,
    margin: 52,
  },
  {
    serviceType: "Electrical",
    count: 198,
    totalRevenue: 98765,
    avgPrice: 500,
    margin: 45,
  },
  {
    serviceType: "Appliance Repair",
    count: 156,
    totalRevenue: 52340,
    avgPrice: 335,
    margin: 42,
  },
];

interface TabState {
  tab: "providers" | "dispatch" | "work-orders" | "territories" | "communication" | "inventory" | "revenue" | "mobile";
}

const getStatusColor = (status: string): "success" | "danger" | "warning" | "default" => {
  switch (status) {
    case "connected":
    case "available":
    case "completed":
    case "on-time":
      return "success";
    case "error":
    case "offline":
    case "cancelled":
      return "danger";
    case "disconnected":
    case "on-job":
    case "pending":
    case "break":
    case "scheduled":
      return "warning";
    default:
      return "default";
  }
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr) return "—";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

export default function FieldServiceIntegrationPage() {
  const [tabState, setTabState] = useState<TabState>({ tab: "providers" });
  const [selectedProvider, setSelectedProvider] = useState<string>("servicetitan");
  const [technicianFilter, setTechnicianFilter] = useState<"all" | "available" | "on-job" | "break">("all");
  const [workOrderFilter, setWorkOrderFilter] = useState<"all" | "pending" | "scheduled" | "in-progress" | "completed">("all");
  const [templateExpanded, setTemplateExpanded] = useState<string | null>(null);

  // Calculate statistics
  const connectedProviders = PROVIDERS.filter((p) => p.status === "connected").length;
  const totalTechs = PROVIDERS.reduce((sum, p) => sum + p.techniciansSynced, 0);
  const totalJobs = PROVIDERS.reduce((sum, p) => sum + p.jobsSynced, 0);
  const totalRevenue = PROVIDERS.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const availableTechs = TECHNICIANS.filter((t) => t.status === "available").length;
  const activeTerritories = SERVICE_TERRITORIES.filter((t) => t.coverage >= 90).length;
  const lowStockItems = EQUIPMENT.filter((e) => e.quantityOnHand <= e.quantityMinimum).length;
  const totalServiceRevenue = REVENUE_BY_SERVICE.reduce((sum, s) => sum + s.totalRevenue, 0);

  const filteredTechs = useMemo(
    () =>
      TECHNICIANS.filter((tech) => {
        if (technicianFilter !== "all" && tech.status !== technicianFilter) return false;
        return true;
      }),
    [technicianFilter]
  );

  const filteredWorkOrders = useMemo(
    () =>
      WORK_ORDERS.filter((order) => {
        if (workOrderFilter !== "all" && order.status !== workOrderFilter) return false;
        return true;
      }),
    [workOrderFilter]
  );

  return (
    <>
      <Header
        title="Field Service Integration"
        subtitle={`${connectedProviders} providers · ${totalTechs} technicians`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 mb-8 sticky top-0 z-10">
        <div className="px-6 flex items-center gap-8 overflow-x-auto">
          {[
            { id: "providers", label: "Providers" },
            { id: "dispatch", label: "Technician Dispatch" },
            { id: "work-orders", label: "Work Orders" },
            { id: "territories", label: "Service Territories" },
            { id: "communication", label: "Communication" },
            { id: "inventory", label: "Inventory" },
            { id: "revenue", label: "Revenue" },
            { id: "mobile", label: "Mobile Apps" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabState({ tab: t.id as TabState["tab"] })}
              className={cn(
                "px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tabState.tab === t.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* PROVIDERS TAB */}
        {tabState.tab === "providers" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Connected Providers" value={connectedProviders.toString()} trend="up" />
              <StatCard label="Total Technicians" value={formatNumber(totalTechs)} trend="up" />
              <StatCard label="Jobs (YTD)" value={formatNumber(totalJobs)} trend="up" />
              <StatCard label="Monthly Revenue" value={formatCurrency(totalRevenue)} trend="up" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {PROVIDERS.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{provider.logo}</div>
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <Badge variant={getStatusColor(provider.status)}>● {provider.status}</Badge>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm">
                        <RotateCw className="w-4 h-4" />
                        Sync
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Technicians</p>
                      <p className="text-2xl font-bold">{provider.techniciansSynced}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Jobs</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.jobsSynced)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Customers</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.customersCount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Monthly Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(provider.monthlyRevenue)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TECHNICIAN DISPATCH TAB */}
        {tabState.tab === "dispatch" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Technicians" value={TECHNICIANS.length.toString()} trend="up" />
              <StatCard label="Available Now" value={availableTechs.toString()} trend="up" />
              <StatCard label="Avg Rating" value="4.7" trend="stable" />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Technician Dispatch Board</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Availability calendar & scheduling</p>
                </div>
                <select
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Technicians</option>
                  <option value="available">Available</option>
                  <option value="on-job">On Job</option>
                  <option value="break">Break</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTechs.map((tech) => (
                    <div key={tech.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-slate-400" />
                          <div className="flex-1">
                            <p className="font-medium">{tech.name}</p>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {tech.email} • {tech.phone}
                            </div>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(tech.status)}>
                          {tech.status === "available" && "✓"} {tech.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Location</p>
                          <p className="font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {tech.currentLocation}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Completed</p>
                          <p className="text-lg font-bold">{tech.completedToday}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Rating</p>
                          <p className="text-lg font-bold">⭐ {tech.avgRating}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Certifications</p>
                          <p className="text-xs font-medium">{tech.certifications.join(", ")}</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button variant="secondary" size="sm">
                            <Calendar className="w-4 h-4" />
                            Schedule
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* WORK ORDERS TAB */}
        {tabState.tab === "work-orders" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Work Order Sync Configuration</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Job/service order management</p>
                </div>
                <select
                  value={workOrderFilter}
                  onChange={(e) => setWorkOrderFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredWorkOrders.map((order) => (
                    <div key={order.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-medium">{order.customerName}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {order.address}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Service</p>
                          <p className="font-medium">{order.serviceType}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Scheduled</p>
                          <p className="font-mono">{new Date(order.scheduledDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Duration</p>
                          <p className="font-medium">{order.estimatedDuration}h</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Technician</p>
                          <p className="font-medium">{order.assignedTech}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Revenue</p>
                          <p className="text-lg font-bold">{formatCurrency(order.revenue)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button variant="secondary" size="sm">
                          <Eye className="w-4 h-4" />
                          Details
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SERVICE TERRITORIES TAB */}
        {tabState.tab === "territories" && (
          <div className="space-y-6">
            <StatCard label="Active Territories" value={activeTerritories.toString()} trend="up" />

            <Card>
              <CardHeader>
                <CardTitle>Service Territory Mapping</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Coverage areas and technician allocation</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {SERVICE_TERRITORIES.map((territory) => (
                    <div key={territory.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <p className="font-medium">{territory.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{territory.zipCodes.join(", ")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{territory.coverage}%</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Coverage</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Technicians</p>
                          <p className="text-lg font-bold">{territory.technicianCount}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Jobs/Month</p>
                          <p className="text-lg font-bold">{territory.jobsPerMonth}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Avg Response</p>
                          <p className="text-lg font-bold">{territory.avgResponseTime}m</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button variant="secondary" size="sm" className="flex-1">
                            <Settings className="w-4 h-4" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* COMMUNICATION TEMPLATES TAB */}
        {tabState.tab === "communication" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Customer Communication Templates</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Appointment reminders, ETAs, notifications</p>
                </div>
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" />
                  New Template
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {COMMUNICATION_TEMPLATES.map((template) => (
                    <Card key={template.id} className="border-l-4 border-l-blue-500">
                      <CardHeader
                        className="pb-3 cursor-pointer"
                        onClick={() => setTemplateExpanded(templateExpanded === template.id ? null : template.id)}
                      >
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{template.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={template.enabled ? "success" : "default"}>
                              {template.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            <ChevronRight className={cn("w-4 h-4 transition", templateExpanded === template.id && "rotate-90")} />
                          </div>
                        </CardTitle>
                      </CardHeader>
                      {templateExpanded === template.id && (
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Message Content</p>
                            <p className="p-3 bg-slate-100 dark:bg-slate-800 rounded font-mono text-sm">{template.content}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Type</p>
                              <p className="font-medium">{template.type.replace("-", " ")}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Trigger</p>
                              <p className="font-medium">{template.triggerTime}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm">
                              <Edit className="w-4 h-4" />
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </Button>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* INVENTORY TAB */}
        {tabState.tab === "inventory" && (
          <div className="space-y-6">
            <StatCard label="Low Stock Items" value={lowStockItems.toString()} trend="down" />

            <Card>
              <CardHeader>
                <CardTitle>Equipment & Parts Inventory</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Sync with technician equipment tracking</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">Name</th>
                        <th className="text-left py-3 px-4 font-semibold">SKU</th>
                        <th className="text-left py-3 px-4 font-semibold">Category</th>
                        <th className="text-left py-3 px-4 font-semibold">On Hand</th>
                        <th className="text-left py-3 px-4 font-semibold">Unit Cost</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EQUIPMENT.map((item) => {
                        const lowStock = item.quantityOnHand <= item.quantityMinimum;
                        return (
                          <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-medium">{item.name}</td>
                            <td className="py-3 px-4 font-mono text-xs">{item.sku}</td>
                            <td className="py-3 px-4">{item.category}</td>
                            <td className="py-3 px-4">
                              <span className={cn(lowStock && "text-red-600 dark:text-red-400 font-bold")}>{item.quantityOnHand}</span>
                            </td>
                            <td className="py-3 px-4">{formatCurrency(item.unitCost)}</td>
                            <td className="py-3 px-4">
                              <Badge variant={lowStock ? "warning" : "success"}>{lowStock ? "Low Stock" : "In Stock"}</Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4" />
                    Import Inventory
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* REVENUE TAB */}
        {tabState.tab === "revenue" && (
          <div className="space-y-6">
            <StatCard label="Total Revenue" value={formatCurrency(totalServiceRevenue)} trend="up" />

            <Card>
              <CardHeader>
                <CardTitle>Revenue Tracking by Service Type</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Breakdown and profitability analysis</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {REVENUE_BY_SERVICE.map((service) => (
                    <div key={service.serviceType} className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{service.serviceType}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{service.count} jobs</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(service.totalRevenue)}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatCurrency(service.avgPrice)}/job
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded">
                            <div className="h-full bg-green-500 rounded" style={{ width: `${service.margin}%` }} />
                          </div>
                          <span className="font-medium">{service.margin}% Margin</span>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Avg Price</p>
                          <p className="font-bold">{formatCurrency(service.avgPrice)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MOBILE APPS TAB */}
        {tabState.tab === "mobile" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Mobile App Integration Settings
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Technician field apps & real-time sync</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                    <h3 className="font-semibold mb-4">Offline Capabilities</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Work order download</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Signature capture</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Photo documentation</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Auto-sync when online</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                    <h3 className="font-semibold mb-4">Real-time Features</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>GPS tracking</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Push notifications</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Real-time dispatch</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Customer communication</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 p-4 rounded">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Mobile app integration requires technicians to have the latest version installed. Check app store
                    releases for feature updates.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Test App Connection
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Settings className="w-4 h-4" />
                    Configure Sync
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
