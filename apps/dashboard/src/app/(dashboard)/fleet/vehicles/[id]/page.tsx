'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  Truck,
  AlertTriangle,
  Fuel,
  Gauge,
  Zap,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Activity,
} from 'lucide-react';

interface VehicleDetail {
  id: string;
  fleetId: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  engineType: string;
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE';
  odometer: number;
  engineHours: number;
  fuelLevel: number;
  battery: number;
  capacity: number;
  driverId?: string;
  lastPosition?: { latitude: number; longitude: number; heading: number; speed: number; timestamp: Date };
  lastSyncAt: Date;
  nextMaintenanceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface DiagnosticEvent {
  id: string;
  faultCode: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: Date;
  resolved: boolean;
}

interface BehaviorEvent {
  id: string;
  eventType: string;
  severity: number;
  timestamp: Date;
  description: string;
  location: { latitude: number; longitude: number };
  speed: number;
}

interface MaintenanceAlert {
  id: string;
  alertType: string;
  dueDate: Date;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isCompleted: boolean;
}

export default function VehicleDetailPage() {
  const params = useParams();
  const vehicleId = params.id as string;

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEvent[]>([]);
  const [behaviors, setBehaviors] = useState<BehaviorEvent[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'behavior' | 'maintenance'>(
    'overview',
  );

  useEffect(() => {
    async function fetchVehicleDetails() {
      try {
        setLoading(true);
        // INTEGRATION: Replace with actual API calls
        const vehicleRes = await fetch(`/api/fleet/vehicles/${vehicleId}`);
        const diagnosticsRes = await fetch(`/api/fleet/vehicles/${vehicleId}/diagnostics`);
        const behaviorRes = await fetch(
          `/api/fleet/vehicles/${vehicleId}/behavior?startDate=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&endDate=${new Date().toISOString()}`,
        );
        const maintenanceRes = await fetch(`/api/fleet/vehicles/${vehicleId}/maintenance`);

        const vehicleData = await vehicleRes.json();
        const diagnosticsData = await diagnosticsRes.json();
        const behaviorData = await behaviorRes.json();
        const maintenanceData = await maintenanceRes.json();

        setVehicle(vehicleData.data);
        setDiagnostics(diagnosticsData.data?.faultCodes || []);
        setBehaviors(behaviorData.data || []);
        setMaintenance(maintenanceData.data || []);
      } catch (error) {
        console.error('Failed to fetch vehicle details:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVehicleDetails();
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900">
        <Header />
        <main className="p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border---wl-blue-500"></div>
              <p className="mt-4 text---wl-slate-400">Loading vehicle details...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900">
        <Header />
        <main className="p-8">
          <Card className="bg---wl-slate-800 border---wl-slate-700">
            <CardContent className="flex items-center justify-center h-64">
              <p className="text---wl-slate-400">Vehicle not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg---wl-green-500/10 text---wl-green-400';
      case 'IDLE':
        return 'bg---wl-yellow-500/10 text---wl-yellow-400';
      case 'OFFLINE':
        return 'bg---wl-slate-500/10 text---wl-slate-400';
      case 'MAINTENANCE':
        return 'bg---wl-orange-500/10 text---wl-orange-400';
      default:
        return '';
    }
  };

  const getStatusBadgeVariant = (
    status: string,
  ): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'IDLE':
        return 'warning';
      case 'OFFLINE':
        return 'danger';
      case 'MAINTENANCE':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getSeverityBadgeVariant = (
    severity: string | number,
  ): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
    if (typeof severity === 'number') {
      if (severity >= 4) return 'danger';
      if (severity >= 2) return 'warning';
      return 'info';
    }

    switch (severity) {
      case 'CRITICAL':
        return 'danger';
      case 'WARNING':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900">
      <Header />

      <main className="p-8">
        {/* ── BACK BUTTON & HEADER ──────────────────────────── */}

        <div className="mb-8">
          <button className="flex items-center gap-2 text---wl-blue-400 hover:text---wl-blue-300 mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Vehicles
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text---wl-slate-100">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text---wl-slate-400 mt-2">License Plate: {vehicle.licensePlate}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(vehicle.status)} className="text-lg px-4 py-1">
              {vehicle.status}
            </Badge>
          </div>
        </div>

        {/* ─── MAIN GRID ────────────────────────────────────── */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* ── VEHICLE INFO CARD ─────────────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="w-5 h-5 mr-2 text---wl-blue-500" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'VIN', value: vehicle.vin },
                { label: 'Engine Type', value: vehicle.engineType },
                { label: 'Capacity', value: `${vehicle.capacity} kg` },
                { label: 'Odometer', value: `${vehicle.odometer.toLocaleString()} km` },
                { label: 'Engine Hours', value: `${vehicle.engineHours} h` },
                { label: 'Battery', value: `${vehicle.battery}%` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border---wl-slate-700 last:border-b-0">
                  <span className="text---wl-slate-400 text-sm">{item.label}</span>
                  <span className="text---wl-slate-100 font-medium">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── REAL-TIME METRICS ────────────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text---wl-blue-500" />
                Real-Time Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fuel */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text---wl-slate-400 text-sm flex items-center gap-2">
                    <Fuel className="w-4 h-4 text---wl-blue-500" />
                    Fuel Level
                  </span>
                  <span className="text---wl-slate-100 font-medium">{vehicle.fuelLevel}%</span>
                </div>
                <div className="w-full bg---wl-slate-700 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', {
                      'bg---wl-green-500': vehicle.fuelLevel > 50,
                      'bg---wl-yellow-500': vehicle.fuelLevel > 25,
                      'bg---wl-red-500': vehicle.fuelLevel <= 25,
                    })}
                    style={{ width: `${vehicle.fuelLevel}%` }}
                  />
                </div>
              </div>

              {/* Position */}
              {vehicle.lastPosition && (
                <div className="bg---wl-slate-700 rounded-lg p-3">
                  <p className="text---wl-slate-400 text-sm flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4" />
                    Last Position
                  </p>
                  <p className="text---wl-slate-100 text-sm font-mono">
                    {vehicle.lastPosition.latitude.toFixed(4)}°, {vehicle.lastPosition.longitude.toFixed(4)}°
                  </p>
                  <p className="text---wl-slate-400 text-xs mt-1">
                    Speed: {vehicle.lastPosition.speed} km/h | Heading: {vehicle.lastPosition.heading}°
                  </p>
                </div>
              )}

              {/* Last Sync */}
              <div className="bg---wl-slate-700 rounded-lg p-3">
                <p className="text---wl-slate-400 text-sm flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  Last Sync
                </p>
                <p className="text---wl-slate-100 text-sm">
                  {new Date(vehicle.lastSyncAt).toLocaleString()}
                </p>
              </div>

              {/* Next Maintenance */}
              {vehicle.nextMaintenanceDate && (
                <div className="bg---wl-slate-700 rounded-lg p-3">
                  <p className="text---wl-slate-400 text-sm flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4" />
                    Next Maintenance
                  </p>
                  <p className="text---wl-slate-100 text-sm">
                    {new Date(vehicle.nextMaintenanceDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── HEALTH SUMMARY ────────────────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text---wl-blue-500" />
                Health Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Diagnostics */}
              <div className="bg---wl-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text---wl-slate-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Active Fault Codes
                  </p>
                  <Badge variant="warning" className="text-sm">
                    {diagnostics.length}
                  </Badge>
                </div>
                {diagnostics.length === 0 && (
                  <p className="text---wl-green-400 text-xs mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    No issues detected
                  </p>
                )}
              </div>

              {/* Driver Behavior */}
              <div className="bg---wl-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text---wl-slate-400 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent Events (7d)
                  </p>
                  <Badge variant="info" className="text-sm">
                    {behaviors.length}
                  </Badge>
                </div>
              </div>

              {/* Maintenance Alerts */}
              <div className="bg---wl-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text---wl-slate-400 text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Pending Maintenance
                  </p>
                  <Badge variant="warning" className="text-sm">
                    {maintenance.filter((m) => !m.isCompleted).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── TABBED SECTIONS ────────────────────────────────── */}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border---wl-slate-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'diagnostics', label: 'Diagnostics' },
            { id: 'behavior', label: 'Driver Behavior' },
            { id: 'maintenance', label: 'Maintenance' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'text---wl-blue-400 border---wl-blue-400'
                  : 'text---wl-slate-400 border-transparent hover:text---wl-slate-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── DIAGNOSTICS TAB ───────────────────────────── */}

        {activeTab === 'diagnostics' && (
          <Card className="bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle>Vehicle Diagnostics</CardTitle>
              <CardDescription className="text---wl-slate-400">
                Active fault codes and diagnostic information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text---wl-green-500 mb-4" />
                  <p className="text---wl-slate-400">No diagnostic issues detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnostics.map((diagnostic) => (
                    <div
                      key={diagnostic.id}
                      className="flex items-start gap-3 p-4 bg---wl-slate-700 rounded-lg border-l-4 border---wl-yellow-500"
                    >
                      <AlertCircle className="w-5 h-5 text---wl-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text---wl-slate-100">{diagnostic.faultCode}</p>
                        <p className="text-sm text---wl-slate-300 mt-1">{diagnostic.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant={getSeverityBadgeVariant(diagnostic.severity)}>
                            {diagnostic.severity}
                          </Badge>
                          <span className="text-xs text---wl-slate-400">
                            First seen: {new Date(diagnostic.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── DRIVER BEHAVIOR TAB ────────────────────────── */}

        {activeTab === 'behavior' && (
          <Card className="bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle>Driver Behavior Events</CardTitle>
              <CardDescription className="text---wl-slate-400">
                Last 7 days of driving events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {behaviors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text---wl-green-500 mb-4" />
                  <p className="text---wl-slate-400">No driving events recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {behaviors.map((behavior) => (
                    <div
                      key={behavior.id}
                      className="flex items-start gap-3 p-4 bg---wl-slate-700 rounded-lg border-l-4"
                      style={{
                        borderLeftColor:
                          behavior.severity >= 4 ? '#ef4444' : behavior.severity >= 2 ? '#eab308' : '#3b82f6',
                      }}
                    >
                      <Activity className="w-5 h-5 text---wl-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text---wl-slate-100">{behavior.eventType}</p>
                        <p className="text-sm text---wl-slate-300 mt-1">{behavior.description}</p>
                        <div className="flex gap-2 mt-2 text-xs">
                          <span className="text---wl-slate-400">
                            Speed: {behavior.speed} km/h | {new Date(behavior.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Badge variant={getSeverityBadgeVariant(behavior.severity)}>
                        {behavior.severity}/5
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── MAINTENANCE TAB ──────────────────────────── */}

        {activeTab === 'maintenance' && (
          <Card className="bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle>Maintenance Alerts</CardTitle>
              <CardDescription className="text---wl-slate-400">
                Upcoming and pending maintenance tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {maintenance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text---wl-green-500 mb-4" />
                  <p className="text---wl-slate-400">No pending maintenance</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenance.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-start justify-between p-4 bg---wl-slate-700 rounded-lg border-l-4',
                        alert.isCompleted
                          ? 'border---wl-green-500 opacity-60'
                          : alert.severity === 'CRITICAL'
                            ? 'border---wl-red-500'
                            : 'border---wl-yellow-500',
                      )}
                    >
                      <div className="flex gap-3 flex-1">
                        <Wrench className="w-5 h-5 text---wl-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text---wl-slate-100">{alert.alertType}</p>
                          <p className="text-sm text---wl-slate-400 mt-1">
                            Due: {new Date(alert.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.isCompleted
                              ? 'success'
                              : getSeverityBadgeVariant(alert.severity)
                          }
                        >
                          {alert.isCompleted ? 'Completed' : alert.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
