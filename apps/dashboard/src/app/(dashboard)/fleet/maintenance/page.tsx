'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

const getStatusColor = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    scheduled: 'info',
    'in-progress': 'warning',
    completed: 'success',
    overdue: 'danger',
  };
  return map[status] || 'default';
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

interface Driver {
  id: string;
  name: string;
}

export default function MaintenancePage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const { items: drivers, loading, error, refetch } = useApiList<Driver>('/api/v4/drivers?include=maintenance');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const pageSize = 10;
  const allMaintenance = drivers.flatMap((d) =>
    Array(3).fill(null).map((_, i) => ({
      id: `${d.id}-${i}`,
      type: ['oil-change', 'tire-rotation', 'inspection'][i],
      vehicleId: d.id,
      vehicleName: d.name,
      scheduledDate: new Date(Date.now() + (i - 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: i === 0 ? 'overdue' : i === 1 ? 'scheduled' : 'completed',
      estimatedCost: 200 + Math.random() * 300,
      actualCost: null,
      vendor: 'Local Repair Shop',
    })),
  );

  const filteredMaintenance = allMaintenance.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (a.status !== 'overdue' && b.status === 'overdue') return 1;
    return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
  });

  const paginatedMaintenance = filteredMaintenance.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredMaintenance.length / pageSize);

  const statusCounts = {
    overdue: allMaintenance.filter((m) => m.status === 'overdue').length,
    scheduled: allMaintenance.filter((m) => m.status === 'scheduled').length,
    inProgress: allMaintenance.filter((m) => m.status === 'in-progress').length,
    completed: allMaintenance.filter((m) => m.status === 'completed').length,
  };

  const overdueMaintenance = allMaintenance.filter((m) => m.status === 'overdue');

  return (
    <>
      <Header
        title="Maintenance Management"
        subtitle={`${filteredMaintenance.length} events • ${statusCounts.overdue} overdue`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Maintenance
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-text-primary">{statusCounts.scheduled}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Scheduled</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-warning-500">{statusCounts.inProgress}</p>
                <p className="text-xs text-wl-text-secondary mt-1">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-success-500">{statusCounts.completed}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-wl-danger-500 border-2">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-wl-danger-500">{statusCounts.overdue}</p>
                <p className="text-xs text-wl-text-secondary mt-1">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alerts */}
        {overdueMaintenance.length > 0 && (
          <Card className="border-wl-danger-500 border-2">
            <CardHeader>
              <CardTitle className="text-sm text-wl-danger-500">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Overdue Maintenance ({overdueMaintenance.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueMaintenance.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-wl-danger-500 bg-opacity-10 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-wl-text-primary">{item.type.replace('-', ' ').toUpperCase()}</p>
                      <p className="text-xs text-wl-text-secondary">{item.vehicleName} • Due {formatDate(item.scheduledDate)}</p>
                    </div>
                    <Button variant="danger" size="sm">
                      Action
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Mode Toggle */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-1 mr-auto">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-wl-primary-500 text-wl-text-inverse'
                    : 'bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-md transition-colors',
                  viewMode === 'calendar'
                    ? 'bg-wl-primary-500 text-wl-text-inverse'
                    : 'bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                Calendar
              </button>
            </div>
          </CardContent>
        </Card>

        {viewMode === 'list' ? (
          <>
            {/* Maintenance List */}
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Type</th>
                      <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Vehicle</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Scheduled</th>
                      <th className="p-3 px-4 text-right font-semibold text-wl-text-secondary">Cost</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Vendor</th>
                      <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMaintenance.map((item, idx) => (
                      <tr key={item.id} className={cn('border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-overlay', idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay')}>
                        <td className="p-3 px-4 text-wl-text-primary font-semibold capitalize">{item.type.replace('-', ' ')}</td>
                        <td className="p-3 px-4 text-wl-text-secondary text-xs">{item.vehicleName}</td>
                        <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">{formatDate(item.scheduledDate)}</td>
                        <td className="p-3 px-4 text-right text-wl-text-primary font-medium">{formatCurrency(item.actualCost || item.estimatedCost)}</td>
                        <td className="p-3 px-4 text-center text-wl-text-secondary text-xs">{item.vendor}</td>
                        <td className="p-3 px-4 text-center">
                          <Badge variant={getStatusColor(item.status)}>{item.status === 'in-progress' ? 'In Progress' : item.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
                <div>
                  Showing {paginatedMaintenance.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(currentPage * pageSize, filteredMaintenance.length)} of {filteredMaintenance.length}
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
          </>
        ) : (
          <>
            {/* Calendar View */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Maintenance Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredMaintenance.slice(0, 5).map((item) => (
                    <div key={item.id} className="p-4 bg-wl-bg-overlay rounded-md border-l-4 border-wl-primary-500">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-wl-text-primary">{item.type.replace('-', ' ').toUpperCase()}</p>
                          <p className="text-xs text-wl-text-secondary mt-1">{item.vehicleName}</p>
                        </div>
                        <Badge variant={getStatusColor(item.status)}>{item.status === 'in-progress' ? 'In Progress' : item.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
