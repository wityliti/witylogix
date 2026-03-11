"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Download,
  Send,
  CheckCircle,
  Trash2,
  Bell,
  ChevronLeft,
  Clock,
  FileText,
  Eye,
  CreditCard,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax: number;
}

interface Payment {
  id: string;
  date: Date;
  amount: number;
  method: "bank_transfer" | "card" | "cash" | "check";
  reference: string;
}

interface ActivityLog {
  id: string;
  type: "created" | "sent" | "viewed" | "paid" | "reminder_sent";
  timestamp: Date;
  description: string;
  metadata?: Record<string, unknown>;
}

interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  amount: number;
  taxAmount: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  status: InvoiceStatus;
  createdDate: Date;
  sentDate: Date | null;
  dueDate: Date;
  paidDate: Date | null;
  lineItems: LineItem[];
  payments: Payment[];
  activity: ActivityLog[];
  notes?: string;
  terms?: string;
}

const MOCK_INVOICE: Invoice = {
  id: "inv-001",
  number: "INV-2024-001",
  customerId: "cust-001",
  customerName: "Acme Corporation",
  customerEmail: "billing@acme.com",
  customerAddress: "123 Business Ave, New York, NY 10001",
  amount: 2500.0,
  taxAmount: 250.0,
  discountAmount: 0,
  subtotal: 2500.0,
  total: 2750.0,
  status: "paid",
  createdDate: new Date("2024-01-15"),
  sentDate: new Date("2024-01-15"),
  dueDate: new Date("2024-02-15"),
  paidDate: new Date("2024-02-10"),
  lineItems: [
    {
      id: "li-001",
      description: "Delivery Service - January",
      quantity: 45,
      rate: 50.0,
      amount: 2250.0,
      tax: 225.0,
    },
    {
      id: "li-002",
      description: "Rush Delivery Surcharge",
      quantity: 1,
      rate: 250.0,
      amount: 250.0,
      tax: 25.0,
    },
  ],
  payments: [
    {
      id: "pay-001",
      date: new Date("2024-02-10"),
      amount: 2750.0,
      method: "bank_transfer",
      reference: "TXN-20240210-12345",
    },
  ],
  activity: [
    {
      id: "act-001",
      type: "created",
      timestamp: new Date("2024-01-15T09:30:00"),
      description: "Invoice created",
    },
    {
      id: "act-002",
      type: "sent",
      timestamp: new Date("2024-01-15T09:45:00"),
      description: "Invoice sent to customer",
    },
    {
      id: "act-003",
      type: "viewed",
      timestamp: new Date("2024-01-16T14:20:00"),
      description: "Customer viewed invoice",
    },
    {
      id: "act-004",
      type: "paid",
      timestamp: new Date("2024-02-10T10:15:00"),
      description: "Payment received",
    },
  ],
  notes: "Thank you for your business. Please include invoice number with payment.",
  terms: "Payment due within 30 days. Late payments subject to 1.5% monthly interest.",
};

const getStatusBadgeVariant = (
  status: InvoiceStatus
): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  switch (status) {
    case "paid":
      return "success";
    case "sent":
      return "info";
    case "draft":
      return "default";
    case "overdue":
      return "danger";
    case "cancelled":
      return "warning";
    default:
      return "default";
  }
};

