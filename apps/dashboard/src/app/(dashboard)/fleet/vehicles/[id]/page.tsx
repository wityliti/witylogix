'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { ChevronLeft, Truck, AlertTriangle, Fuel, Zap, MapPin, Clock, AlertCircle, CheckCircle2, Wrench, Activity } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';

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

export default function VehicleDetailPage() {
  const params = useParams();
  const vehicleId = params.id as string;
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'behavior' | 'maintenance'>('overview');

  const { data: vehicle, loading, error, refetch } = useApiQuery<VehicleDetail>(`/api/v4/fleet/${vehicleId}`);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (!vehicle) {
    return (
      <>
        <Header title="Vehicle Not Found" />
        <main className="p-8">
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-wl-slate-400">Vehicle not found</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
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

  const diagnostics: unknown[] = [];
  const behaviors: unknown[] = [];
  const maintenance: unknown[] = [];

  return (
    <>
      <Header title="Vehicle Details" />
      <main className="min-h-screen bg-[#0a0a0f] p-8">
        {/* ── BACK BUTTON & HEADER ──────────────────────────── */}
        <div className="mb-8">
          <button className="flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Vehicles
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-gray-400 mt-2">License Plate: {vehicle.licensePlate}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(vehicle.status)} className="text-lg px-4 py-1">
              {vehicle.status}
            </Badge>
          </div>
        </div>

        {/* ─── MAIN GRID ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* ── VEHICLE INFO CARD ─────────────────────────── */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Truck className="w-5 h-5 mr-2 text-blue-500" />
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
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-[#1e1e2e] last:border-b-0">
                  <span className="text-gray-400 text-sm">{item.label}</span>
                  <span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── REAL-TIME METRICS ────────────────────────── */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Real-Time Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fuel */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-blue-500" />
                    Fuel Level
                  </span>
                  <span className="text-white font-medium">{vehicle.fuelLevel}%</span>
                </div>
                <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', {
                      'bg-emerald-500': vehicle.fuelLevel > 50,
                      'bg-amber-500': vehicle.fuelLevel > 25,
                      'bg-red-500': vehicle.fuelLevel <= 25,
                    })}
                    style={{ width: `${vehicle.fuelLevel}%` }}
                  />
                </div>
              </div>

              {/* Position */}
              {vehicle.lastPosition && (
                <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                  <p className="text-gray-400 text-sm flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4" />
                    Last Position
                  </p>
                  <p className="text-white text-sm font-mono">
                    {vehicle.lastPosition.latitude.toFixed(4)}°, {vehicle.lastPosition.longitude.toFixed(4)}°
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Speed: {vehicle.lastPosition.speed} km/h | Heading: {vehicle.lastPosition.heading}°
                  </p>
                </div>
              )}

              {/* Last Sync */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                <p className="text-gray-400 text-sm flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  Last Sync
                </p>
                <p className="text-white text-sm">
                  {new Date(vehicle.lastSyncAt).toLocaleString()}
                </p>
              </div>

              {/* Next Maintenance */}
              {vehicle.nextMaintenanceDate && (
                <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                  <p className="text-gray-400 text-sm flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4" />
                    Next Maintenance
                  </p>
                  <p className="text-white text-sm">
                    {new Date(vehicle.nextMaintenanceDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── HEALTH SUMMARY ────────────────────────────── */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <AlertTriangle className="w-5 h-5 mr-2 text-blue-500" />
                Health Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Diagnostics */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Active Fault Codes
                  </p>
                  <Badge variant="warning" className="text-sm">
                    {diagnostics.length}
                  </Badge>
                </div>
                {diagnostics.length === 0 && (
                  <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    No issues detected
                  </p>
                )}
              </div>

              {/* Driver Behavior */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent Events (7d)
                  </p>
                  <Badge variant="info" className="text-sm">
                    {behaviors.length}
                  </Badge>
                </div>
              </div>

              {/* Maintenance Alerts */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 border border-[#1e1e2e]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Pending Maintenance
                  </p>
                  <Badge variant="warning" className="text-sm">
                    {maintenance.filter((m) => !(m as any).isCompleted).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── TABBED SECTIONS ────────────────────────────────── */}
        <div className="flex gap-2 mb-6 border-b border-[#1e1e2e]">
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
                  ? 'text-blue-500 border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'diagnostics' && (
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Vehicle Diagnostics</CardTitle>
              <CardDescription className="text-gray-400">Active fault codes and diagnostic information</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                  <p className="text-gray-400">No diagnostic issues detected</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {activeTab === 'behavior' && (
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Driver Behavior Events</CardTitle>
              <CardDescription className="text-gray-400">Last 7 days of driving events</CardDescription>
            </CardHeader>
            <CardContent>
              {behaviors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                  <p className="text-gray-400">No driving events recorded</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {activeTab === 'maintenance' && (
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardHeader>
              <CardTitle className="text-white">Maintenance Alerts</CardTitle>
              <CardDescription className="text-gray-400">Upcoming and pending maintenance tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                  <p className="text-gray-400">No pending maintenance</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
