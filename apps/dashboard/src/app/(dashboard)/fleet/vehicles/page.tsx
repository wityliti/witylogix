'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  Activity,
  AlertTriangle,
  Fuel,
  Gauge,
} from 'lucide-react';

interface Vehicle {
  id: string;
  fleetId: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  engineType: 'GASOLINE' | 'DIESEL' | 'EV' | 'HYBRID';
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'MAINTENANCE';
  odometer: number;
  engineHours: number;
  fuelLevel: number;
  capacity: number;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type SortField = 'licensePlate' | 'status' | 'fuelLevel' | 'lastSyncAt';
type SortOrder = 'asc' | 'desc';

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('licensePlate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchVehicles() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '25',
          ...(search && { search }),
          ...(statusFilter !== 'all' && { status: statusFilter }),
        });

        // INTEGRATION: Replace with actual API call
        const response = await fetch(`/api/fleet/vehicles?${params}`);
        const result = await response.json();

        setVehicles(result.data);
        setTotalPages(result.pagination.totalPages);
      } catch (error) {
        console.error('Failed to fetch vehicles:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVehicles();
  }, [search, statusFilter, page]);

  const sortedVehicles = [...vehicles].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'lastSyncAt') {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg---wl-green-500/10 text---wl-green-400 border-l-2 border---wl-green-500';
      case 'IDLE':
        return 'bg---wl-yellow-500/10 text---wl-yellow-400 border-l-2 border---wl-yellow-500';
      case 'OFFLINE':
        return 'bg---wl-slate-500/10 text---wl-slate-400 border-l-2 border---wl-slate-500';
      case 'MAINTENANCE':
        return 'bg---wl-orange-500/10 text---wl-orange-400 border-l-2 border---wl-orange-500';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Activity className="w-4 h-4 text---wl-green-500" />;
      case 'IDLE':
        return <AlertTriangle className="w-4 h-4 text---wl-yellow-500" />;
      case 'OFFLINE':
        return <Gauge className="w-4 h-4 text---wl-slate-500" />;
      case 'MAINTENANCE':
        return <AlertTriangle className="w-4 h-4 text---wl-orange-500" />;
      default:
        return null;
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

  const formatLastSync = (date?: Date): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from---wl-slate-900 via---wl-slate-800 to---wl-slate-900 dark:from---wl-slate-900 dark:via---wl-slate-800 dark:to---wl-slate-900">
      <Header />

      <main className="p-8">
        {/* ── HEADER ────────────────────────────────────────── */}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text---wl-slate-100">Vehicles</h1>
            <p className="text---wl-slate-400 mt-1">Manage and monitor your fleet vehicles</p>
          </div>
          <Button className="bg---wl-blue-600 hover:bg---wl-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Register Vehicle
          </Button>
        </div>

        {/* ── FILTERS & SEARCH ──────────────────────────────── */}

        <Card className="mb-6 bg---wl-slate-800 border---wl-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text---wl-slate-400" />
                  <Input
                    placeholder="Search by make, model, license plate..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10 bg---wl-slate-700 border---wl-slate-600 text---wl-slate-100 placeholder-text---wl-slate-500 focus:border---wl-blue-500"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 bg---wl-slate-700 border border---wl-slate-600 rounded-md text---wl-slate-100 focus:border---wl-blue-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="IDLE">Idle</option>
                <option value="OFFLINE">Offline</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── VEHICLES TABLE ────────────────────────────────── */}

        <Card className="bg---wl-slate-800 border---wl-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border---wl-slate-700 bg---wl-slate-700/50">
                <tr>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">
                    <button
                      onClick={() => handleSort('licensePlate')}
                      className="flex items-center gap-1 hover:text---wl-blue-400 transition-colors"
                    >
                      Vehicle
                      {sortField === 'licensePlate' &&
                        (sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text---wl-blue-400 transition-colors"
                    >
                      Status
                      {sortField === 'status' &&
                        (sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">Position</th>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">
                    <button
                      onClick={() => handleSort('fuelLevel')}
                      className="flex items-center gap-1 hover:text---wl-blue-400 transition-colors"
                    >
                      Fuel
                      {sortField === 'fuelLevel' &&
                        (sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">
                    <button
                      onClick={() => handleSort('lastSyncAt')}
                      className="flex items-center gap-1 hover:text---wl-blue-400 transition-colors"
                    >
                      Last Sync
                      {sortField === 'lastSyncAt' &&
                        (sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        ))}
                    </button>
                  </th>
                  <th className="text-left py-4 px-6 text---wl-slate-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text---wl-slate-400">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border---wl-blue-500"></div>
                      <p className="mt-2">Loading vehicles...</p>
                    </td>
                  </tr>
                ) : sortedVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text---wl-slate-400">
                      No vehicles found
                    </td>
                  </tr>
                ) : (
                  sortedVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className={cn('border-b border---wl-slate-700 hover:bg---wl-slate-700/50 transition-colors', getStatusColor(vehicle.status))}
                    >
                      {/* Vehicle Info */}
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text---wl-slate-100">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text---wl-slate-400 mt-1">VIN: {vehicle.vin.slice(-8)}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(vehicle.status)}
                          <Badge variant={getStatusBadgeVariant(vehicle.status)}>
                            {vehicle.status}
                          </Badge>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-4 px-6">
                        <div className="text-xs text---wl-slate-400">
                          {vehicle.id === 'veh-1' && (
                            <p>
                              37.77°N, <br />
                              122.42°W
                            </p>
                          )}
                          {vehicle.id !== 'veh-1' && <p>No position</p>}
                        </div>
                      </td>

                      {/* Fuel Level */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text---wl-blue-500" />
                          <div className="w-12 bg---wl-slate-700 rounded-full h-2">
                            <div
                              className={cn('h-2 rounded-full transition-all', {
                                'bg---wl-green-500': vehicle.fuelLevel > 50,
                                'bg---wl-yellow-500': vehicle.fuelLevel > 25,
                                'bg---wl-red-500': vehicle.fuelLevel <= 25,
                              })}
                              style={{ width: `${vehicle.fuelLevel}%` }}
                            />
                          </div>
                          <span className="text-xs text---wl-slate-300 w-8 text-right">
                            {vehicle.fuelLevel}%
                          </span>
                        </div>
                      </td>

                      {/* Last Sync */}
                      <td className="py-4 px-6 text-xs text---wl-slate-400">
                        {formatLastSync(vehicle.lastSyncAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/fleet/vehicles/${vehicle.id}`)}
                            className="p-2 hover:bg---wl-slate-600 rounded-md transition-colors text---wl-slate-400 hover:text---wl-blue-400"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 hover:bg---wl-slate-600 rounded-md transition-colors text---wl-slate-400 hover:text---wl-blue-400"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 hover:bg---wl-slate-600 rounded-md transition-colors text---wl-slate-400 hover:text---wl-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATION ────────────────────────────────── */}

          {!loading && sortedVehicles.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border---wl-slate-700">
              <p className="text-sm text---wl-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg---wl-slate-700 hover:bg---wl-slate-600 disabled:opacity-50"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="bg---wl-slate-700 hover:bg---wl-slate-600 disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
