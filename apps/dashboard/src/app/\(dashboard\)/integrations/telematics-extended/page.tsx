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
  Truck,
  MapPin,
  Zap,
  BarChart3,
  RotateCw,
  AlertTriangle,
  Download,
  Upload,
  Eye,
  ArrowRight,
  Smartphone,
  Layers,
  TrendingUp,
  Activity,
  Shield,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   TELEMATICS EXTENDED INTEGRATION PAGE
   7 providers: Powerfleet, Azuga, Omnitracs, Platform Science,
   ClearPathGPS, One Step GPS, Titan GPS
   ═══════════════════════════════════════════════════════════ */

interface TelematicsProvider {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  vehiclesTracked: number;
  dataPoints: number;
  apiStatus: "healthy" | "degraded" | "down";
  deviceCount: number;
  monthlyData: number;
}

interface FleetVehicle {
  id: string;
  vin: string;
  licensePlate: string;
  model: string;
  status: "active" | "idle" | "offline" | "maintenance";
  location: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  fuelLevel: number;
  mileage: number;
  lastUpdate: string;
  provider: string;
}

interface Device {
  id: string;
  imei: string;
  model: string;
  status: "active" | "inactive" | "provisioning" | "error";
  vehicle?: string;
  firmwareVersion: string;
  lastUpdate: string;
  signalStrength: number;
}

interface Geofence {
  id: string;
  name: string;
  type: "polygon" | "circle";
  radius?: number;
  center?: { lat: number; lng: number };
  vertices?: Array<{ lat: number; lng: number }>;
  alertOn: "entry" | "exit" | "both";
  enabled: boolean;
  triggeredCount: number;
  lastTriggered: string;
}

interface DriverScorecard {
  id: string;
  driverId: string;
  name: string;
  provider: string;
  safetyScore: number;
  efficiencyScore: number;
  speeding: number;
  harshBraking: number;
  cornering: number;
  fuelConsumption: number;
  distance: number;
  hoursActive: number;
}

interface MaintenanceAlert {
  id: string;
  vehicleId: string;
  licensePlate: string;
  alertType: "oil-change" | "tire-rotation" | "inspection" | "battery" | "filter";
  dueDate: string;
  mileageOverdue: number;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "scheduled" | "completed" | "ignored";
}

interface MigrationTask {
  id: string;
  name: string;
  fromProvider: string;
  toProvider: string;
  vehicleCount: number;
  status: "pending" | "in-progress" | "completed" | "failed";
  progress: number;
  startDate?: string;
  completionDate?: string;
  issues: string[];
}

const PROVIDERS: TelematicsProvider[] = [
  {
    id: "powerfleet",
    name: "Powerfleet",
    logo: "🔋",
    status: "connected",
    lastSync: "2026-03-12T14:32:00Z",
    vehiclesTracked: 1240,
    dataPoints: 58934,
    apiStatus: "healthy",
    deviceCount: 1240,
    monthlyData: 2340,
  },
  {
    id: "azuga",
    name: "Azuga",
    logo: "📊",
    status: "connected",
    lastSync: "2026-03-12T14:15:00Z",
    vehiclesTracked: 892,
    dataPoints: 42156,
    apiStatus: "healthy",
    deviceCount: 892,
    monthlyData: 1678,
  },
  {
    id: "omnitracs",
    name: "Omnitracs",
    logo: "🚚",
    status: "connected",
    lastSync: "2026-03-12T13:45:00Z",
    vehiclesTracked: 1567,
    dataPoints: 74234,
    apiStatus: "degraded",
    deviceCount: 1567,
    monthlyData: 2891,
  },
  {
    id: "platform-science",
    name: "Platform Science",
    logo: "🌍",
    status: "connected",
    lastSync: "2026-03-12T14:00:00Z",
    vehiclesTracked: 734,
    dataPoints: 35678,
    apiStatus: "healthy",
    deviceCount: 734,
    monthlyData: 1423,
  },
  {
    id: "clearpath",
    name: "ClearPathGPS",
    logo: "📍",
    status: "connected",
    lastSync: "2026-03-12T13:30:00Z",
    vehiclesTracked: 456,
    dataPoints: 21890,
    apiStatus: "healthy",
    deviceCount: 456,
    monthlyData: 845,
  },
  {
    id: "onestep",
    name: "One Step GPS",
    logo: "📱",
    status: "connected",
    lastSync: "2026-03-12T14:20:00Z",
    vehiclesTracked: 623,
    dataPoints: 29456,
    apiStatus: "healthy",
    deviceCount: 623,
    monthlyData: 1134,
  },
  {
    id: "titan",
    name: "Titan GPS",
    logo: "🛰️",
    status: "disconnected",
    vehiclesTracked: 0,
    dataPoints: 0,
    apiStatus: "down",
    deviceCount: 0,
    monthlyData: 0,
  },
];

