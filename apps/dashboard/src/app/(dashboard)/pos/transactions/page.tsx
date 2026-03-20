"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
import { useApiList } from '@/hooks/use-api';
  useTransactions,
  useTerminals,
  useRefundTransaction,
  useExportTransactions,
  type TransactionStatus,
  type PaymentMethod,
} from "@/hooks/use-pos";

/**
 * POS Transactions Page
 * Search, filter, detail modal, refund/void, export functionality
 */

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

const paymentMethodIcon: Record<PaymentMethod, string> = {
  cash: "💵",
  card: "💳",
  mobile: "📱",
  check: "📝",
  gift_card: "🎁",
};

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [amountRange, setAmountRange] = useState({ min: 0, max: 10000 });
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const { transactions: allTransactions } = useTransactions();
  const { terminals } = useTerminals();
  const { refund, isLoading: refunding } = useRefundTransaction();
  const { export: exportData, isLoading: exporting } = useExportTransactions();

  // Apply filters
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (paymentFilter !== "all") {
      result = result.filter((t) => t.paymentMethod === paymentFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(term) ||
          t.receiptNumber.toLowerCase().includes(term) ||
          t.customerName?.toLowerCase().includes(term)
      );
    }

    result = result.filter((t) => t.amount >= amountRange.min && t.amount <= amountRange.max);

    return result;
  }, [allTransactions, statusFilter, paymentFilter, searchTerm, amountRange]);

  const selectedTxnData = selectedTxn
    ? allTransactions.find((t) => t.id === selectedTxn)
    : null;

  const handleExport = async (format: "csv" | "pdf") => {
    const blob = await exportData(filteredTransactions, format);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header
        title="Transactions"
        subtitle={`${filteredTransactions.length} transactions · ${filteredTransactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.amount, 0).toFixed(2)} in sales`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={() => handleExport("csv")}>
              ⬇️ CSV
            </Button>
            <Button variant="secondary" size="md" onClick={() => handleExport("pdf")}>
              ⬇️ PDF
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* ═══ Refund Modal ═══ */}
        {showRefundForm && selectedTxnData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Process Refund</CardTitle>
                  <button
                    onClick={() => setShowRefundForm(false)}
                    className="text-slate-400 hover:text-slate-200 text-xl"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1">
                    Transaction
                  </label>
                  <div className="px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm">
                    {selectedTxnData.transactionId}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1">
                    Amount
                  </label>
                  <div className="px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm font-bold text-green-400">
                    ${selectedTxnData.amount.toFixed(2)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1">
                    Refund Reason
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select reason...</option>
                    <option value="customer_request">Customer Request</option>
                    <option value="defective_product">Defective Product</option>
                    <option value="wrong_item">Wrong Item</option>
                    <option value="damaged">Damaged</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={async () => {
                      await refund(selectedTxnData.id, refundReason);
                      setShowRefundForm(false);
                      setRefundReason("");
                    }}
                    disabled={!refundReason || refunding}
                  >
                    {refunding ? "Processing..." : "Confirm Refund"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowRefundForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ Filters ═══ */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by transaction ID, receipt, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "completed", "pending", "refunded", "cancelled", "failed"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                      statusFilter === status
                        ? "bg-indigo-500 text-slate-50 border-indigo-500"
                        : "border-slate-700 bg-transparent text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {status === "all" ? "All Status" : status}
                  </button>
                )
              )}
            </div>

            {/* Payment Filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "cash", "card", "mobile", "check", "gift_card"] as const).map(
                (method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentFilter(method)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1",
                      paymentFilter === method
                        ? "bg-blue-500 text-slate-50 border-blue-500"
                        : "border-slate-700 bg-transparent text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {method !== "all" && <span>{paymentMethodIcon[method]}</span>}
                    {method === "all" ? "All Methods" : method.replace(/_/g, " ")}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Amount Range Slider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-2">
                Min Amount
              </label>
              <input
                type="number"
                min="0"
                value={amountRange.min}
                onChange={(e) =>
                  setAmountRange({ ...amountRange, min: Math.max(0, parseInt(e.target.value) || 0) })
                }
                className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-2">
                Max Amount
              </label>
              <input
                type="number"
                value={amountRange.max}
                onChange={(e) =>
                  setAmountRange({ ...amountRange, max: Math.max(0, parseInt(e.target.value) || 10000) })
                }
                className="w-full px-3 py-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ═══ Transactions Table + Detail Modal ═══ */}
        <div
          className={cn(
            "grid gap-5",
            selectedTxnData ? "grid-cols-1 lg:grid-cols-[1fr_450px]" : "grid-cols-1"
          )}
        >
          {/* Table Card */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Transaction ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      onClick={() => setSelectedTxn(txn.id)}
                      className={cn(
                        "hover:bg-slate-800 transition-colors cursor-pointer",
                        selectedTxnData?.id === txn.id && "bg-slate-800"
                      )}
                    >
                      <td className="px-4 py-3 text-slate-100 font-mono text-xs">
                        {txn.transactionId}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {txn.customerName || "Guest"}
                      </td>
                      <td className="px-4 py-3 text-green-400 font-bold">
                        ${txn.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-lg">
                          {paymentMethodIcon[txn.paymentMethod]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={txnStatusVariant(txn.status)}>
                          {txn.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(txn.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detail Modal */}
          {selectedTxnData && (
            <Card className="sticky overflow-y-auto" style={{ top: "24px", maxHeight: "calc(100vh - 200px)" }}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Transaction Details</CardTitle>
                  <button
                    onClick={() => setSelectedTxn(null)}
                    className="text-slate-400 hover:text-slate-200 text-xl"
                  >
                    ✕
                  </button>
                </div>
              </CardHeader>

              <div className="p-4 space-y-4">
                {/* Header */}
                <div>
                  <div className="text-lg font-bold text-slate-100 mb-2">
                    {selectedTxnData.transactionId}
                  </div>
                  <Badge variant={txnStatusVariant(selectedTxnData.status)}>
                    {selectedTxnData.status}
                  </Badge>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Customer */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Customer
                  </div>
                  <div className="text-sm text-slate-100">
                    {selectedTxnData.customerName || "Guest"}
                  </div>
                  {selectedTxnData.customerEmail && (
                    <div className="text-xs text-slate-400 mt-1">
                      {selectedTxnData.customerEmail}
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-700" />

                {/* Terminal & Time */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Transaction Info
                  </div>
                  <div className="text-sm text-slate-100">
                    {selectedTxnData.terminalName}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(selectedTxnData.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Items */}
                {selectedTxnData.items.length > 0 && (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Items ({selectedTxnData.items.length})
                      </div>
                      <div className="space-y-1">
                        {selectedTxnData.items.map((item) => (
                          <div key={item.id} className="text-xs text-slate-300 flex justify-between">
                            <span>
                              {item.name} x{item.quantity}
                            </span>
                            <span className="text-green-400 font-bold">
                              ${item.totalPrice.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-slate-700" />
                  </>
                )}

                {/* Amounts */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-slate-100">
                      ${selectedTxnData.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {selectedTxnData.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Discount</span>
                      <span className="text-green-400">
                        -${selectedTxnData.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tax</span>
                    <span className="text-slate-100">
                      ${selectedTxnData.tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-slate-700 pt-2">
                    <span className="text-slate-100">Total</span>
                    <span className="text-green-400">
                      ${selectedTxnData.amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Payment Method */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Payment Method
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {paymentMethodIcon[selectedTxnData.paymentMethod]}
                    </span>
                    <span className="text-sm text-slate-100 capitalize">
                      {selectedTxnData.paymentMethod.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-slate-700" />

                {/* Refund Info */}
                {selectedTxnData.refundedAmount && (
                  <>
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Refund
                      </div>
                      <div className="text-sm text-orange-400 font-bold">
                        ${selectedTxnData.refundedAmount.toFixed(2)}
                      </div>
                      {selectedTxnData.refundReason && (
                        <div className="text-xs text-slate-400 mt-1">
                          Reason: {selectedTxnData.refundReason}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-slate-700" />
                  </>
                )}

                {/* Actions */}
                {selectedTxnData.status === "completed" && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowRefundForm(true)}
                  >
                    Process Refund
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