const getStatusLabel = (status: InvoiceStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getActivityIcon = (type: ActivityLog["type"]) => {
  switch (type) {
    case "created":
      return <FileText className="w-4 h-4" />;
    case "sent":
      return <Send className="w-4 h-4" />;
    case "viewed":
      return <Eye className="w-4 h-4" />;
    case "paid":
      return <CreditCard className="w-4 h-4" />;
    case "reminder_sent":
      return <Bell className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getActivityDescription = (activity: ActivityLog): string => {
  const time = activity.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = activity.timestamp.toLocaleDateString();
  return `${activity.description} - ${date} at ${time}`;
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice>(MOCK_INVOICE);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOverdue = useMemo(() => {
    return (
      invoice.status !== "paid" &&
      invoice.dueDate < new Date()
    );
  }, [invoice]);

  const daysOverdue = useMemo(() => {
    if (!isOverdue) return 0;
    return Math.floor(
      (new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [isOverdue, invoice.dueDate]);

  const amountPaid = useMemo(() => {
    return invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  }, [invoice.payments]);

  const remainingBalance = useMemo(() => {
    return invoice.total - amountPaid;
  }, [invoice.total, amountPaid]);

  const handleDownloadPDF = useCallback(() => {
    console.log("Downloading PDF for invoice", invoiceId);
    // TODO: Generate and download PDF
  }, [invoiceId]);

  const handleSendInvoice = useCallback(() => {
    console.log("Sending invoice", invoiceId);
    setInvoice((prev) => ({
      ...prev,
      status: "sent",
      sentDate: new Date(),
    }));
    // TODO: API call
  }, [invoiceId]);

  const handleMarkPaid = useCallback(() => {
    console.log("Marking invoice as paid", invoiceId);
    setInvoice((prev) => ({
      ...prev,
      status: "paid",
      paidDate: new Date(),
      payments: [
        ...prev.payments,
        {
          id: `pay-${Date.now()}`,
          date: new Date(),
          amount: prev.total,
          method: "bank_transfer",
          reference: "MAN-" + Date.now(),
        },
      ],
    }));
    // TODO: API call
  }, [invoiceId]);

  const handleVoidInvoice = useCallback(() => {
    console.log("Voiding invoice", invoiceId);
    setInvoice((prev) => ({
      ...prev,
      status: "cancelled",
    }));
    setShowDeleteConfirm(false);
    // TODO: API call
  }, [invoiceId]);

  const handleSendReminder = useCallback(() => {
    console.log("Sending reminder for invoice", invoiceId);
    setInvoice((prev) => ({
      ...prev,
      activity: [
        ...prev.activity,
        {
          id: `act-${Date.now()}`,
          type: "reminder_sent",
          timestamp: new Date(),
          description: "Reminder email sent to customer",
        },
      ],
    }));
    // TODO: API call
  }, [invoiceId]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-wl-text-primary">
                {invoice.number}
              </h1>
              <Badge variant={getStatusBadgeVariant(invoice.status)}>
                {getStatusLabel(invoice.status)}
              </Badge>
              {isOverdue && (
                <Badge variant="danger">
                  {daysOverdue} days overdue
                </Badge>
              )}
            </div>
            <p className="text-wl-text-secondary">
              Created {invoice.createdDate.toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleSendInvoice}
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          )}
          {invoice.status === "sent" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSendReminder}
              >
                <Bell className="w-4 h-4" />
                Send Reminder
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleMarkPaid}
              >
                <CheckCircle className="w-4 h-4" />
                Mark Paid
              </Button>
            </>
          )}
          {invoice.status === "overdue" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSendReminder}
              >
                <Bell className="w-4 h-4" />
                Send Reminder
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleMarkPaid}
              >
                <CheckCircle className="w-4 h-4" />
                Mark Paid
              </Button>
            </>
          )}
          <Button variant="secondary" size="lg" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" />
            PDF
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4" />
            Void
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Invoice Header */}
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-4">
                  Bill To
                </h3>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-wl-text-primary">
                    {invoice.customerName}
                  </p>
                  <p className="text-sm text-wl-text-secondary">
                    {invoice.customerEmail}
                  </p>
                  <p className="text-sm text-wl-text-secondary">
                    {invoice.customerAddress}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-wl-text-secondary">
                      Invoice Date
                    </p>
                    <p className="font-semibold text-wl-text-primary">
                      {invoice.createdDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-wl-text-secondary">
                      Due Date
                    </p>
                    <p
                      className={cn(
                        "font-semibold",
                        isOverdue
                          ? "text-red-500"
                          : "text-wl-text-primary"
                      )}
                    >
                      {invoice.dueDate.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <Table
              columns={[
                {
                  key: "description",
                  header: "Description",
                  width: "50%",
                },
                {
                  key: "quantity",
                  header: "Qty",
                  align: "right",
                  width: "15%",
                },
                {
                  key: "rate",
                  header: "Rate",
                  align: "right",
                  render: (item: any) => (
                    <span>${item.rate.toFixed(2)}</span>
                  ),
                  width: "15%",
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (item: any) => (
                    <span className="font-medium">
                      ${item.amount.toFixed(2)}
                    </span>
                  ),
                  width: "20%",
                },
              ]}
              data={invoice.lineItems}
            />

            {/* Totals */}
            <div className="border-t border-wl-border-subtle p-6">
              <div className="flex justify-end max-w-xs ml-auto space-y-3">
                <div className="w-full">
                  <div className="flex justify-between mb-2">
                    <span className="text-wl-text-secondary">Subtotal</span>
                    <span className="text-wl-text-primary">
                      ${invoice.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between mb-2 text-green-600">
                      <span>Discount</span>
                      <span>-${invoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mb-2 border-t border-wl-border-subtle pt-2">
                    <span className="text-wl-text-secondary">Tax (10%)</span>
                    <span className="text-wl-text-primary">
                      ${invoice.taxAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t-2 border-wl-border-subtle pt-3 mt-3">
                    <span>Total</span>
                    <span className="text-wl-primary-500">
                      ${invoice.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <Card className="p-6 space-y-4">
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-wl-text-primary">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm text-wl-text-primary">
                    {invoice.terms}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column - Summary & Activity */}
        <div className="flex flex-col gap-6">
          {/* Payment Summary */}
          <Card className="p-6">
            <h3 className="font-semibold text-wl-text-primary mb-4">
              Payment Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase text-wl-text-secondary">
                  Total Amount
                </p>
                <p className="text-xl font-bold text-wl-text-primary">
                  ${invoice.total.toFixed(2)}
                </p>
              </div>
              <div className="border-t border-wl-border-subtle pt-3">
                <p className="text-xs uppercase text-wl-text-secondary">
                  Amount Paid
                </p>
                <p className="text-lg font-bold text-green-600">
                  ${amountPaid.toFixed(2)}
                </p>
              </div>
              <div className="border-t border-wl-border-subtle pt-3">
                <p className="text-xs uppercase text-wl-text-secondary">
                  Remaining Balance
                </p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    remainingBalance > 0
                      ? "text-red-500"
                      : "text-green-600"
                  )}
                >
                  ${remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-wl-text-primary mb-4">
                Payment History
              </h3>
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border-b border-wl-border-subtle pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-medium text-wl-text-primary">
                        ${payment.amount.toFixed(2)}
                      </p>
                      <span className="text-xs text-wl-text-secondary">
                        {payment.date.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-wl-text-secondary">
                      {payment.method.replace("_", " ")}
                    </p>
                    <p className="text-xs font-mono text-wl-text-secondary">
                      Ref: {payment.reference}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Activity Log */}
          <Card className="p-6">
            <h3 className="font-semibold text-wl-text-primary mb-4">
              Activity Log
            </h3>
            <div className="space-y-3">
              {invoice.activity.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex gap-3 pb-3 last:pb-0 border-b border-wl-border-subtle last:border-b-0"
                >
                  <div className="text-wl-text-secondary mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-wl-text-secondary">
                      {getActivityDescription(activity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md p-6">
            <h2 className="text-lg font-bold text-wl-text-primary mb-2">
              Void Invoice?
            </h2>
            <p className="text-sm text-wl-text-secondary mb-6">
              Are you sure you want to void this invoice? This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleVoidInvoice}
                className="flex-1"
              >
                Void Invoice
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
