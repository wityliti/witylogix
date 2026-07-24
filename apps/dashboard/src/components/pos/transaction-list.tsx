"use client";

import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type HTMLAttributes,
} from "react";
import {
  ChevronDown,
  DollarSign,
  CreditCard,
  Smartphone,
  TrendingUp,
  Clock,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  amount: number;
  paymentType: "cash" | "card" | "mobile" | "check";
  terminalId: string;
  timestamp: string; // ISO string
  status: "completed" | "pending" | "failed" | "refunded";
  cardLastFour?: string;
  cardBrand?: string;
  customerName?: string;
  reference?: string;
}

interface TransactionListProps extends HTMLAttributes<HTMLDivElement> {
  transactions: Transaction[];
  onRefund?: (transactionId: string, amount: number) => void;
  onRetry?: (transactionId: string) => void;
  virtualizeItems?: boolean;
  itemHeight?: number;
}

interface RefundState {
  transactionId: string | null;
  amount: number;
  isOpen: boolean;
}

interface DateGroup {
  date: string;
  transactions: Transaction[];
}

const paymentTypeIcons = {
  cash: DollarSign,
  card: CreditCard,
  mobile: Smartphone,
  check: AlertCircle,
};

const paymentTypeColors = {
  cash: "text-wl-success-400",
  card: "text-wl-primary-400",
  mobile: "text-wl-info-400",
  check: "text-wl-warning-400",
};

const paymentTypeLabels = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile",
  check: "Check",
};

const statusConfig = {
  completed: { badge: "success", label: "Completed" },
  pending: { badge: "warning", label: "Pending" },
  failed: { badge: "danger", label: "Failed" },
  refunded: { badge: "default", label: "Refunded" },
};

