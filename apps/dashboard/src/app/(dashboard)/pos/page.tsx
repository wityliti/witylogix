"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  usePOSOverview,
  useTransactions,
  useTerminals,
  useTopSellingItems,
  type POSOverview,
  type TransactionStatus,
} from "@/hooks/use-pos";

/**
 * POS Overview Page - Professional Dark Theme
 * Daily sales, transaction feed, top items, terminal status
 */

const terminalStatusVariant = (
  status: string,
): "success" | "warning" | "info" | "primary" | "default" | "danger" => {
  const map: Record<
    string,
    "success" | "warning" | "info" | "primary" | "default" | "danger"
  > = {
    online: "success",
    offline: "default",
    error: "danger",
  };
  return (map[status] as any) || "default";
};

const txnStatusVariant = (
  status: TransactionStatus,
): "success" | "warning" | "info" | "primary" | "default" | "danger" => {
  const map: Record<
    TransactionStatus,
    "success" | "warning" | "info" | "primary" | "default" | "danger"
  > = {
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

const DEFAULT_OVERVIEW: POSOverview = {
  todaysSales: 0,
  transactionCount: 0,
  avgTicket: 0,
  paymentBreakdown: { cash: 0, card: 0, mobile: 0, other: 0 },
};

export default function POSPage() {
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = usePOSOverview();
  const { items: liveTransactions, loading: txnLoading } = useTransactions();
  const { items: terminals, loading: terminalsLoading } = useTerminals();
  const { items: topItems } = useTopSellingItems();

  const loading = overviewLoading || txnLoading || terminalsLoading;
  const overview = overviewData ?? DEFAULT_OVERVIEW;

  if (loading) return <LoadingSkeleton />;
  if (overviewError)
    return (
      <ErrorState message={overviewError.message} onRetry={refetchOverview} />
    );

  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  // Get recent transactions (last 10)
  const recentTransactions = useMemo(
    () =>
      [...liveTransactions]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10),
    [liveTransactions],
  );

  // Calculate payment breakdown percentages
  const paymentBreakdownPercentages = useMemo(() => {
    const total = Object.values(overview.paymentBreakdown).reduce(
      (a: number, b: number) => a + b,
      0,
    );
    return {
      cash:
        total > 0
          ? ((overview.paymentBreakdown.cash / total) * 100).toFixed(1)
          : "0",
      card:
        total > 0
          ? ((overview.paymentBreakdown.card / total) * 100).toFixed(1)
          : "0",
      mobile:
        total > 0
          ? ((overview.paymentBreakdown.mobile / total) * 100).toFixed(1)
          : "0",
      other:
        total > 0
          ? ((overview.paymentBreakdown.other / total) * 100).toFixed(1)
          : "0",
    };
  }, [overview.paymentBreakdown]);

  return (
    <>
      <Header
        title="POS Dashboard"
        subtitle={`${overview.transactionCount} transactions · ${terminals.filter((t) => t.status === "online").length}/${terminals.length} terminals online`}
        actions={
          <Button variant="primary" size="md">
            + New Sale
          </Button>
        }
      />

      <div className="p-6 space-y-6 bg-wl-bg-root min-h-[calc(100vh-var(--header-height))]">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today's Sales"
            value={`$${overview.todaysSales.toFixed(2)}`}
            accentColor="var(--wl-success-400)"
            index={0}
          />
          <StatCard
            label="Transactions"
            value={overview.transactionCount}
            accentColor="var(--wl-primary-500)"
            index={1}
          />
          <StatCard
            label="Avg Ticket"
            value={`$${overview.avgTicket.toFixed(2)}`}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Terminals"
            value={`${terminals.filter((t) => t.status === "online").length}/${terminals.length}`}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Main Grid: Payment Breakdown + Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Payment Breakdown Card */}
          <Card className={cn("border-wl-border-default bg-wl-bg-surface")}>
            <CardHeader>
              <CardTitle className="text-white">Payment Breakdown</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Cash */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{paymentMethodIcon.cash}</span>
                    <span className="text-sm font-medium text-gray-400">
                      Cash
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {paymentBreakdownPercentages.cash}%
                  </span>
                </div>
                <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${paymentBreakdownPercentages.cash}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${overview.paymentBreakdown.cash.toFixed(2)}
                </div>
              </div>

              {/* Card */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{paymentMethodIcon.card}</span>
                    <span className="text-sm font-medium text-gray-400">
                      Card
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {paymentBreakdownPercentages.card}%
                  </span>
                </div>
                <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${paymentBreakdownPercentages.card}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${overview.paymentBreakdown.card.toFixed(2)}
                </div>
              </div>

              {/* Mobile */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{paymentMethodIcon.mobile}</span>
                    <span className="text-sm font-medium text-gray-400">
                      Mobile
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {paymentBreakdownPercentages.mobile}%
                  </span>
                </div>
                <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${paymentBreakdownPercentages.mobile}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  ${overview.paymentBreakdown.mobile.toFixed(2)}
                </div>
              </div>

              {/* Other */}
              {overview.paymentBreakdown.other > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💳</span>
                      <span className="text-sm font-medium text-gray-400">
                        Other
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">
                      {paymentBreakdownPercentages.other}%
                    </span>
                  </div>
                  <div className="w-full bg-wl-bg-elevated rounded-full h-2">
                    <div
                      className="bg-gray-500 h-2 rounded-full"
                      style={{ width: `${paymentBreakdownPercentages.other}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ${overview.paymentBreakdown.other.toFixed(2)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Transaction Feed */}
          <div className="lg:col-span-2">
            <Card className={cn("border-wl-border-default bg-wl-bg-surface")}>
              <CardHeader>
                <CardTitle className="text-white">Live Transactions</CardTitle>
              </CardHeader>

              <CardContent className="max-h-96 overflow-y-auto">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No recent transactions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentTransactions.map((txn, idx) => (
                      <div
                        key={txn.id}
                        className={cn(
                          "p-3 bg-wl-bg-elevated rounded-md border-l-4 border-blue-500 hover:bg-wl-bg-elevated transition-colors opacity-0",
                          "cursor-pointer",
                        )}
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
                              <span className="text-sm font-semibold text-white truncate">
                                {txn.customerName || "Guest"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">
                              {txn.terminalName} •{" "}
                              {new Date(txn.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-emerald-400">
                              ${txn.amount.toFixed(2)}
                            </div>
                            <Badge
                              variant={txnStatusVariant(txn.status)}
                              className="mt-1"
                            >
                              {txn.status}
                            </Badge>
                          </div>
                        </div>

                        {txn.items.length > 0 && (
                          <div className="text-xs text-gray-400 pl-6">
                            {txn.items.length} item
                            {txn.items.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Items + Terminal Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top-Selling Items */}
          <Card className={cn("border-wl-border-default bg-wl-bg-surface")}>
            <CardHeader>
              <CardTitle className="text-white">Top-Selling Items</CardTitle>
            </CardHeader>

            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-wl-border-default bg-wl-bg-root">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">
                      Units
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {topItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-wl-bg-elevated transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono">
                        {item.unitsSold}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-bold">
                        ${item.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* POS Terminal Status */}
          <Card className={cn("border-wl-border-default bg-wl-bg-surface")}>
            <CardHeader>
              <CardTitle className="text-white">Terminal Status</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
              {terminals.map((terminal, idx) => (
                <div
                  key={terminal.id}
                  onClick={() => setSelectedTerminal(terminal.id)}
                  className={cn(
                    "p-3 bg-wl-bg-elevated rounded-md border transition-colors cursor-pointer opacity-0",
                    selectedTerminal === terminal.id
                      ? "border-blue-500 bg-wl-bg-elevated"
                      : "border-wl-border-default hover:border-wl-border-strong",
                  )}
                  style={{
                    animation: `wl-fade-in var(--wl-duration-default) var(--wl-ease-default) ${idx * 50}ms forwards`,
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <span>🖥️</span>
                        <span className="truncate">{terminal.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {terminal.location}
                      </div>
                    </div>
                    <Badge variant={terminalStatusVariant(terminal.status)}>
                      {terminal.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                    <div>
                      <div className="text-gray-400 text-xs">Sales</div>
                      <div className="text-white font-bold">
                        ${terminal.totalSales.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Txns</div>
                      <div className="text-white font-bold">
                        {terminal.totalTransactions}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Last Activity</div>
                      <div className="text-white font-bold">
                        {terminal.lastActivity}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