const FLEET_VEHICLES: FleetVehicle[] = [
  {
    id: "v-001",
    vin: "1HGBH41JXMN109186",
    licensePlate: "ABC-1234",
    model: "Honda Civic",
    status: "active",
    location: "Route 101, Springfield",
    latitude: 39.7817,
    longitude: -89.6501,
    speed: 45,
    heading: 180,
    fuelLevel: 75,
    mileage: 125430,
    lastUpdate: "2026-03-12T14:32:15Z",
    provider: "Powerfleet",
  },
  {
    id: "v-002",
    vin: "2T1BF1K32C1235456",
    licensePlate: "XYZ-5678",
    model: "Toyota Corolla",
    status: "idle",
    location: "Warehouse A, Springfield",
    latitude: 39.7915,
    longitude: -89.6402,
    speed: 0,
    heading: 0,
    fuelLevel: 50,
    mileage: 98765,
    lastUpdate: "2026-03-12T14:20:00Z",
    provider: "Azuga",
  },
  {
    id: "v-003",
    vin: "3G1YY528G97234567",
    licensePlate: "LMN-9012",
    model: "GMC Sierra",
    status: "active",
    location: "Downtown, Springfield",
    latitude: 39.7684,
    longitude: -89.6433,
    speed: 32,
    heading: 90,
    fuelLevel: 85,
    mileage: 156234,
    lastUpdate: "2026-03-12T14:31:42Z",
    provider: "Omnitracs",
  },
  {
    id: "v-004",
    vin: "5FNRL6H77LB234567",
    licensePlate: "QRS-3456",
    model: "Honda Pilot",
    status: "maintenance",
    location: "Service Center B, Springfield",
    latitude: 39.7550,
    longitude: -89.6520,
    speed: 0,
    heading: 0,
    fuelLevel: 30,
    mileage: 89234,
    lastUpdate: "2026-03-12T12:15:00Z",
    provider: "Platform Science",
  },
  {
    id: "v-005",
    vin: "6F1XX52K1L234567",
    licensePlate: "TUV-7890",
    model: "Ford Transit",
    status: "active",
    location: "North Loop, Springfield",
    latitude: 39.8015,
    longitude: -89.6234,
    speed: 55,
    heading: 270,
    fuelLevel: 60,
    mileage: 142567,
    lastUpdate: "2026-03-12T14:29:30Z",
    provider: "ClearPathGPS",
  },
];

const DEVICES: Device[] = [
  {
    id: "dev-001",
    imei: "864148048432523",
    model: "Powerfleet PF-3000",
    status: "active",
    vehicle: "ABC-1234",
    firmwareVersion: "3.2.1",
    lastUpdate: "2026-03-12T14:32:15Z",
    signalStrength: 92,
  },
  {
    id: "dev-002",
    imei: "864148048432524",
    model: "Azuga AZ-500",
    status: "active",
    vehicle: "XYZ-5678",
    firmwareVersion: "2.8.5",
    lastUpdate: "2026-03-12T14:20:00Z",
    signalStrength: 85,
  },
  {
    id: "dev-003",
    imei: "864148048432525",
    model: "Omnitracs One",
    status: "active",
    vehicle: "LMN-9012",
    firmwareVersion: "4.1.2",
    lastUpdate: "2026-03-12T14:31:42Z",
    signalStrength: 88,
  },
  {
    id: "dev-004",
    imei: "864148048432526",
    model: "Platform Science Drive",
    status: "provisioning",
    vehicle: undefined,
    firmwareVersion: "1.9.0",
    lastUpdate: "2026-03-12T10:00:00Z",
    signalStrength: 45,
  },
];

