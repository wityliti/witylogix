'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Truck,
  Activity,
  AlertTriangle,
  TrendingUp,
  Zap,
  Fuel,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Gauge,
  Plus,
} from 'lucide-react';

interface FleetOverview {
  fleetId: string;
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  offlineVehicles: number;
  maintenanceVehicles: number;
  healthScore: FleetHealthScore;
  topAlerts: FleetAlert[];
  recentEvents: FleetEvent[];
  averageFuelEconomy: number;
  totalIdleHours: number;
  criticalAlertCount: number;
}

interface FleetHealthScore {
  overallScore: number;
  fuelEfficiency: number;
  driverSafety: number;
  maintenanceStatus: number;
  utilizationRate: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  lastUpdated: Date;
}

interface FleetAlert {
  id: string;
  vehicleId: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'SAFETY' | 'MAINTENANCE' | 'FUEL' | 'OPERATIONS';
  timestamp: Date;
  resolved: boolean;
}

interface FleetEvent {
  id: string;
  vehicleId: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: Date;
  acknowledged: boolean;
}

export default function FleetDashboard() {
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        // INTEGRATION: Replace with actual API call
        const response = await fetch('/api/fleet/overview');
        const result = await response.json();
        setOverview(result.data);
      } catch (error) {
        console.error('Failed to fetch fleet overview:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900 dark:from---wl-slate-900 dark:via---wl-slate-800 dark:to---wl-slate-900">
        <Header />
        <main className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border---wl-blue-500"></div>
            <p className="mt-4 text---wl-slate-400">Loading fleet dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900">
        <Header />
        <main className="p-8">
          <Card className="bg---wl-slate-800 border---wl-slate-700">
            <CardContent className="flex items-center justify-center h-64">
              <p className="text---wl-slate-400">Failed to load fleet overview</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ─── HELPER FUNCTIONS ─────────────────────────────────────

  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text---wl-green-500';
    if (score >= 60) return 'text---wl-yellow-500';
    return 'text---wl-red-500';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'IMPROVING') return <TrendingUp className="w-4 h-4 text---wl-green-500" />;
    if (trend === 'DECLINING') return <AlertTriangle className="w-4 h-4 text---wl-red-500" />;
    return <Gauge className="w-4 h-4 text---wl-slate-400" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text---wl-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text---wl-yellow-500" />;
      case 'INFO':
        return <Zap className="w-5 h-5 text---wl-blue-500" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text---wl-green-500" />;
    }
  };

  const getSeverityBadgeVariant = (
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
  ): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
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
    <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900 dark:from---wl-slate-900 dark:via---wl-slate-800 dark:to---wl-slate-900">
      <Header />

      <main className="p-8">
        {/* ── HEADER ─────────────────────────────────────────── */}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text---wl-slate-100">Fleet Dashboard</h1>
            <p className="text---wl-slate-400 mt-1">Real-time fleet visibility and health metrics</p>
          </div>
          <Button className="bg---wl-blue-600 hover:bg---wl-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Register Vehicle
          </Button>
        </div>

        {/* ── VEHICLE COUNT CARDS ────────────────────────────── */}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {/* Total Vehicles */}
          <Card className="bg---wl-slate-800 border---wl-slate-700 hover:border---wl-slate-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text---wl-slate-400 text-sm font-medium">Total Vehicles</p>
                  <p className="text-3xl font-bold text---wl-slate-100 mt-2">{overview.totalVehicles}</p>
                </div>
                <Truck className="w-12 h-12 text---wl-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Active Vehicles */}
          <Card className="bg---wl-slate-800 border---wl-slate-700 hover:border---wl-slate-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text---wl-slate-400 text-sm font-medium">Active</p>
                  <p className="text-3xl font-bold text---wl-green-500 mt-2">{overview.activeVehicles}</p>
                </div>
                <Activity className="w-12 h-12 text---wl-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Idle Vehicles */}
          <Card className="bg---wl-slate-800 border---wl-slate-700 hover:border---wl-slate-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text---wl-slate-400 text-sm font-medium">Idle</p>
                  <p className="text-3xl font-bold text---wl-yellow-500 mt-2">{overview.idleVehicles}</p>
                </div>
                <Clock className="w-12 h-12 text---wl-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Offline Vehicles */}
          <Card className="bg---wl-slate-800 border---wl-slate-700 hover:border---wl-slate-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text---wl-slate-400 text-sm font-medium">Offline</p>
                  <p className="text-3xl font-bold text---wl-slate-400 mt-2">{overview.offlineVehicles}</p>
                </div>
                <XCircle className="w-12 h-12 text---wl-slate-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Maintenance */}
          <Card className="bg---wl-slate-800 border---wl-slate-700 hover:border---wl-slate-600 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text---wl-slate-400 text-sm font-medium">Maintenance</p>
                  <p className="text-3xl font-bold text---wl-orange-500 mt-2">{overview.maintenanceVehicles}</p>
                </div>
                <AlertTriangle className="w-12 h-12 text---wl-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────── */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* ── FLEET HEALTH SCORE ────────────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text---wl-slate-100">Fleet Health Score</span>
                {getTrendIcon(overview.healthScore.trend)}
              </CardTitle>
              <CardDescription className="text---wl-slate-400">
                Last updated {new Date(overview.healthScore.lastUpdated).toLocaleTimeString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Overall Score */}
              <div className="mb-6">
                <div className="flex items-end justify-between mb-2">
                  <span className="text---wl-slate-300 font-medium">Overall Score</span>
                  <span className={cn('text-2xl font-bold', getHealthColor(overview.healthScore.overallScore))}>
                    {overview.healthScore.overallScore}
                  </span>
                </div>
                <div className="w-full bg---wl-slate-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from---wl-green-500 to---wl-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${overview.healthScore.overallScore}%` }}
                  />
                </div>
              </div>

              {/* Component Scores */}
              <div className="space-y-3">
                {[
                  { label: 'Fuel Efficiency', value: overview.healthScore.fuelEfficiency },
                  { label: 'Driver Safety', value: overview.healthScore.driverSafety },
                  { label: 'Maintenance', value: overview.healthScore.maintenanceStatus },
                  { label: 'Utilization', value: overview.healthScore.utilizationRate },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text---wl-slate-400">{item.label}</span>
                      <span className="text-xs text---wl-slate-300">{item.value}%</span>
                    </div>
                    <div className="w-full bg---wl-slate-700 rounded-full h-1.5">
                      <div
                        className="bg---wl-blue-500 h-1.5 rounded-full"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── FUEL CONSUMPTION SUMMARY ───────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Fuel className="w-5 h-5 mr-2 text---wl-blue-500" />
                Fuel Consumption
              </CardTitle>
              <CardDescription className="text---wl-slate-400">Fleet-wide summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Average Fuel Economy */}
                <div className="bg---wl-slate-700 rounded-lg p-4">
                  <p className="text---wl-slate-400 text-sm font-medium">Avg Fuel Economy</p>
                  <p className="text-2xl font-bold text---wl-slate-100 mt-1">
                    {overview.averageFuelEconomy.toFixed(1)} km/L
                  </p>
                </div>

                {/* Idle Hours */}
                <div className="bg---wl-slate-700 rounded-lg p-4">
                  <p className="text---wl-slate-400 text-sm font-medium">Total Idle Hours (7d)</p>
                  <p className="text-2xl font-bold text---wl-yellow-500 mt-1">{overview.totalIdleHours}h</p>
                </div>

                {/* Estimated Savings */}
                <div className="bg-gradient-to-r from---wl-green-900 to---wl-green-800 rounded-lg p-4 border border---wl-green-700">
                  <p className="text---wl-green-200 text-sm font-medium">Est. Monthly Fuel Cost</p>
                  <p className="text-2xl font-bold text---wl-green-400 mt-1">$4,250</p>
                  <p className="text-xs text---wl-green-300 mt-2">↓ 8% vs last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── CRITICAL ALERTS ────────────────────────────── */}

          <Card className="lg:col-span-1 bg---wl-slate-800 border---wl-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text---wl-red-500" />
                Active Alerts
              </CardTitle>
              <CardDescription className="text---wl-slate-400">
                {overview.criticalAlertCount} critical issue{overview.criticalAlertCount !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overview.topAlerts.length > 0 ? (
                <div className="space-y-3">
                  {overview.topAlerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 bg---wl-slate-700 rounded-lg border-l-2 border---wl-red-500"
                    >
                      {getStatusIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text---wl-slate-100">{alert.title}</p>
                        <p className="text-xs text---wl-slate-400 mt-1">{alert.description}</p>
                        <Badge variant={getSeverityBadgeVariant(alert.severity)} className="mt-2 text-xs">
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <CheckCircle2 className="w-8 h-8 text---wl-green-500 mb-2" />
                  <p className="text---wl-slate-400 text-sm">No active alerts</p>
                </div>
              )}
            </CardContent>
            {overview.topAlerts.length > 0 && (
              <CardFooter>
                <Button variant="ghost" className="w-full text---wl-blue-500 hover:text---wl-blue-400">
                  View All Alerts
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* ── RECENT EVENTS TABLE ────────────────────────────── */}

        <Card className="bg---wl-slate-800 border---wl-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text---wl-blue-500" />
              Recent Fleet Events (Last 24h)
            </CardTitle>
            <CardDescription className="text---wl-slate-400">
              {overview.recentEvents.length} events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border---wl-slate-700">
                    <th className="text-left py-3 px-4 text---wl-slate-400 font-medium">Event Type</th>
                    <th className="text-left py-3 px-4 text---wl-slate-400 font-medium">Vehicle</th>
                    <th className="text-left py-3 px-4 text---wl-slate-400 font-medium">Severity</th>
                    <th className="text-left py-3 px-4 text---wl-slate-400 font-medium">Time</th>
                    <th className="text-left py-3 px-4 text---wl-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentEvents.length > 0 ? (
                    overview.recentEvents.map((event) => (
                      <tr key={event.id} className="border-b border---wl-slate-700 hover:bg---wl-slate-700/50">
                        <td className="py-3 px-4 text---wl-slate-200 font-medium">{event.eventType}</td>
                        <td className="py-3 px-4 text---wl-slate-300">{event.vehicleId}</td>
                        <td className="py-3 px-4">
                          <Badge variant={getSeverityBadgeVariant(event.severity)}>
                            {event.severity}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text---wl-slate-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4">
                          {event.acknowledged ? (
                            <Badge variant="success">Acknowledged</Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text---wl-slate-400">
                        No recent events
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
