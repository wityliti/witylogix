'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useApiQuery, UseApiMutationResult } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';

interface ShiftCollection {
  id: string;
  status: string;
  amount: number;
  collectedAt: string | null;
}

interface ShiftShipment {
  shipmentId: string;
  shipmentNumber: string;
  shipmentStatus: string;
  expectedAmount: number;
  collectedAmount: number;
  collections: ShiftCollection[];
}

interface ShiftSummary {
  driver: { id: string; name: string; phone: string };
  shiftDate: string;
  summary: {
    expectedAmount: number;
    collectedAmount: number;
    discrepancy: number;
    discrepancyPercent: number;
    isSettled: boolean;
    settlement: {
      id: string;
      declaredAmount: number;
      notes: string | null;
      settledAt: string;
      status: string;
    } | null;
  };
  shipments: ShiftShipment[];
}

interface LedgerEntry {
  id: string;
  status: string;
  amount: number;
  currency: string;
  collectedAt: string | null;
  verifiedAt: string | null;
  reconciledAt: string | null;
  depositId: string | null;
  driverNotes: string | null;
  shipment: { number: string; tracking: string } | null;
  order: { number: string; customer: string } | null;
  createdAt: string;
}

interface LedgerData {
  driver: { id: string; name: string; phone: string };
  ledger: LedgerEntry[];
  totals: { collected: number; pending: number };
  pagination: { total: number; limit: number; offset: number; totalPages: number };
}

function statusVariant(status: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'reconciled': return 'success';
    case 'verified': return 'info';
    case 'collected': return 'warning';
    case 'pending': return 'neutral';
    case 'failed': return 'danger';
    default: return 'neutral';
  }
}

