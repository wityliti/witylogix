'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DollarSign, Clock, CheckCircle, Download, TrendingUp, Map, List } from 'lucide-react';

const CodMapView = dynamic(() => import('./components/cod-map-view').then((m) => m.CodMapView), {
  ssr: false,
  loading: () => <div className="h-[520px] flex items-center justify-center text-wl-text-tertiary text-sm">Loading map…</div>,
});

// ─── Types ────────────────────────────────────────────────────────

interface CODTotals {
  collected: string;
  outstanding: string;
  reconciled: string;
  total: string;
  collectedCount: number;
  outstandingCount: number;
  reconciledCount: number;
  totalCount: number;
}

interface DriverRow {
  driver: { id: string; name: string; phone?: string };
  collected: string;
  outstanding: string;
  reconciled: string;
}

interface CODSummary {
  totals: CODTotals;
  byDriver: DriverRow[];
}

interface CODDelivery {
  id: string;
  amount: string;
  currency: string;
  status: string;
  collectedAt: string | null;
  reconciledAt: string | null;
  depositId: string | null;
  driver: { id: string; name: string };
  order: { id: string; shopifyOrderNumber: string } | null;
  shipment: { id: string; shipmentNumber: string } | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
}

interface DeliveriesResponse {
  data: CODDelivery[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ─── Sub-components ───────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  amount: string;
  count: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="p-5 bg-wl-bg-elevated border-wl-border-subtle">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-wl-text-secondary uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-wl-text-primary">${amount}</p>
          <p className="mt-0.5 text-xs text-wl-text-tertiary">{count} deliveries</p>
        </div>
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: 'bg-wl-warning-subtle text-wl-warning border-wl-warning/20',
    collected: 'bg-wl-info-500/10 text-wl-info-400 border-wl-info-400/20',
    verified: 'bg-wl-primary-50 text-wl-primary-400 border-wl-primary-400/20',
    reconciled: 'bg-wl-success-subtle text-wl-success border-wl-success/20',
    failed: 'bg-wl-error-subtle text-wl-error border-wl-error/20',
  };
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium border', variants[status] ?? 'bg-wl-bg-tertiary text-wl-text-secondary border-wl-border-subtle')}>
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function CODReconciliationPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [remitting, setRemitting] = useState(false);
  const [remitError, setRemitError] = useState<string | null>(null);
  const [remitSuccess, setRemitSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const summaryParams = new URLSearchParams();
  if (from) summaryParams.set('from', new Date(from).toISOString());
  if (to) summaryParams.set('to', new Date(to).toISOString());

  const { data: summaryData, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useApiQuery<{ data: CODSummary }>(`/api/v4/finance/cod/summary?${summaryParams.toString()}`);

  const deliveriesParams = new URLSearchParams({ page: String(page), limit: '25', status: 'collected' });
  if (from) deliveriesParams.set('from', new Date(from).toISOString());
  if (to) deliveriesParams.set('to', new Date(to).toISOString());

  const { data: deliveriesData, loading: deliveriesLoading, error: deliveriesError, refetch: refetchDeliveries } =
    useApiQuery<DeliveriesResponse>(`/api/v4/finance/cod/deliveries?${deliveriesParams.toString()}`);

  const summary = summaryData?.data;
  const deliveries = deliveriesData?.data ?? [];
  const pagination = deliveriesData?.pagination;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === deliveries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deliveries.map((d) => d.id)));
    }
  }, [deliveries, selectedIds.size]);

  const handleRemit = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setRemitting(true);
    setRemitError(null);
    setRemitSuccess(null);
    try {
      const json = await api.patch<{ data: { updated: number } }>('/api/v4/finance/cod/remit', { deliveryIds: Array.from(selectedIds) });
      setRemitSuccess(`${json.data.updated} deliveries marked as remitted.`);
      setSelectedIds(new Set());
      refetchSummary();
      refetchDeliveries();
    } catch (err: any) {
      setRemitError(err.message);
    } finally {
      setRemitting(false);
    }
  }, [selectedIds, refetchSummary, refetchDeliveries]);

  const handleExportCSV = useCallback(() => {
    const params = new URLSearchParams({ limit: '1000', page: '1' });
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(to).toISOString());
    window.open(`/api/v4/finance/cod/deliveries?${params.toString()}&format=csv`, '_blank');
  }, [from, to]);

  if (summaryLoading) return <LoadingSkeleton />;
  if (summaryError) return <ErrorState error={summaryError} />;

  const totals = summary?.totals;

  const mapPoints = deliveries
    .filter((d) => d.deliveryLat !== null && d.deliveryLng !== null)
    .map((d) => ({
      id: d.id,
      deliveryLat: d.deliveryLat as number,
      deliveryLng: d.deliveryLng as number,
      status: d.status as any,
      amount: d.amount,
      driverName: d.driver.name,
      orderNumber: d.order?.shopifyOrderNumber,
    }));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-elevated/95 backdrop-blur border-b border-wl-border-subtle">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">COD Reconciliation</h1>
              <p className="text-sm text-wl-text-secondary mt-1">
                Track and reconcile Cash on Delivery payments
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm rounded-lg bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-400"
              />
              <span className="text-wl-text-secondary text-sm">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm rounded-lg bg-wl-bg-elevated border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-400"
              />
              {/* View toggle */}
              <div className="flex rounded-lg overflow-hidden border border-wl-border-subtle">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                    viewMode === 'list'
                      ? 'bg-wl-primary-500 text-wl-text-inverse'
                      : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary',
                  )}
                >
                  <List className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-wl-border-subtle',
                    viewMode === 'map'
                      ? 'bg-wl-primary-500 text-wl-text-inverse'
                      : 'bg-wl-bg-elevated text-wl-text-secondary hover:text-wl-text-primary',
                  )}
                >
                  <Map className="w-4 h-4" />
                  Map
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Collected"
            amount={totals?.collected ?? '0.00'}
            count={totals?.collectedCount ?? 0}
            icon={DollarSign}
            color="bg-wl-primary-600"
          />
          <SummaryCard
            label="Outstanding"
            amount={totals?.outstanding ?? '0.00'}
            count={totals?.outstandingCount ?? 0}
            icon={Clock}
            color="bg-wl-warning"
          />
          <SummaryCard
            label="Remitted"
            amount={totals?.reconciled ?? '0.00'}
            count={totals?.reconciledCount ?? 0}
            icon={CheckCircle}
            color="bg-wl-success"
          />
          <SummaryCard
            label="Total COD"
            amount={totals?.total ?? '0.00'}
            count={totals?.totalCount ?? 0}
            icon={TrendingUp}
            color="bg-wl-primary-500"
          />
        </div>

        {/* Per-Driver Breakdown */}
        {summary && summary.byDriver.length > 0 && (
          <Card className="bg-wl-bg-elevated border-wl-border-subtle overflow-hidden">
            <div className="p-4 border-b border-wl-border-subtle">
              <h2 className="text-sm font-semibold text-wl-text-primary">Per-Driver Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Driver</th>
                    <th className="text-right px-4 py-3 text-wl-text-secondary font-medium">Collected</th>
                    <th className="text-right px-4 py-3 text-wl-text-secondary font-medium">Outstanding</th>
                    <th className="text-right px-4 py-3 text-wl-text-secondary font-medium">Remitted</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byDriver.map((row) => (
                    <tr key={row.driver.id} className="border-b border-wl-border-subtle last:border-0 hover:bg-wl-bg-tertiary/50">
                      <td className="px-4 py-3 font-medium text-wl-text-primary">
                        {row.driver.name}
                        {row.driver.phone && (
                          <span className="ml-2 text-xs text-wl-text-tertiary">{row.driver.phone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-wl-info-400">${row.collected}</td>
                      <td className="px-4 py-3 text-right text-wl-warning">${row.outstanding}</td>
                      <td className="px-4 py-3 text-right text-wl-success">${row.reconciled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Deliveries: List or Map */}
        {viewMode === 'map' ? (
          <div className="h-[520px]">
            <CodMapView points={mapPoints} />
          </div>
        ) : (
          <Card className="bg-wl-bg-elevated border-wl-border-subtle overflow-hidden">
            <div className="p-4 border-b border-wl-border-subtle flex items-center justify-between">
              <h2 className="text-sm font-semibold text-wl-text-primary">
                Outstanding Deliveries
                {pagination && (
                  <span className="ml-2 text-xs font-normal text-wl-text-tertiary">
                    ({pagination.total} total)
                  </span>
                )}
              </h2>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-wl-text-secondary">{selectedIds.size} selected</span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleRemit}
                    disabled={remitting}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    {remitting ? 'Processing…' : 'Mark as Remitted'}
                  </Button>
                </div>
              )}
            </div>

            {remitError && (
              <div className="px-4 py-2 bg-wl-error-subtle border-b border-wl-error/20 text-xs text-wl-error">
                {remitError}
              </div>
            )}
            {remitSuccess && (
              <div className="px-4 py-2 bg-wl-success-subtle border-b border-wl-success/20 text-xs text-wl-success">
                {remitSuccess}
              </div>
            )}

            {deliveriesLoading ? (
              <div className="p-4"><TableSkeleton columns={7} rows={6} /></div>
            ) : deliveriesError ? (
              <div className="p-4"><ErrorState error={deliveriesError} /></div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center text-wl-text-tertiary text-sm">
                No outstanding COD deliveries for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-subtle">
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === deliveries.length && deliveries.length > 0}
                          onChange={toggleAll}
                          className="rounded border-wl-border-subtle"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Order</th>
                      <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Shipment</th>
                      <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Driver</th>
                      <th className="text-right px-4 py-3 text-wl-text-secondary font-medium">Amount</th>
                      <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-wl-text-secondary font-medium">Collected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          'border-b border-wl-border-subtle last:border-0 hover:bg-wl-bg-tertiary/50 transition-colors',
                          selectedIds.has(d.id) && 'bg-wl-primary-500/5',
                        )}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            className="rounded border-wl-border-subtle"
                          />
                        </td>
                        <td className="px-4 py-3 text-wl-text-primary">
                          {d.order?.shopifyOrderNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary">
                          {d.shipment?.shipmentNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-wl-text-primary">{d.driver.name}</td>
                        <td className="px-4 py-3 text-right font-medium text-wl-text-primary">
                          ${d.amount} {d.currency}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">
                          {d.collectedAt ? new Date(d.collectedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-wl-border-subtle flex items-center justify-between">
                <span className="text-xs text-wl-text-tertiary">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
