'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { Truck, Plus, Eye, Edit2 } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

const getStatusColor = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    active: 'success',
    maintenance: 'warning',
    retired: 'danger',
    idle: 'info',
  };
  return map[status] || 'default';
};

const formatMileage = (mileage: number): string => {
  return new Intl.NumberFormat('en-US').format(mileage);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  mileage: number;
  status: string;
  healthScore: number;
  assignedDriver?: string;
}

export default function VehiclesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { items: vehicles, loading, error, refetch } = useApiList<Vehicle>('/api/v4/drivers?include=vehicles');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const pageSize = 10;
  const paginatedVehicles = vehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(vehicles.length / pageSize);

  const getHealthColor = (score: number): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'warning';
    return 'danger';
  };

  return (
    <>
      <Header
        title="Vehicle Inventory"
        subtitle={`${vehicles.length} vehicles • ${vehicles.filter((v) => v.status === 'active').length} active`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Vehicles Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Vehicle</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">VIN</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Mileage</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Driver</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Health</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, idx) => (
                  <tr key={vehicle.id} className={cn('border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay', idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay')}>
                    <td className="p-3 px-4 text-wl-text-primary font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-wl-primary-500 bg-opacity-10 flex items-center justify-center text-wl-primary-500">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <p>
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text-wl-text-tertiary">{vehicle.licensePlate}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-wl-text-tertiary text-xs font-mono">{vehicle.vin.slice(-8)}</td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-medium">{formatMileage(vehicle.mileage)}</td>
                    <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">{vehicle.assignedDriver || '—'}</td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getHealthColor(vehicle.healthScore)}>{vehicle.healthScore}</Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <div className="flex gap-1 justify-center">
                        <button className="p-1.5 hover:bg-wl-bg-overlay rounded-md transition-colors" title="View Details">
                          <Eye className="w-4 h-4 text-wl-text-secondary" />
                        </button>
                        <button className="p-1.5 hover:bg-wl-bg-overlay rounded-md transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4 text-wl-text-secondary" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
            <div>
              Showing {paginatedVehicles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, vehicles.length)} of {vehicles.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 flex items-center">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