const GEOFENCES: Geofence[] = [
  {
    id: "gf-001",
    name: "Warehouse A",
    type: "circle",
    radius: 500,
    center: { lat: 39.7915, lng: -89.6402 },
    alertOn: "entry",
    enabled: true,
    triggeredCount: 234,
    lastTriggered: "2026-03-12T14:15:00Z",
  },
  {
    id: "gf-002",
    name: "Downtown Service Zone",
    type: "polygon",
    vertices: [
      { lat: 39.7684, lng: -89.6433 },
      { lat: 39.7750, lng: -89.6400 },
      { lat: 39.7720, lng: -89.6500 },
      { lat: 39.7650, lng: -89.6520 },
    ],
    alertOn: "exit",
    enabled: true,
    triggeredCount: 567,
    lastTriggered: "2026-03-12T13:45:00Z",
  },
  {
    id: "gf-003",
    name: "Service Center B",
    type: "circle",
    radius: 300,
    center: { lat: 39.7550, lng: -89.6520 },
    alertOn: "both",
    enabled: true,
    triggeredCount: 89,
    lastTriggered: "2026-03-12T12:30:00Z",
  },
  {
    id: "gf-004",
    name: "Restricted Zone",
    type: "polygon",
    vertices: [
      { lat: 39.8015, lng: -89.6234 },
      { lat: 39.8100, lng: -89.6200 },
      { lat: 39.8050, lng: -89.6350 },
    ],
    alertOn: "entry",
    enabled: false,
    triggeredCount: 0,
    lastTriggered: "—",
  },
];

const DRIVER_SCORECARDS: DriverScorecard[] = [
  {
    id: "ds-001",
    driverId: "D-001",
    name: "John Smith",
    provider: "Powerfleet",
    safetyScore: 94,
    efficiencyScore: 87,
    speeding: 2,
    harshBraking: 1,
    cornering: 0,
    fuelConsumption: 8.2,
    distance: 2341,
    hoursActive: 156,
  },
  {
    id: "ds-002",
    driverId: "D-002",
    name: "Sarah Johnson",
    provider: "Azuga",
    safetyScore: 89,
    efficiencyScore: 92,
    speeding: 5,
    harshBraking: 3,
    cornering: 1,
    fuelConsumption: 7.9,
    distance: 2156,
    hoursActive: 142,
  },
  {
    id: "ds-003",
    driverId: "D-003",
    name: "Michael Chen",
    provider: "Omnitracs",
    safetyScore: 96,
    efficiencyScore: 94,
    speeding: 0,
    harshBraking: 0,
    cornering: 0,
    fuelConsumption: 8.5,
    distance: 2567,
    hoursActive: 168,
  },
  {
    id: "ds-004",
    driverId: "D-004",
    name: "Emily Rodriguez",
    provider: "Platform Science",
    safetyScore: 82,
    efficiencyScore: 78,
    speeding: 12,
    harshBraking: 8,
    cornering: 3,
    fuelConsumption: 7.2,
    distance: 1834,
    hoursActive: 128,
  },
];

const MAINTENANCE_ALERTS: MaintenanceAlert[] = [
  {
    id: "ma-001",
    vehicleId: "v-001",
    licensePlate: "ABC-1234",
    alertType: "oil-change",
    dueDate: "2026-03-15T00:00:00Z",
    mileageOverdue: 500,
    priority: "high",
    status: "open",
  },
  {
    id: "ma-002",
    vehicleId: "v-003",
    licensePlate: "LMN-9012",
    alertType: "tire-rotation",
    dueDate: "2026-03-20T00:00:00Z",
    mileageOverdue: 250,
    priority: "medium",
    status: "scheduled",
  },
  {
    id: "ma-003",
    vehicleId: "v-005",
    licensePlate: "TUV-7890",
    alertType: "inspection",
    dueDate: "2026-04-01T00:00:00Z",
    mileageOverdue: 0,
    priority: "low",
    status: "open",
  },
  {
    id: "ma-004",
    vehicleId: "v-002",
    licensePlate: "XYZ-5678",
    alertType: "battery",
    dueDate: "2026-03-10T00:00:00Z",
    mileageOverdue: 1200,
    priority: "critical",
    status: "open",
  },
];

