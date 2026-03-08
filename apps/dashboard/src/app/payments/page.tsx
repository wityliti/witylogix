"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, cn } from "@/lib/utils";

interface Payment {
  id: string;
  shipmentId?: string;
  paymentType: "DELIVERY" | "COD" | "SUBSCRIPTION" | "ADDON" | "REFUND";
  paymentMethod: "STRIPE" | "PAYPAL" | "CASH" | "BANK_TRANSFER" | "SHOPIFY_PAYMENTS" | "OTHER";
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED";
  externalRef?: string;
  createdAt: string;
}

const mockPayments: Payment[] = [
  {
    id: "pay-001",
    shipmentId: "ship-001",
    paymentType: "DELIVERY",
    paymentMethod: "STRIPE",
    amount: 45.99,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "ch_1234567890",
    createdAt: "2026-03-06T10:30:00Z",
  },
  {
    id: "pay-002",
    shipmentId: "ship-002",
    paymentType: "COD",
    paymentMethod: "CASH",
    amount: 62.50,
    currency: "USD",
    status: "PENDING",
    createdAt: "2026-03-06T11:15:00Z",
  },
  {
    id: "pay-003",
    shipmentId: "ship-003",
    paymentType: "DELIVERY",
    paymentMethod: "PAYPAL",
    amount: 128.75,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "PAYID-123456",
    createdAt: "2026-03-06T12:00:00Z",
  },
  {
    id: "pay-004",
    shipmentId: "ship-004",
    paymentType: "SUBSCRIPTION",
    paymentMethod: "STRIPE",
    amount: 299.00,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "sub_monthly_001",
    createdAt: "2026-03-06T08:45:00Z",
  },
  {
    id: "pay-005",
    paymentType: "ADDON",
    paymentMethod: "STRIPE",
    amount: 19.99,
    currency: "USD",
    status: "PROCESSING",
    createdAt: "2026-03-06T14:20:00Z",
  },
  {
    id: "pay-006",
    shipmentId: "ship-005",
    paymentType: "DELIVERY",
    paymentMethod: "BANK_TRANSFER",
    amount: 85.00,
    currency: "USD",
    status: "FAILED",
    externalRef: "wire-20260306-001",
    createdAt: "2026-03-06T09:30:00Z",
  },
  {
    id: "pay-007",
    shipmentId: "ship-006",
    paymentType: "COD",
    paymentMethod: "CASH",
    amount: 45.50,
    currency: "USD",
    status: "COMPLETED",
    createdAt: "2026-03-06T13:10:00Z",
  },
  {
    id: "pay-008",
    shipmentId: "ship-007",
    paymentType: "DELIVERY",
    paymentMethod: "SHOPIFY_PAYMENTS",
    amount: 156.25,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "shopify-ch-789012",
    createdAt: "2026-03-05T16:45:00Z",
  },
  {
    id: "pay-009",
    shipmentId: "pay-001",
    paymentType: "REFUND",
    paymentMethod: "STRIPE",
    amount: 45.99,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "REFUND-ch_1234567890",
    createdAt: "2026-03-06T15:00:00Z",
  },
  {
    id: "pay-010",
    shipmentId: "ship-008",
    paymentType: "DELIVERY",
    paymentMethod: "PAYPAL",
    amount: 72.00,
    currency: "USD",
    status: "PENDING",
    createdAt: "2026-03-06T14:30:00Z",
  },
  {
    id: "pay-011",
    paymentType: "ADDON",
    paymentMethod: "STRIPE",
    amount: 29.99,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "ch_addon_001",
    createdAt: "2026-03-06T11:45:00Z",
  },
  {
    id: "pay-012",
    shipmentId: "ship-009",
    paymentType: "DELIVERY",
    paymentMethod: "CASH",
    amount: 38.75,
    currency: "USD",
    status: "COMPLETED",
    createdAt: "2026-03-06T10:15:00Z",
  },
  {
    id: "pay-013",
    shipmentId: "ship-010",
    paymentType: "COD",
    paymentMethod: "BANK_TRANSFER",
    amount: 95.50,
    currency: "USD",
    status: "PROCESSING",
    externalRef: "wire-20260306-002",
    createdAt: "2026-03-06T12:30:00Z",
  },
  {
    id: "pay-014",
    shipmentId: "ship-011",
    paymentType: "DELIVERY",
    paymentMethod: "STRIPE",
    amount: 110.00,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "ch_1111111111",
    createdAt: "2026-03-05T14:20:00Z",
  },
  {
    id: "pay-015",
    paymentType: "SUBSCRIPTION",
    paymentMethod: "PAYPAL",
    amount: 299.00,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "sub_monthly_002",
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "pay-016",
    shipmentId: "ship-012",
    paymentType: "DELIVERY",
    paymentMethod: "SHOPIFY_PAYMENTS",
    amount: 54.25,
    currency: "USD",
    status: "FAILED",
    createdAt: "2026-03-06T13:50:00Z",
  },
  {
    id: "pay-017",
    shipmentId: "ship-013",
    paymentType: "DELIVERY",
    paymentMethod: "STRIPE",
    amount: 67.80,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "ch_2222222222",
    createdAt: "2026-03-06T09:00:00Z",
  },
  {
    id: "pay-018",
    paymentType: "ADDON",
    paymentMethod: "PAYPAL",
    amount: 15.50,
    currency: "USD",
    status: "PENDING",
    createdAt: "2026-03-06T15:30:00Z",
  },
  {
    id: "pay-019",
    shipmentId: "ship-014",
    paymentType: "COD",
    paymentMethod: "CASH",
    amount: 82.00,
    currency: "USD",
    status: "COMPLETED",
    createdAt: "2026-03-06T08:15:00Z",
  },
  {
    id: "pay-020",
    shipmentId: "ship-015",
    paymentType: "DELIVERY",
    paymentMethod: "BANK_TRANSFER",
    amount: 145.75,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "wire-20260306-003",
    createdAt: "2026-03-05T17:45:00Z",
  },
  {
    id: "pay-021",
    shipmentId: "ship-016",
    paymentType: "DELIVERY",
    paymentMethod: "STRIPE",
    amount: 89.99,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "ch_3333333333",
    createdAt: "2026-03-06T10:45:00Z",
  },
  {
    id: "pay-022",
    paymentType: "ADDON",
    paymentMethod: "STRIPE",
    amount: 24.99,
    currency: "USD",
    status: "FAILED",
    createdAt: "2026-03-06T14:00:00Z",
  },
  {
    id: "pay-023",
    shipmentId: "ship-017",
    paymentType: "DELIVERY",
    paymentMethod: "PAYPAL",
    amount: 56.50,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "PAYID-654321",
    createdAt: "2026-03-06T11:30:00Z",
  },
  {
    id: "pay-024",
    shipmentId: "ship-018",
    paymentType: "COD",
    paymentMethod: "SHOPIFY_PAYMENTS",
    amount: 73.25,
    currency: "USD",
    status: "PROCESSING",
    createdAt: "2026-03-06T15:15:00Z",
  },
  {
    id: "pay-025",
    shipmentId: "ship-019",
    paymentType: "DELIVERY",
    paymentMethod: "CASH",
    amount: 41.00,
    currency: "USD",
    status: "COMPLETED",
    createdAt: "2026-03-06T12:45:00Z",
  },
  {
    id: "pay-026",
    paymentType: "SUBSCRIPTION",
    paymentMethod: "STRIPE",
    amount: 399.00,
    currency: "USD",
    status: "COMPLETED",
    externalRef: "sub_annual_001",
    createdAt: "2026-03-06T07:00:00Z",
  },
];

