"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "finalized" | "voided";

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
  method: string;
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

// Shape returned by mapDbInvoice in invoice-service.ts
interface RawApiInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface RawApiInvoicePayment {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  paidAt: string;
  createdAt: string;
}

interface RawApiInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  voidedAt: string | null;
  notes?: string;
  terms?: string;
  lineItems: RawApiInvoiceLineItem[];
  payments: RawApiInvoicePayment[];
}

function normalizeStatus(raw: string): InvoiceStatus {
  if (raw === "voided") return "cancelled";
  const allowed: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled", "finalized", "voided"];
  return (allowed.includes(raw as InvoiceStatus) ? raw : "draft") as InvoiceStatus;
}

function normalizeInvoice(raw: RawApiInvoice): Invoice {
  return {
    id: raw.id,
    number: raw.invoiceNumber,
    customerId: raw.customerId,
    customerName: raw.customerId,
    customerEmail: "",
    customerAddress: "",
    amount: raw.subtotal,
    taxAmount: raw.taxTotal,
    discountAmount: raw.discountTotal,
    subtotal: raw.subtotal,
    total: raw.total,
    status: normalizeStatus(raw.status),
    createdDate: new Date(raw.issuedAt),
    sentDate: null,
    dueDate: new Date(raw.dueAt),
    paidDate: raw.paidAt ? new Date(raw.paidAt) : null,
    notes: raw.notes,
    terms: raw.terms,
    lineItems: raw.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      rate: li.unitPrice,
      amount: li.amount,
      tax: 0,
    })),
    payments: raw.payments.map((p) => ({
      id: p.id,
      date: new Date(p.paidAt),
      amount: p.amount,
      method: p.method,
      reference: p.reference ?? "",
    })),
    activity: [],
  };
}

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
    case "finalized":
      return "primary";
    case "voided":
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

  const { addToast } = useToast();

  const { data: rawInvoice, loading, error, refetch } = useApiQuery<RawApiInvoice>(
    `/api/v4/invoices/${invoiceId}`,
  );

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (rawInvoice) {
      setInvoice(normalizeInvoice(rawInvoice));
    }
  }, [rawInvoice]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const isOverdue = useMemo(() => {
    if (!invoice) return false;
    return (
      invoice.status !== "paid" &&
      invoice.dueDate < new Date()
    );
  }, [invoice]);

  const daysOverdue = useMemo(() => {
    if (!isOverdue || !invoice) return 0;
    return Math.floor(
      (new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [isOverdue, invoice]);

  const amountPaid = useMemo(() => {
    if (!invoice) return 0;
    return invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  }, [invoice]);

  const remainingBalance = useMemo(() => {
    if (!invoice) return 0;
    return invoice.total - amountPaid;
  }, [invoice, amountPaid]);

  const handleDownloadPDF = useCallback(async () => {
    if (isPdfLoading || !invoice) return;
    setIsPdfLoading(true);
    try {
      const blob = await api.download(`/api/v4/invoices/${invoiceId}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({
        type: 'success',
        title: 'PDF downloaded',
        message: `Invoice ${invoice.number} has been downloaded.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Download failed',
        message: err instanceof Error ? err.message : 'Failed to download PDF. Please try again.',
      });
    } finally {
      setIsPdfLoading(false);
    }
  }, [invoiceId, invoice, isPdfLoading, addToast]);

  const handleSendInvoice = useCallback(async () => {
    if (isSending || !invoice) return;
    setIsSending(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/send`, {});
      setInvoice((prev) => prev ? ({
        ...prev,
        status: "sent",
        sentDate: new Date(),
      }) : prev);
      addToast({
        type: 'success',
        title: 'Invoice sent',
        message: `Invoice ${invoice.number} has been sent to the customer.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Send failed',
        message: err instanceof Error ? err.message : 'Failed to send invoice. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  }, [invoiceId, invoice, isSending, addToast]);

  const handleMarkPaid = useCallback(async () => {
    if (isMarkingPaid || !invoice) return;
    setIsMarkingPaid(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/payment`, {
        amount: invoice.total,
        method: 'bank_transfer',
      });
      setInvoice((prev) => prev ? ({
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
        activity: [
          ...prev.activity,
          {
            id: `act-${Date.now()}`,
            type: "paid" as const,
            timestamp: new Date(),
            description: "Invoice marked as paid",
          },
        ],
      }) : prev);
      addToast({
        type: 'success',
        title: 'Invoice marked as paid',
        message: 'The invoice status has been updated to Paid.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to mark as paid',
        message: err instanceof Error ? err.message : 'Could not update invoice status. Please try again.',
      });
    } finally {
      setIsMarkingPaid(false);
    }
  }, [invoiceId, invoice, isMarkingPaid, addToast]);

  const handleVoidInvoice = useCallback(async () => {
    if (isVoiding || !invoice) return;
    setIsVoiding(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/void`, { reason: 'Voided by user' });
      setInvoice((prev) => prev ? ({
        ...prev,
        status: "cancelled",
        activity: [
          ...prev.activity,
          {
            id: `act-${Date.now()}`,
            type: "created" as const,
            timestamp: new Date(),
            description: "Invoice voided",
          },
        ],
      }) : prev);
      setShowDeleteConfirm(false);
      addToast({
        type: 'success',
        title: 'Invoice voided',
        message: 'The invoice has been voided successfully.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to void invoice',
        message: err instanceof Error ? err.message : 'Could not void the invoice. Please try again.',
      });
    } finally {
      setIsVoiding(false);
    }
  }, [invoiceId, invoice, isVoiding, addToast]);

  const handleSendReminder = useCallback(async () => {
    if (isSendingReminder || !invoice) return;
    setIsSendingReminder(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/send-reminder`, {});
      setInvoice((prev) => prev ? ({
        ...prev,
        activity: [
          ...prev.activity,
          {
            id: `act-${Date.now()}`,
            type: "reminder_sent" as const,
            timestamp: new Date(),
            description: "Reminder email sent to customer",
          },
        ],
      }) : prev);
      addToast({
        type: 'success',
        title: 'Reminder sent',
        message: 'Payment reminder has been sent to the customer.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Reminder failed',
        message: err instanceof Error ? err.message : 'Failed to send reminder. Please try again.',
      });
    } finally {
      setIsSendingReminder(false);
    }
  }, [invoiceId, invoice, isSendingReminder, addToast]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!invoice) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-wl-bg-root min-h-screen">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="text-center py-20 text-wl-text-secondary">
          <p className="text-lg">Invoice not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-wl-bg-root min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">
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
              disabled={isSending}
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          )}
          {invoice.status === "sent" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSendReminder}
                disabled={isSendingReminder}
              >
                <Bell className="w-4 h-4" />
                {isSendingReminder ? 'Sending...' : 'Send Reminder'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleMarkPaid}
                disabled={isMarkingPaid}
              >
                <CheckCircle className="w-4 h-4" />
                {isMarkingPaid ? 'Marking Paid...' : 'Mark Paid'}
              </Button>
            </>
          )}
          {invoice.status === "overdue" && (
            <>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSendReminder}
                disabled={isSendingReminder}
              >
                <Bell className="w-4 h-4" />
                {isSendingReminder ? 'Sending...' : 'Send Reminder'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleMarkPaid}
                disabled={isMarkingPaid}
              >
                <CheckCircle className="w-4 h-4" />
                {isMarkingPaid ? 'Marking Paid...' : 'Mark Paid'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="lg" onClick={handleDownloadPDF} disabled={isPdfLoading}>
            <Download className="w-4 h-4" />
            {isPdfLoading ? 'Generating…' : 'PDF'}
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
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-4">
                  Bill To
                </h3>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-white">
                    {invoice.customerName}
                  </p>
                  {invoice.customerEmail && (
                    <p className="text-sm text-wl-text-secondary">
                      {invoice.customerEmail}
                    </p>
                  )}
                  {invoice.customerAddress && (
                    <p className="text-sm text-wl-text-secondary">
                      {invoice.customerAddress}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-wl-text-secondary">
                      Invoice Date
                    </p>
                    <p className="font-semibold text-white">
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
                          ? "text-wl-danger-500"
                          : "text-white"
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
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
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
                  render: (item: LineItem) => (
                    <span>${item.rate.toFixed(2)}</span>
                  ),
                  width: "15%",
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (item: LineItem) => (
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
            <div className="border-t border-wl-border-default p-6">
              <div className="flex justify-end max-w-xs ml-auto space-y-3">
                <div className="w-full">
                  <div className="flex justify-between mb-2">
                    <span className="text-wl-text-secondary">Subtotal</span>
                    <span className="text-white">
                      ${invoice.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between mb-2 text-wl-success-500">
                      <span>Discount</span>
                      <span>-${invoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mb-2 border-t border-wl-border-default pt-2">
                    <span className="text-wl-text-secondary">Tax</span>
                    <span className="text-white">
                      ${invoice.taxAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t-2 border-wl-border-default pt-3 mt-3">
                    <span className="text-white">Total</span>
                    <span className="text-wl-info-500">
                      ${invoice.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <Card className={cn("p-6 space-y-4 bg-wl-bg-surface border border-wl-border-default")}>
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-white">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-wl-text-secondary mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm text-white">
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
          <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h3 className="font-semibold text-white mb-4">
              Payment Summary
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase text-wl-text-secondary">
                  Total Amount
                </p>
                <p className="text-xl font-bold text-white">
                  ${invoice.total.toFixed(2)}
                </p>
              </div>
              <div className="border-t border-wl-border-default pt-3">
                <p className="text-xs uppercase text-wl-text-secondary">
                  Amount Paid
                </p>
                <p className="text-lg font-bold text-wl-success-500">
                  ${amountPaid.toFixed(2)}
                </p>
              </div>
              <div className="border-t border-wl-border-default pt-3">
                <p className="text-xs uppercase text-wl-text-secondary">
                  Remaining Balance
                </p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    remainingBalance > 0
                      ? "text-wl-danger-500"
                      : "text-wl-success-500"
                  )}
                >
                  ${remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
              <h3 className="font-semibold text-white mb-4">
                Payment History
              </h3>
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border-b border-wl-border-default pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-medium text-white">
                        ${payment.amount.toFixed(2)}
                      </p>
                      <span className="text-xs text-wl-text-secondary">
                        {payment.date.toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-wl-text-secondary">
                      {payment.method.replace("_", " ")}
                    </p>
                    {payment.reference && (
                      <p className="text-xs font-mono text-wl-text-secondary">
                        Ref: {payment.reference}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Activity Log */}
          {invoice.activity.length > 0 && (
            <Card className={cn("p-6 bg-wl-bg-surface border border-wl-border-default")}>
              <h3 className="font-semibold text-white mb-4">
                Activity Log
              </h3>
              <div className="space-y-3">
                {invoice.activity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-3 pb-3 last:pb-0 border-b border-wl-border-default last:border-b-0"
                  >
                    <div className="text-wl-text-secondary mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-wl-text-secondary">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className={cn("max-w-md p-6 bg-wl-bg-surface border border-wl-border-default")}>
            <h2 className="text-lg font-bold text-white mb-2">
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
                disabled={isVoiding}
                className="flex-1"
              >
                {isVoiding ? 'Voiding...' : 'Void Invoice'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