const MIGRATION_TASKS: MigrationTask[] = [
  {
    id: "mig-001",
    name: "Powerfleet to Omnitracs",
    fromProvider: "Powerfleet",
    toProvider: "Omnitracs",
    vehicleCount: 156,
    status: "completed",
    progress: 100,
    completionDate: "2026-03-10T00:00:00Z",
    issues: [],
  },
  {
    id: "mig-002",
    name: "Azuga to Platform Science",
    fromProvider: "Azuga",
    toProvider: "Platform Science",
    vehicleCount: 89,
    status: "in-progress",
    progress: 67,
    startDate: "2026-03-08T00:00:00Z",
    issues: ["3 devices require firmware update"],
  },
  {
    id: "mig-003",
    name: "ClearPathGPS to Powerfleet",
    fromProvider: "ClearPathGPS",
    toProvider: "Powerfleet",
    vehicleCount: 45,
    status: "pending",
    progress: 0,
    issues: [],
  },
];

interface TabState {
  tab: "providers" | "fleet-map" | "devices" | "geofences" | "driver-scorecard" | "maintenance" | "reporting" | "migration";
}

const getStatusColor = (status: string): "success" | "danger" | "warning" | "default" => {
  switch (status) {
    case "connected":
    case "active":
    case "healthy":
    case "completed":
    case "entry":
      return "success";
    case "error":
    case "offline":
    case "down":
    case "critical":
    case "failed":
      return "danger";
    case "disconnected":
    case "idle":
    case "provisioning":
    case "degraded":
    case "maintenance":
    case "pending":
    case "in-progress":
      return "warning";
    default:
      return "default";
  }
};