type StatusFilter = "ALL" | "COMPLETED" | "PENDING" | "PROCESSING" | "FAILED" | "REFUNDED" | "CANCELLED";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Calculate KPI metrics
  const calculateMetrics = () => {
    const completed = payments.filter((p) => p.status === "COMPLETED");
    const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
    const todayRevenue = completed
      .filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString())
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + p.amount, 0);
    const failedAmount = payments
      .filter((p) => p.status === "FAILED")
      .reduce((sum, p) => sum + p.amount, 0);
    const refundedAmount = payments
      .filter((p) => p.status === "REFUNDED")
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalRevenue,
      todayRevenue,
      pendingAmount,
      failedAmount,
      refundedAmount,
    };
  };

  const calculatePaymentMethodBreakdown = () => {
    const breakdown: Record<string, { count: number; amount: number }> = {};
    const completedPayments = payments.filter((p) => p.status === "COMPLETED");

    completedPayments.forEach((p) => {
      if (!breakdown[p.paymentMethod]) {
        breakdown[p.paymentMethod] = { count: 0, amount: 0 };
      }
      breakdown[p.paymentMethod].count++;
      breakdown[p.paymentMethod].amount += p.amount;
    });

    const total = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    return Object.entries(breakdown).map(([method, data]) => ({
      method,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
      amount: data.amount,
      count: data.count,
    }));
  };

  const getFilteredPayments = () => {
    if (statusFilter === "ALL") {
      return payments;
    }
    return payments.filter((p) => p.status === statusFilter);
  };

  const metrics = calculateMetrics();
  const methodBreakdown = calculatePaymentMethodBreakdown();
  const filteredPayments = getFilteredPayments();

  const handleRowClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetailPanel(true);
  };

  const handleRefund = () => {
    if (selectedPayment && selectedPayment.status === "COMPLETED") {
      const refund: Payment = {
        id: `pay-${Date.now()}`,
        shipmentId: selectedPayment.shipmentId,
        paymentType: "REFUND",
        paymentMethod: selectedPayment.paymentMethod,
        amount: selectedPayment.amount,
        currency: selectedPayment.currency,
        status: "PROCESSING",
        externalRef: `REFUND-${selectedPayment.externalRef || selectedPayment.id}`,
        createdAt: new Date().toISOString(),
      };
      setPayments([refund, ...payments]);
      setSelectedPayment(null);
      setShowDetailPanel(false);
    }
  };

  const statusBadgeColor = (status: Payment["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "REFUNDED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const paymentMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      STRIPE: "#635BFF",
      PAYPAL: "#003087",
      CASH: "#90EE90",
      BANK_TRANSFER: "#4A90E2",
      SHOPIFY_PAYMENTS: "#96C832",
      OTHER: "#999999",
    };
    return colors[method] || "#999999";
  };

  const getBadgeStyle = (classString: string): React.CSSProperties => {
    const classMap: Record<string, React.CSSProperties> = {
      "bg-green-100 text-green-800": { backgroundColor: "#dcfce7", color: "#166534" },
      "bg-yellow-100 text-yellow-800": { backgroundColor: "#fef08a", color: "#854d0e" },
      "bg-blue-100 text-blue-800": { backgroundColor: "#dbeafe", color: "#1e40af" },
      "bg-red-100 text-red-800": { backgroundColor: "#fee2e2", color: "#991b1b" },
      "bg-gray-100 text-gray-800": { backgroundColor: "#f3f4f6", color: "#374151" },
    };
    return classMap[classString] || { backgroundColor: "#f3f4f6", color: "#374151" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Header title="Payments" />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Revenue KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8 animate-fade-in">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            change={{ value: 12, label: "increase" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(metrics.todayRevenue)}
            change={{ value: 5, label: "increase" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Pending Payments"
            value={formatCurrency(metrics.pendingAmount)}
            change={{ value: -2, label: "decrease" }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Failed Payments"
            value={formatCurrency(metrics.failedAmount)}
            change={{ value: -1, label: "decrease" }}
            accentColor="var(--wl-danger-400)"
            index={3}
          />
          <StatCard
            label="Refunds Issued"
            value={formatCurrency(metrics.refundedAmount)}
            change={{ value: 0, label: "neutral" }}
            accentColor="var(--wl-info-400)"
            index={4}
          />
        </div>

        {/* Payment Methods Breakdown */}
        <Card className="mb-8 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">
              Payment Methods Breakdown
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-6 space-y-3">
            {methodBreakdown.map((item) => (
              <div key={item.method} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700">{item.method}</span>
                  <span className="text-slate-600">
                    {item.percentage.toFixed(1)}% ({item.count} transactions)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: paymentMethodColor(item.method),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Status Filter Pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["ALL", "COMPLETED", "PENDING", "PROCESSING", "FAILED", "REFUNDED"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                statusFilter === status
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Payments Table */}
        <Card className="shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">ID</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Shipment</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Method</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment, idx) => (
                  <tr
                    key={payment.id}
                    onClick={() => handleRowClick(payment)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors duration-150 animate-fade-in"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <td className="px-6 py-4 text-gray-900 font-mono text-xs">
                      {payment.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {payment.shipmentId
                        ? payment.shipmentId.substring(0, 8)
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-slate-200 text-slate-900">
                        {payment.paymentType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {payment.paymentMethod.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge style={getBadgeStyle(statusBadgeColor(payment.status))}>
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {new Date(payment.createdAt).toLocaleDateString()} at{" "}
                      {new Date(payment.createdAt).toLocaleTimeString([], {
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
      </main>

      {/* Detail Side Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-xl transform transition-transform duration-300 z-50",
          showDetailPanel ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedPayment && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                Payment Details
              </h2>
              <button
                onClick={() => setShowDetailPanel(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Payment ID
                </p>
                <p className="text-sm font-mono text-gray-900 mt-1">
                  {selectedPayment.id}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Status
                </p>
                <Badge
                  className="mt-2"
                  style={getBadgeStyle(statusBadgeColor(selectedPayment.status))}
                >
                  {selectedPayment.status}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Amount
                </p>
                <p className="text-2xl font-mono font-bold text-green-600 mt-1">
                  {formatCurrency(selectedPayment.amount)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Type
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedPayment.paymentType}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Method
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedPayment.paymentMethod.replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              {selectedPayment.shipmentId && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Shipment ID
                  </p>
                  <p className="text-sm font-mono text-gray-900 mt-1">
                    {selectedPayment.shipmentId}
                  </p>
                </div>
              )}

              {selectedPayment.externalRef && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    External Reference
                  </p>
                  <p className="text-sm font-mono text-gray-900 mt-1 break-all">
                    {selectedPayment.externalRef}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">
                  Date & Time
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(selectedPayment.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase">
                  Currency
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedPayment.currency}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 space-y-3">
              {selectedPayment.status === "COMPLETED" && (
                <Button
                  onClick={handleRefund}
                  className="w-full bg-red-600 text-white hover:bg-red-700"
                >
                  Initiate Refund
                </Button>
              )}
              <Button
                onClick={() => setShowDetailPanel(false)}
                variant="secondary"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay */}
      {showDetailPanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity duration-300"
          onClick={() => setShowDetailPanel(false)}
        />
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
