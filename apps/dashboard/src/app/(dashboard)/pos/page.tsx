"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
  usePOSOverview,
  useTransactions,
  useTerminals,
  useTopSellingItems,
  type TransactionStatus,
} from "@/hooks/use-pos";

/**
 * POS Overview Page
 * Daily sales, transaction feed, top items, terminal status, sales trends
 */

const terminalStatusVariant = (status: string): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "info" | "primary" | "default"> = {
    online: "success",
    offline: "default",
    error: "danger",
  };
  return (map[status] as any) || "default";
};

const txnStatusVariant = (status: TransactionStatus): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<TransactionStatus, "success" | "warning" | "info" | "primary" | "default"> = {
    completed: "success",
    pending: "info",
    refunded: "warning",
    cancelled: "default",
    failed: "danger",
  };
  return (map[status] as any) || "default";
};

const paymentMethodIcon: Record<string, string> = {
  cash: "💵",
  card: "💳",
  mobile: "📱",
  check: "📝",
  gift_card: "🎁",
};

export default function POSPage() {
  const { items, loading, error, refetch, pagination } = useApiList<POSTerminal>('/api/v4/pos');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const overview = usePOSOverview();
  const { transactions: liveTransactions } = useTransactions();
  const { terminals } = useTerminals();
  const { items: topItems } = useTopSellingItems();

  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  // Get recent transactions (last 10)
  const recentTransactions = useMemo(
    () =>
      liveTransactions
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10),
    [liveTransactions]
  );

  // Calculate payment breakdown percentages
  const paymentBreakdownPercentages = useMemo(() => {
    const total = Object.values(overview.paymentBreakdown).reduce((a, b) => a + b, 0);
    return {
      cash: total > 0 ? ((overview.paymentBreakdown.cash / total) * 100).toFixed(1) : 0,
      card: total > 0 ? ((overview.paymentBreakdown.card / total) * 100).toFixed(1) : 0,
      mobile: total > 0 ? ((overview.paymentBreakdown.mobile / total) * 100).toFixed(1) : 0,
      other: total > 0 ? ((overview.paymentBreakdown.other / total) * 100).toFixed(1) : 0,
    };
  }, [overview.paymentBreakdown]);

  return (
    <>
      <Header
        title="POS Dashboard"
        subtitle={`${overview.transactionCount} transactions · ${terminals.filter((t) => t.status === "online").length}/${terminals.length} terminals online`}
        actions={<Button variant="primary" size="md">+ New Sale</Button>}
      />

      <div className="p-6">
        {/* ═══ KPI Stats Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 auto-rows-max">
          <StatCard
            label="Today's Sales"
            value={`$${overview.todaysSales.toFixed(2)}`}
            change={{ value: 12.5, label: "vs yesterday" }}
            accentColor="var(--wl-success-400)"
            index={0}
          />
          <StatCard
            label="Transactions"
            value={overview.transactionCount}
            change={{ value: 5.2, label: "vs average" }}
            accentColor="var(--wl-primary-500)"
            index={1}
          />
          <StatCard
            label="Avg Ticket"
            value={`$${overview.avgTicket.toFixed(2)}`}
            change={{ value: 3.1, label: "increase" }}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Terminals"
            value={`${terminals.filter((t) => t.status === "online").length}/${terminals.length}`}
            change={{ value: 0, label: "online" }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* ═══ Main Grid: Payment Breakdown + Live Feed ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Payment Breakdown Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Breakdown</CardTitle>
            </CardHeader>

            <div className="p-4">
              <div className="space-y-3">
                {/* Cash */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{paymentMethodIcon.cash}</span>
                      <span className="text-sm font-medium text-slate-300">Cash</span>
                    </div>
                    <span className="text-sm font-bold text-slate-100">
                      {paymentBreakdownPercentages.cash}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${paymentBreakdownPercentages.cash}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ${overview.paymentBreakdown.cash.toFixed(2)}
                  </div>
                </div>

                {/* Card */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{paymentMethodIcon.card}</span>
                      <span className="text-sm font-medium text-slate-300">Card</span>
                    </div>
                    <span className="text-sm font-bold text-slate-100">
                      {paymentBreakdownPercentages.card}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${paymentBreakdownPercentages.card}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ${overview.paymentBreakdown.card.toFixed(2)}
                  </div>
                </div>

                {/* Mobile */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{paymentMethodIcon.mobile}</span>
                      <span className="text-sm font-medium text-slate-300">Mobile</span>
                    </div>
                    <span className="text-sm font-bold text-slate-100">
                      {paymentBreakdownPercentages.mobile}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${paymentBreakdownPercentages.mobile}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ${overview.paymentBreakdown.mobile.toFixed(2)}
                  </div>
                </div>

                {/* Other */}
                {overview.paymentBreakdown.other > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💳</span>
                        <span className="text-sm font-medium text-slate-300">Other</span>
                      </div>
                      <span className="text-sm font-bold text-slate-100">
                        {paymentBreakdownPercentages.other}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-slate-500 h-2 rounded-full"
                        style={{ width: `${paymentBreakdownPercentages.other}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      ${overview.paymentBreakdown.other.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Live Transaction Feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Live Transactions</CardTitle>
              </CardHeader>

              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    No recent transactions
                  </div>
                ) : (
                  recentTransactions.map((txn, idx) => (
                    <div
                      key={txn.id}
                      className="p-3 bg-slate-800 rounded-md border-l-4 border-indigo-500 hover:bg-slate-700 transition-colors opacity-0"
                      style={{
                        animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                      }}
                    >
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {paymentMethodIcon[txn.paymentMethod]}
                            </span>
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {txn.customerName || "Guest"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {txn.terminalName} • {new Date(txn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-green-400">
                            ${txn.amount.toFixed(2)}
                          </div>
                          <Badge variant={txnStatusVariant(txn.status)} className="mt-1">
                            {txn.status}
                          </Badge>
                        </div>
                      </div>

                      {txn.items.length > 0 && (
                        <div className="text-xs text-slate-400 pl-6">
                          {txn.items.length} item{txn.items.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ═══ Top Items + Terminal Status ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top-Selling Items */}
          <Card>
            <CardHeader>
              <CardTitle>Top-Selling Items</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Units
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {topItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-slate-100 font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">
                        {item.unitsSold}
                      </td>
                      <td className="px-4 py-3 text-green-400 font-bold">
                        ${item.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* POS Terminal Status */}
          <Card>
            <CardHeader>
              <CardTitle>Terminal Status</CardTitle>
            </CardHeader>

            <div className="p-4 space-y-2">
              {terminals.map((terminal, idx) => (
                <div
                  key={terminal.id}
                  onClick={() => setSelectedTerminal(terminal.id)}
                  className={cn(
                    "p-3 bg-slate-800 rounded-md border transition-colors cursor-pointer opacity-0",
                    selectedTerminal === terminal.id
                      ? "border-indigo-500"
                      : "border-slate-700 hover:border-slate-600"
                  )}
                  style={{
                    animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <span>🖥️</span>
                        <span className="truncate">{terminal.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {terminal.location}
                      </div>
                    </div>
                    <Badge variant={terminalStatusVariant(terminal.status)}>
                      {terminal.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                    <div>
                      <div className="text-slate-400 text-xs">Sales</div>
                      <div className="text-slate-100 font-bold">
                        ${terminal.totalSales.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Txns</div>
                      <div className="text-slate-100 font-bold">
                        {terminal.totalTransactions}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Last Activity</div>
                      <div className="text-slate-100 font-bold">
                        {terminal.lastActivity}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