const formatDateTime = (isoStr: string): string => {
  if (!isoStr || isoStr === "—") return "—";
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

export default function TelematicsExtendedIntegrationPage() {
  const [tabState, setTabState] = useState<TabState>({ tab: "providers" });
  const [selectedProvider, setSelectedProvider] = useState<string>("powerfleet");
  const [geofenceExpanded, setGeofenceExpanded] = useState<string | null>(null);
  const [maintenanceFilter, setMaintenanceFilter] = useState<"all" | "open" | "scheduled" | "critical">("all");

  // Calculate statistics
  const connectedProviders = PROVIDERS.filter((p) => p.status === "connected").length;
  const totalVehicles = PROVIDERS.reduce((sum, p) => sum + p.vehiclesTracked, 0);
  const activeVehicles = FLEET_VEHICLES.filter((v) => v.status === "active").length;
  const totalDevices = PROVIDERS.reduce((sum, p) => sum + p.deviceCount, 0);
  const activeDevices = DEVICES.filter((d) => d.status === "active").length;
  const totalDataPoints = PROVIDERS.reduce((sum, p) => sum + p.dataPoints, 0);
  const criticalAlerts = MAINTENANCE_ALERTS.filter((a) => a.priority === "critical").length;

  const filteredMaintenance = useMemo(
    () =>
      MAINTENANCE_ALERTS.filter((alert) => {
        if (maintenanceFilter === "all") return true;
        if (maintenanceFilter === "critical") return alert.priority === "critical";
        return alert.status === maintenanceFilter;
      }),
    [maintenanceFilter]
  );

  return (
    <>
      <Header
        title="Telematics Extended"
        subtitle={`${connectedProviders} providers connected · ${formatNumber(totalVehicles)} vehicles tracked`}
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
            { id: "fleet-map", label: "Fleet Map" },
            { id: "devices", label: "Devices" },
            { id: "geofences", label: "Geofences" },
            { id: "driver-scorecard", label: "Driver Scorecard" },
            { id: "maintenance", label: "Maintenance" },
            { id: "reporting", label: "Reporting" },
            { id: "migration", label: "Migration" },
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
              <StatCard label="Total Vehicles" value={formatNumber(totalVehicles)} trend="up" />
              <StatCard label="Active Vehicles" value={activeVehicles.toString()} trend="up" />
              <StatCard label="Data Points" value={formatNumber(totalDataPoints)} trend="up" />
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
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Vehicles</p>
                      <p className="text-2xl font-bold">{provider.vehiclesTracked}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Data Points</p>
                      <p className="text-2xl font-bold">{formatNumber(provider.dataPoints)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Devices</p>
                      <p className="text-2xl font-bold">{provider.deviceCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">API Status</p>
                      <Badge variant={getStatusColor(provider.apiStatus)}>{provider.apiStatus}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* FLEET MAP TAB */}
        {tabState.tab === "fleet-map" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Unified Fleet Map - Multi-Provider Overlay</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Real-time vehicle positions from all providers</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-slate-100 dark:bg-slate-800 rounded aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600 dark:text-slate-400">Interactive Map View (REST API Integration)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                      {formatNumber(FLEET_VEHICLES.length)} vehicles · Real-time locations
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Active Vehicles</h3>
                    <div className="space-y-2">
                      {FLEET_VEHICLES.filter((v) => v.status === "active").map((vehicle) => (
                        <div key={vehicle.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{vehicle.licensePlate}</p>
                            <Badge variant="success" className="text-xs">
                              {vehicle.speed} mph
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{vehicle.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Vehicle Status Distribution</h3>
                    <div className="space-y-2">
                      {[
                        { status: "active", count: FLEET_VEHICLES.filter((v) => v.status === "active").length },
                        { status: "idle", count: FLEET_VEHICLES.filter((v) => v.status === "idle").length },
                        { status: "maintenance", count: FLEET_VEHICLES.filter((v) => v.status === "maintenance").length },
                        { status: "offline", count: FLEET_VEHICLES.filter((v) => v.status === "offline").length },
                      ].map((item) => (
                        <div key={item.status} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{item.status}</span>
                          <Badge variant={getStatusColor(item.status)}>{item.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Export Map Data
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Layers className="w-4 h-4" />
                    Configure Layers
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* DEVICES TAB */}
        {tabState.tab === "devices" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Devices" value={formatNumber(totalDevices)} trend="up" />
              <StatCard label="Active" value={activeDevices.toString()} trend="up" />
              <StatCard label="Provisioning" value={DEVICES.filter((d) => d.status === "provisioning").length.toString()} trend="warning" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Device Provisioning & Activation</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Manage telematics hardware devices</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">IMEI</th>
                        <th className="text-left py-3 px-4 font-semibold">Model</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 font-semibold">Vehicle</th>
                        <th className="text-left py-3 px-4 font-semibold">Signal</th>
                        <th className="text-left py-3 px-4 font-semibold">Firmware</th>
                        <th className="text-left py-3 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEVICES.map((device) => (
                        <tr key={device.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-mono text-xs">{device.imei}</td>
                          <td className="py-3 px-4">{device.model}</td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusColor(device.status)}>{device.status}</Badge>
                          </td>
                          <td className="py-3 px-4">{device.vehicle || "—"}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-600" />
                              <span>{device.signalStrength}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{device.firmwareVersion}</td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4" />
                    Provision Device
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Upload className="w-4 h-4" />
                    Bulk Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* GEOFENCES TAB */}
        {tabState.tab === "geofences" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Geofence Management</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Create, import, bulk operations</p>
                </div>
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" />
                  New Geofence
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {GEOFENCES.map((geofence) => (
                  <Card key={geofence.id} className="border-l-4 border-l-blue-500">
                    <CardHeader
                      className="pb-3 cursor-pointer"
                      onClick={() => setGeofenceExpanded(geofenceExpanded === geofence.id ? null : geofence.id)}
                    >
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <span>{geofence.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={geofence.enabled ? "success" : "default"}>
                            {geofence.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <ChevronRight className={cn("w-4 h-4 transition", geofenceExpanded === geofence.id && "rotate-90")} />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    {geofenceExpanded === geofence.id && (
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Type</p>
                            <p className="font-medium capitalize">{geofence.type}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Alert On</p>
                            <p className="font-medium capitalize">{geofence.alertOn}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Triggered</p>
                            <p className="font-medium">{geofence.triggeredCount}x</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm">
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                            View Map
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                <Upload className="w-4 h-4" />
                Import Geofences
              </Button>
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        )}

        {/* DRIVER SCORECARD TAB */}
        {tabState.tab === "driver-scorecard" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Driver Scorecard Comparison</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Safety & efficiency metrics across providers</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DRIVER_SCORECARDS.map((scorecard) => (
                    <div key={scorecard.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium">{scorecard.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{scorecard.provider} • {scorecard.driverId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{scorecard.safetyScore}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Safety Score</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Speeding</p>
                            <p className="font-bold">{scorecard.speeding}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-red-600" />
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Harsh Braking</p>
                            <p className="font-bold">{scorecard.harshBraking}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Efficiency</p>
                            <p className="font-bold">{scorecard.efficiencyScore}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-orange-600" />
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Fuel</p>
                            <p className="font-bold">{scorecard.fuelConsumption} MPG</p>
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${scorecard.safetyScore}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {tabState.tab === "maintenance" && (
          <div className="space-y-6">
            <StatCard label="Critical Alerts" value={criticalAlerts.toString()} trend="down" />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Maintenance Alert Configuration</CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Predictive maintenance scheduling</p>
                </div>
                <select
                  value={maintenanceFilter}
                  onChange={(e) => setMaintenanceFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                >
                  <option value="all">All Alerts</option>
                  <option value="critical">Critical</option>
                  <option value="open">Open</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredMaintenance.map((alert) => (
                    <div key={alert.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{alert.licensePlate}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">{alert.alertType.replace("-", " ")}</p>
                        </div>
                        <Badge variant={getStatusColor(alert.priority)}>{alert.priority}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Due Date</p>
                          <p className="font-mono">{new Date(alert.dueDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">Status</p>
                          <Badge variant={getStatusColor(alert.status)}>{alert.status}</Badge>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button variant="secondary" size="sm">
                            <Settings className="w-4 h-4" />
                            Schedule
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

        {/* REPORTING TAB */}
        {tabState.tab === "reporting" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Export & Reporting Settings</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Configure automated reports and data exports</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Available Reports
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Fleet Utilization
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Driver Performance
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Fuel Consumption
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Maintenance History
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Geofence Violations
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Export Frequencies
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Real-time Sync
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Hourly Snapshots
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Daily Reports
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Weekly Summaries
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Monthly Analytics
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    <Download className="w-4 h-4" />
                    Generate Report
                  </Button>
                  <Button variant="secondary" size="sm">
                    <Settings className="w-4 h-4" />
                    Schedule Reports
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MIGRATION TAB */}
        {tabState.tab === "migration" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Provider Migration Assistant</CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400">Safely migrate vehicles between telematics providers</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {MIGRATION_TASKS.map((task) => (
                  <div key={task.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <p className="font-medium">{task.name}</p>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                          <span>{task.fromProvider}</span>
                          <ArrowRight className="w-4 h-4" />
                          <span>{task.toProvider}</span>
                          <span className="ml-2">• {task.vehicleCount} vehicles</span>
                        </div>
                      </div>
                      <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Progress</p>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{task.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>

                    {task.issues.length > 0 && (
                      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Issues
                        </p>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 ml-6">
                          {task.issues.map((issue, idx) => (
                            <li key={idx} className="list-disc">{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" disabled={task.status === "completed"}>
                        {task.status === "pending" && "Start Migration"}
                        {task.status === "in-progress" && "Continue"}
                        {task.status === "completed" && "Completed"}
                        {task.status === "failed" && "Retry"}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