export default function DriverCodLedgerPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const [shiftDate, setShiftDate] = useState(initialDate);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    data: shift,
    loading: shiftLoading,
    error: shiftError,
    refetch: refetchShift,
  } = useApiQuery<ShiftSummary>(`/api/v4/cod/drivers/${driverId}/shift?date=${shiftDate}`);

  const {
    data: ledger,
    loading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useApiQuery<LedgerData>(`/api/v4/cod/drivers/${driverId}/ledger?date=${shiftDate}`);

  const handleSettle = async () => {
    const amountCents = Math.round(parseFloat(settleAmount) * 100);
    if (isNaN(amountCents) || amountCents < 0) {
      setSettleError('Enter a valid amount');
      return;
    }
    setSettling(true);
    setSettleError(null);
    try {
      await api.post(`/api/v4/cod/drivers/${driverId}/settle`, {
        declaredAmount: amountCents,
        notes: settleNotes || undefined,
      });
      setSettleAmount('');
      setSettleNotes('');
      await refetchShift();
      await refetchLedger();
    } catch (e: any) {
      setSettleError(e?.message ?? 'Failed to submit settlement');
    } finally {
      setSettling(false);
    }
  };

  const handleVerify = async (collectionId: string) => {
    setActionLoading(collectionId);
    try {
      await api.patch(`/api/v4/cod/${collectionId}/verify`, {});
      await refetchShift();
      await refetchLedger();
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlag = async (collectionId: string) => {
    const reason = window.prompt('Describe the discrepancy:');
    if (!reason) return;
    setActionLoading(collectionId);
    try {
      await api.post(`/api/v4/cod/${collectionId}/flag`, { reason });
      await refetchShift();
      await refetchLedger();
    } finally {
      setActionLoading(null);
    }
  };

  if (shiftLoading || ledgerLoading) return <LoadingSkeleton />;
  if (shiftError) return <ErrorState error={shiftError} />;
  if (ledgerError) return <ErrorState error={ledgerError} />;

  const s = shift?.summary;
  const driver = shift?.driver ?? ledger?.driver;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/finance/cod" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{driver?.name ?? 'Driver'} — Cash Ledger</h1>
                <p className="text-sm text-gray-400 mt-1">{driver?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="px-3 py-2 rounded-md bg-[#1a1a2e] border border-[#2e2e4e] text-white text-sm"
              />
              <Button variant="ghost" size="sm" onClick={() => { refetchShift(); refetchLedger(); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-6xl">
        {/* Shift Summary Cards */}
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
              <p className="text-xs font-medium text-gray-400 uppercase">Expected</p>
              <p className="text-2xl font-bold text-white mt-2">${s.expectedAmount.toFixed(2)}</p>
            </Card>
            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
              <p className="text-xs font-medium text-gray-400 uppercase">Collected</p>
              <p className="text-2xl font-bold text-green-400 mt-2">${s.collectedAmount.toFixed(2)}</p>
            </Card>
            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
              <p className="text-xs font-medium text-gray-400 uppercase">Variance</p>
              <p className={cn(
                'text-2xl font-bold mt-2',
                s.discrepancy === 0 ? 'text-gray-400' : s.discrepancy < 0 ? 'text-red-400' : 'text-amber-400'
              )}>
                {s.discrepancy >= 0 ? '+' : ''}${s.discrepancy.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {s.discrepancyPercent >= 0 ? '+' : ''}{s.discrepancyPercent}%
              </p>
            </Card>
            <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
              <p className="text-xs font-medium text-gray-400 uppercase">Settlement</p>
              <div className="mt-2">
                {s.isSettled ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">Settled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-400 font-semibold">Pending</span>
                  </div>
                )}
                {s.settlement && (
                  <p className="text-xs text-gray-500 mt-1">
                    Declared: ${s.settlement.declaredAmount.toFixed(2)}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Shift Settlement (shown if not yet settled for this date) */}
        {s && !s.isSettled && (
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              End-of-Shift Settlement
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Driver: confirm the total cash collected this shift.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Total Cash Collected ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-md bg-[#1a1a2e] border border-[#2e2e4e] text-white text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Any notes about the collection..."
                  className="w-full px-3 py-2 rounded-md bg-[#1a1a2e] border border-[#2e2e4e] text-white text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSettle}
                  disabled={settling || !settleAmount}
                >
                  {settling ? 'Submitting…' : 'Submit Settlement'}
                </Button>
              </div>
            </div>
            {settleError && (
              <p className="text-red-400 text-sm mt-2">{settleError}</p>
            )}
          </Card>
        )}

        {/* Per-Shipment Breakdown */}
        {(shift?.shipments ?? []).length > 0 && (
          <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
            <div className="p-4 border-b border-[#1e1e2e]">
              <h2 className="text-lg font-semibold text-white">Shipment Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Shipment</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Delivery Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Expected</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Collected</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Collections</th>
                  </tr>
                </thead>
                <tbody>
                  {shift?.shipments.map((s) => (
                    <tr key={s.shipmentId} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]">
                      <td className="px-4 py-3 font-medium text-white">{s.shipmentNumber}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{s.shipmentStatus}</Badge>
                      </td>
                      <td className="text-right px-4 py-3 text-gray-300">
                        ${s.expectedAmount.toFixed(2)}
                      </td>
                      <td className={cn(
                        'text-right px-4 py-3 font-medium',
                        s.collectedAmount >= s.expectedAmount ? 'text-green-400' : 'text-red-400'
                      )}>
                        ${s.collectedAmount.toFixed(2)}
                      </td>
                      <td className="text-center px-4 py-3 text-gray-400 text-xs">
                        {s.collections.length} collection{s.collections.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Full Ledger */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
          <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Transaction Ledger</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Collected: <span className="text-green-400 font-medium">${ledger?.totals.collected.toFixed(2) ?? '—'}</span></span>
              <span>Pending: <span className="text-amber-400 font-medium">${ledger?.totals.pending.toFixed(2) ?? '—'}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left px-4 py-3 font-semibold text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-400">Shipment / Order</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-400">Deposit</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(ledger?.ledger ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No COD collections on this date.
                    </td>
                  </tr>
                )}
                {(ledger?.ledger ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {entry.collectedAt
                        ? new Date(entry.collectedAt).toLocaleDateString()
                        : new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.shipment ? (
                        <div>
                          <div className="text-white">{entry.shipment.number}</div>
                          <div className="text-xs text-gray-500">{entry.order?.customer ?? ''}</div>
                        </div>
                      ) : entry.order ? (
                        <div>
                          <div className="text-white">{entry.order.number}</div>
                          <div className="text-xs text-gray-500">{entry.order.customer}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-xs">Settlement record</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-3 font-medium text-white">
                      ${entry.amount.toFixed(2)}
                    </td>
                    <td className="text-center px-4 py-3">
                      <Badge variant={statusVariant(entry.status)}>
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {entry.depositId ?? '—'}
                    </td>
                    <td className="text-center px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {['pending', 'collected'].includes(entry.status) && (
                          <button
                            onClick={() => handleVerify(entry.id)}
                            disabled={actionLoading === entry.id}
                            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                          >
                            {actionLoading === entry.id ? '…' : 'Verify'}
                          </button>
                        )}
                        {entry.status !== 'failed' && entry.status !== 'reconciled' && (
                          <button
                            onClick={() => handleFlag(entry.id)}
                            disabled={actionLoading === entry.id}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            Flag
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
