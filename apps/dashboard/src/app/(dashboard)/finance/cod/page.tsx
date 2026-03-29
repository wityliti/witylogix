'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

interface DriverCodRow {
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  expectedAmount: number;
  collectedAmount: number;
  verifiedAmount: number;
  reconciledAmount: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
  pendingCount: number;
}

interface ManagerCodData {
  date: string;
  drivers: DriverCodRow[];
  totals: { expected: number; collected: number; discrepancy: number };
  driverCount: number;
  discrepancyCount: number;
}

export default function CodManagerPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, loading, error, refetch } = useApiQuery<ManagerCodData>(
    `/api/v4/cod/manager?date=${date}`
  );

  const handleExport = () => {
    window.location.href = `/api/v4/cod/export?fromDate=${date}&toDate=${date}`;
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;

  const drivers = data?.drivers ?? [];
  const totals = data?.totals ?? { expected: 0, collected: 0, discrepancy: 0 };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">COD Reconciliation</h1>
              <p className="text-sm text-gray-400 mt-1">Expected vs. collected cash per driver</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-md bg-[#1a1a2e] border border-[#2e2e4e] text-white text-sm"
              />
              <Button variant="ghost" size="sm" onClick={refetch}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="primary" size="md" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-7xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
            <p className="text-xs font-medium text-gray-400 uppercase">Expected</p>
            <p className="text-2xl font-bold text-white mt-2">
              ${totals.expected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total COD due</p>
          </Card>

          <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
            <p className="text-xs font-medium text-gray-400 uppercase">Collected</p>
            <p className="text-2xl font-bold text-green-400 mt-2">
              ${totals.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">Cash received</p>
          </Card>

          <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
            <p className="text-xs font-medium text-gray-400 uppercase">Variance</p>
            <p className={cn(
              'text-2xl font-bold mt-2',
              totals.discrepancy === 0 ? 'text-green-400' : totals.discrepancy < 0 ? 'text-red-400' : 'text-amber-400'
            )}>
              {totals.discrepancy >= 0 ? '+' : ''}
              ${totals.discrepancy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">Over/Under</p>
          </Card>

          <Card className="p-4 bg-[#12121a] border border-[#1e1e2e]">
            <p className="text-xs font-medium text-gray-400 uppercase">Discrepancies</p>
            <p className={cn(
              'text-2xl font-bold mt-2',
              (data?.discrepancyCount ?? 0) === 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {data?.discrepancyCount ?? 0}
            </p>
            <p className="text-xs text-gray-400 mt-1">Drivers with variance</p>
          </Card>
        </div>

        {/* Driver Table */}
        <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
          <div className="p-4 border-b border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white">Driver Cash Ledger — {date}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left px-4 py-3 font-semibold text-gray-400">Driver</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Expected</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Collected</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Verified</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Reconciled</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-400">Variance</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No drivers with COD deliveries on this date.
                    </td>
                  </tr>
                )}
                {drivers.map((row) => (
                  <tr key={row.driverId} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{row.driverName}</div>
                      <div className="text-xs text-gray-500">{row.driverPhone}</div>
                    </td>
                    <td className="text-right px-4 py-3 text-gray-300">
                      ${row.expectedAmount.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3 text-white font-medium">
                      ${row.collectedAmount.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3 text-blue-400">
                      ${row.verifiedAmount.toFixed(2)}
                    </td>
                    <td className="text-right px-4 py-3 text-green-400">
                      ${row.reconciledAmount.toFixed(2)}
                    </td>
                    <td className={cn(
                      'text-right px-4 py-3 font-medium',
                      row.discrepancy === 0 ? 'text-gray-400' :
                      row.discrepancy < 0 ? 'text-red-400' : 'text-amber-400'
                    )}>
                      {row.discrepancy >= 0 ? '+' : ''}
                      ${row.discrepancy.toFixed(2)}
                    </td>
                    <td className="text-center px-4 py-3">
                      {row.hasDiscrepancy ? (
                        <Badge variant="danger" className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Variance
                        </Badge>
                      ) : row.reconciledAmount > 0 ? (
                        <Badge variant="success">Reconciled</Badge>
                      ) : row.verifiedAmount > 0 ? (
                        <Badge variant="info">Verified</Badge>
                      ) : row.collectedAmount > 0 ? (
                        <Badge variant="warning">Collected</Badge>
                      ) : (
                        <Badge variant="neutral">Pending</Badge>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      <Link
                        href={`/finance/cod/${row.driverId}?date=${date}`}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        View Ledger
                      </Link>
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