const TransactionList = forwardRef<HTMLDivElement, TransactionListProps>(
  (
    {
      transactions,
      onRefund,
      onRetry,
      virtualizeItems = true,
      itemHeight = 120,
      className,
      ...props
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [refundState, setRefundState] = useState<RefundState>({
      transactionId: null,
      amount: 0,
      isOpen: false,
    });
    const [expandedTransactionId, setExpandedTransactionId] = useState<
      string | null
    >(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

    // Group transactions by date
    const groupedTransactions: DateGroup[] = transactions.reduce(
      (acc: DateGroup[], txn) => {
        const date = new Date(txn.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const existing = acc.find((g) => g.date === date);
        if (existing) {
          existing.transactions.push(txn);
        } else {
          acc.push({ date, transactions: [txn] });
        }

        return acc;
      },
      [],
    );

    const handleRefundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value) || 0;
      setRefundState((prev) => ({
        ...prev,
        amount: Math.min(
          value,
          transactions.find((t) => t.id === prev.transactionId)?.amount || 0,
        ),
      }));
    };

    const handleRefundSubmit = () => {
      if (refundState.transactionId && refundState.amount > 0) {
        onRefund?.(refundState.transactionId, refundState.amount);
        setRefundState({ transactionId: null, amount: 0, isOpen: false });
      }
    };

    const openRefundDialog = (transactionId: string, amount: number) => {
      setRefundState({
        transactionId,
        amount,
        isOpen: true,
      });
    };

    // Virtualization handler
    useEffect(() => {
      if (!virtualizeItems || !containerRef.current) return;

      const handleScroll = () => {
        const scrollTop = containerRef.current?.scrollTop || 0;
        const start = Math.floor(scrollTop / itemHeight);
        const end =
          start +
          Math.ceil((containerRef.current?.clientHeight || 0) / itemHeight) +
          5;
        setVisibleRange({ start: Math.max(0, start - 5), end });
      };

      const container = containerRef.current;
      container?.addEventListener("scroll", handleScroll);
      return () => container?.removeEventListener("scroll", handleScroll);
    }, [virtualizeItems, itemHeight]);

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const completedCount = transactions.filter(
      (t) => t.status === "completed",
    ).length;
    const failedCount = transactions.filter(
      (t) => t.status === "failed",
    ).length;

    if (!transactions || transactions.length === 0) {
      return (
        <Card ref={ref} className={cn("p-6", className)} {...props}>
          <p className="text-center text-wl-text-secondary text-sm">
            No transactions found
          </p>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn("p-6 space-y-4", className)} {...props}>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 pb-4 border-b border-wl-border-subtle">
          <div className="p-3 rounded-lg bg-wl-bg-surface">
            <p className="text-xs text-wl-text-secondary">Total Amount</p>
            <p className="text-sm font-semibold text-wl-text-primary">
              ${totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-wl-bg-surface">
            <p className="text-xs text-wl-text-secondary">Completed</p>
            <p className="text-sm font-semibold text-wl-success-400">
              {completedCount}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-wl-bg-surface">
            <p className="text-xs text-wl-text-secondary">Failed</p>
            <p className="text-sm font-semibold text-wl-danger-400">
              {failedCount}
            </p>
          </div>
        </div>

        {/* Transactions */}
        <div
          ref={containerRef}
          className="space-y-4 max-h-96 overflow-y-auto"
          style={{
            height: virtualizeItems ? "400px" : "auto",
          }}
        >
          {groupedTransactions.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date Separator */}
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-wl-bg-elevated py-2">
                <div className="flex-1 h-px bg-wl-border-subtle" />
                <span className="text-xs font-semibold text-wl-text-secondary px-2">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-wl-border-subtle" />
              </div>

              {/* Transactions for this date */}
              {group.transactions.map((txn) => {
                const PaymentIcon = paymentTypeIcons[txn.paymentType];
                const statusInfo = statusConfig[txn.status];
                const isExpanded = expandedTransactionId === txn.id;

                return (
                  <div
                    key={txn.id}
                    className={cn(
                      "space-y-0 rounded-lg border border-wl-border-subtle overflow-hidden transition-all",
                      isExpanded && "ring-1 ring-wl-primary-400",
                    )}
                  >
                    {/* Transaction Row */}
                    <button
                      onClick={() =>
                        setExpandedTransactionId(isExpanded ? null : txn.id)
                      }
                      className="w-full p-3 bg-wl-bg-surface hover:bg-wl-bg-elevated transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <PaymentIcon
                            className={cn(
                              "w-5 h-5 flex-shrink-0",
                              paymentTypeColors[txn.paymentType],
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-wl-text-primary">
                                {paymentTypeLabels[txn.paymentType]}
                              </p>
                              <Badge
                                variant={statusInfo.badge as any}
                                className="text-xs"
                              >
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-wl-text-secondary">
                              {txn.customerName || `Terminal ${txn.terminalId}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-wl-text-primary">
                              ${txn.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-wl-text-secondary">
                              {new Date(txn.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-wl-text-secondary transition-transform flex-shrink-0",
                              isExpanded && "transform rotate-180",
                            )}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-3 border-t border-wl-border-subtle space-y-3 bg-wl-bg-elevated">
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-wl-text-secondary">
                              Transaction ID
                            </p>
                            <p className="text-wl-text-primary font-mono">
                              {txn.id.substring(0, 12)}...
                            </p>
                          </div>
                          <div>
                            <p className="text-wl-text-secondary">Terminal</p>
                            <p className="text-wl-text-primary font-mono">
                              {txn.terminalId}
                            </p>
                          </div>
                          {txn.reference && (
                            <div>
                              <p className="text-wl-text-secondary">
                                Reference
                              </p>
                              <p className="text-wl-text-primary font-mono">
                                {txn.reference}
                              </p>
                            </div>
                          )}
                          {txn.paymentType === "card" && txn.cardLastFour && (
                            <div>
                              <p className="text-wl-text-secondary">
                                {txn.cardBrand || "Card"}
                              </p>
                              <p className="text-wl-text-primary font-mono">
                                ****{txn.cardLastFour}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="p-2 rounded bg-wl-bg-surface">
                          <p className="text-xs text-wl-text-secondary mb-1">
                            Amount
                          </p>
                          <p className="text-lg font-bold text-wl-text-primary">
                            ${txn.amount.toFixed(2)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {txn.status === "completed" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                openRefundDialog(txn.id, txn.amount)
                              }
                              className="flex-1 text-xs"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Refund
                            </Button>
                          )}
                          {txn.status === "failed" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => onRetry?.(txn.id)}
                              className="flex-1 text-xs"
                            >
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Refund Dialog */}
        {refundState.isOpen && refundState.transactionId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-wl-text-primary">
                  Refund Transaction
                </h3>
                <p className="text-xs text-wl-text-secondary mt-1">
                  Refund ID: {refundState.transactionId.substring(0, 12)}...
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-wl-text-secondary">
                  Refund Amount
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-wl-text-primary">$</span>
                  <input
                    type="number"
                    value={refundState.amount}
                    onChange={handleRefundChange}
                    max={
                      transactions.find(
                        (t) => t.id === refundState.transactionId,
                      )?.amount || 0
                    }
                    step="0.01"
                    className={cn(
                      "flex-1 px-3 py-2 rounded-md border border-wl-border-subtle",
                      "bg-wl-bg-surface text-wl-text-primary placeholder:text-wl-text-secondary",
                      "text-sm focus:outline-none focus:ring-2 focus:ring-wl-primary-400",
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setRefundState({
                      transactionId: null,
                      amount: 0,
                      isOpen: false,
                    })
                  }
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRefundSubmit}
                  className="flex-1 text-xs"
                  disabled={refundState.amount <= 0}
                >
                  Confirm Refund
                </Button>
              </div>
            </Card>
          </div>
        )}
      </Card>
    );
  },
);

TransactionList.displayName = "TransactionList";

export { TransactionList };
export type { TransactionListProps, Transaction };
