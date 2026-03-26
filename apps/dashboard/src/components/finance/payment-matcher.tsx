"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, Badge, Button } from "@/components/ui";

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  reference?: string;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  outstandingAmount: number;
  dueDate: string;
  customer: string;
}

interface MatchSuggestion {
  transactionId: string;
  invoiceId: string;
  confidence: number;
  matchedAmount: number;
  isPartial: boolean;
}

interface PaymentMatcherProps {
  transactions: BankTransaction[];
  invoices: Invoice[];
  suggestions?: MatchSuggestion[];
  onMatch?: (transactionId: string, invoiceId: string, amount: number) => void;
  onUnmatch?: (transactionId: string, invoiceId: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getConfidenceColor(
  confidence: number
): "success" | "warning" | "info" | "danger" {
  if (confidence >= 95) return "success";
  if (confidence >= 80) return "info";
  if (confidence >= 60) return "warning";
  return "danger";
}

const TransactionCard = memo(
  ({
    transaction,
    suggestions,
    invoices,
    onMatch,
    onUnmatch,
    matched,
  }: {
    transaction: BankTransaction;
    suggestions: MatchSuggestion[];
    invoices: Invoice[];
    onMatch: (invoiceId: string, amount: number) => void;
    onUnmatch: (invoiceId: string) => void;
    matched: Map<string, { invoiceId: string; amount: number }>;
  }) => {
    const transactionSuggestions = suggestions.filter(
      (s) => s.transactionId === transaction.id
    );
    const isMatched = matched.has(transaction.id);
    const matchedData = matched.get(transaction.id);

    return (
      <div className="border border-wl-border-subtle rounded-lg p-3 space-y-3 hover:border-wl-border-default transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-wl-text-primary truncate">
              {transaction.description}
            </p>
            <p className="text-xs text-wl-text-tertiary">
              {formatDate(transaction.date)}
            </p>
          </div>
          <span
            className={cn(
              "px-2 py-1 rounded text-sm font-semibold flex-shrink-0",
              transaction.type === "credit"
                ? "text-wl-success-400 bg-wl-success-bg"
                : "text-wl-text-secondary bg-wl-bg-overlay"
            )}
          >
            {formatCurrency(transaction.amount)}
          </span>
        </div>

        {/* Reference */}
        {transaction.reference && (
          <p className="text-xs text-wl-text-tertiary font-mono">
            Ref: {transaction.reference}
          </p>
        )}

        {/* Status Badge */}
        {isMatched && matchedData ? (
          <div className="flex items-center justify-between p-2 bg-wl-success-bg/20 rounded border border-wl-success-400/30">
            <span className="text-xs text-wl-success-400 font-semibold">
              Matched to Invoice
            </span>
            <button
              onClick={() => onUnmatch(matchedData.invoiceId)}
              className="text-xs text-wl-success-400 hover:text-wl-danger-400 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactionSuggestions.length > 0 ? (
              transactionSuggestions.map((suggestion) => {
                const invoice = invoices.find((i) => i.id === suggestion.invoiceId);
                if (!invoice) return null;

                return (
                  <div
                    key={suggestion.invoiceId}
                    className="flex items-center justify-between p-2 bg-wl-bg-overlay rounded border border-wl-border-subtle hover:border-wl-border-default transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-wl-text-primary truncate">
                        {invoice.number} ({invoice.customer})
                      </p>
                      <p className="text-xs text-wl-text-tertiary">
                        {formatCurrency(suggestion.matchedAmount)}
                        {suggestion.isPartial && " (Partial)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={getConfidenceColor(suggestion.confidence)}
                        dot
                      >
                        {suggestion.confidence}%
                      </Badge>
                      <button
                        onClick={() =>
                          onMatch(
                            suggestion.invoiceId,
                            suggestion.matchedAmount
                          )
                        }
                        className="text-xs px-2 py-1 bg-wl-primary-500/20 text-wl-primary-400 hover:bg-wl-primary-500/30 rounded transition-colors"
                      >
                        Match
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-wl-text-tertiary italic">
                No matches found
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

TransactionCard.displayName = "TransactionCard";

const InvoiceCard = memo(
  ({
    invoice,
    onManualMatch,
    matched,
  }: {
    invoice: Invoice;
    onManualMatch: (transactionId: string | null) => void;
    matched: Map<string, { invoiceId: string; amount: number }>;
  }) => {
    const matchedTransaction = Array.from(matched.entries()).find(
      ([_, data]) => data.invoiceId === invoice.id
    );

    return (
      <div className="border border-wl-border-subtle rounded-lg p-3 space-y-2 hover:border-wl-border-default transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-wl-text-primary truncate">
              {invoice.number}
            </p>
            <p className="text-xs text-wl-text-secondary truncate">
              {invoice.customer}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-semibold text-wl-text-primary">
              {formatCurrency(invoice.outstandingAmount)}
            </p>
            <p className="text-xs text-wl-text-tertiary">
              Due: {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        {/* Amount Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-wl-text-secondary">
            <span>Progress</span>
            <span>
              {formatCurrency(invoice.amount - invoice.outstandingAmount)} /
              {formatCurrency(invoice.amount)}
            </span>
          </div>
          <div className="w-full h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 transition-all"
              style={{
                width: `${((invoice.amount - invoice.outstandingAmount) / invoice.amount) * 100}%`,
              }}
              role="progressbar"
              aria-valuenow={invoice.amount - invoice.outstandingAmount}
              aria-valuemax={invoice.amount}
              aria-valuemin={0}
            />
          </div>
        </div>

        {/* Status */}
        {matchedTransaction ? (
          <div className="flex items-center justify-between p-2 bg-wl-success-bg/20 rounded border border-wl-success-400/30">
            <span className="text-xs text-wl-success-400 font-semibold">
              Matched
            </span>
            <button
              onClick={() => onManualMatch(null)}
              className="text-xs text-wl-success-400 hover:text-wl-danger-400 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : invoice.outstandingAmount > 0 ? (
          <Badge variant="warning" dot>
            Outstanding
          </Badge>
        ) : (
          <Badge variant="success" dot>
            Paid
          </Badge>
        )}
      </div>
    );
  }
);

InvoiceCard.displayName = "InvoiceCard";

export const PaymentMatcher = memo(function PaymentMatcher({
  transactions,
  invoices,
  suggestions = [],
  onMatch,
  onUnmatch,
}: PaymentMatcherProps) {
  const [matched, setMatched] = useState<
    Map<string, { invoiceId: string; amount: number }>
  >(new Map());

  const handleMatch = useCallback(
    (transactionId: string, invoiceId: string, amount: number) => {
      setMatched((prev) => new Map(prev).set(transactionId, { invoiceId, amount }));
      onMatch?.(transactionId, invoiceId, amount);
    },
    [onMatch]
  );

  const handleUnmatch = useCallback(
    (transactionId: string, invoiceId: string) => {
      setMatched((prev) => {
        const newMap = new Map(prev);
        newMap.delete(transactionId);
        return newMap;
      });
      onUnmatch?.(transactionId, invoiceId);
    },
    [onUnmatch]
  );

  const matchingSummary = useMemo(() => {
    const totalMatched = Array.from(matched.values()).reduce(
      (sum, match) => sum + match.amount,
      0
    );
    const totalUnmatched = transactions
      .filter((t) => !matched.has(t.id))
      .reduce((sum, t) => sum + (t.type === "credit" ? t.amount : 0), 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

    return {
      totalMatched,
      totalUnmatched,
      totalOutstanding,
      matchedPercentage:
        totalOutstanding > 0 ? (totalMatched / totalOutstanding) * 100 : 0,
    };
  }, [matched, transactions, invoices]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-wl-text-secondary mb-1">Total Matched</p>
          <p className="text-lg font-bold text-wl-success-400">
            {formatCurrency(matchingSummary.totalMatched)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-wl-text-secondary mb-1">Unmatched</p>
          <p className="text-lg font-bold text-wl-warning-400">
            {formatCurrency(matchingSummary.totalUnmatched)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-wl-text-secondary mb-1">Outstanding</p>
          <p className="text-lg font-bold text-wl-info-400">
            {formatCurrency(matchingSummary.totalOutstanding)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-wl-text-secondary mb-1">Match Rate</p>
          <p className="text-lg font-bold text-wl-primary-400">
            {matchingSummary.matchedPercentage.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bank Transactions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Bank Transactions
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {transactions.filter((t) => t.type === "credit").length > 0 ? (
              transactions
                .filter((t) => t.type === "credit")
                .map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    suggestions={suggestions}
                    invoices={invoices}
                    onMatch={(invoiceId, amount) =>
                      handleMatch(transaction.id, invoiceId, amount)
                    }
                    onUnmatch={(invoiceId) =>
                      handleUnmatch(transaction.id, invoiceId)
                    }
                    matched={matched}
                  />
                ))
            ) : (
              <div className="p-4 text-center text-sm text-wl-text-tertiary">
                No credit transactions
              </div>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-wl-text-primary">
            Outstanding Invoices
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {invoices.filter((i) => i.outstandingAmount > 0).length > 0 ? (
              invoices
                .filter((i) => i.outstandingAmount > 0)
                .map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onManualMatch={(transactionId) => {
                      if (
                        transactionId &&
                        matched.has(transactionId) &&
                        matched.get(transactionId)?.invoiceId === invoice.id
                      ) {
                        const data = matched.get(transactionId)!;
                        handleUnmatch(transactionId, invoice.id);
                      }
                    }}
                    matched={matched}
                  />
                ))
            ) : (
              <div className="p-4 text-center text-sm text-wl-text-tertiary">
                No outstanding invoices
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

PaymentMatcher.displayName = "PaymentMatcher";
