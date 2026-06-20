"use client";

import { useState, useCallback, useEffect } from "react";
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
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";

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

function normalizeApiInvoice(raw: any): Invoice {
  const inv = raw?.invoice ?? raw;
  return {
    id: inv.id,
    number: inv.invoiceNumber ?? `INV-${inv.id?.substring(0, 8) ?? ""}`,
    customerId: inv.customerId ?? "",
    customerName: inv.customerName ?? `Customer ${(inv.customerId ?? "").substring(0, 8)}`,
    customerEmail: inv.customerEmail ?? "",
    customerAddress: inv.customerAddress ?? "",
    amount: Number(inv.subtotal ?? 0),
    taxAmount: Number(inv.taxTotal ?? 0),
    discountAmount: Number(inv.discountTotal ?? 0),
    subtotal: Number(inv.subtotal ?? 0),
    total: Number(inv.total ?? 0),
    status: ((inv.status ?? "draft") as string).toLowerCase() as InvoiceStatus,
    createdDate: new Date(inv.issuedAt ?? inv.createdAt ?? Date.now()),
    sentDate: inv.sentAt ? new Date(inv.sentAt) : null,
    dueDate: new Date(inv.dueAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000),
    paidDate: inv.paidAt ? new Date(inv.paidAt) : null,
    lineItems: (inv.lineItems ?? []).map((item: any) => ({
      id: item.id,
      description: item.description ?? "",
      quantity: Number(item.quantity ?? 1),
      rate: Number(item.unitPrice ?? item.rate ?? 0),
      amount: Number(item.amount ?? 0),
      tax: 0,
    })),
    payments: (inv.payments ?? []).map((pmt: any) => ({
      id: pmt.id,
      date: new Date(pmt.paidAt ?? pmt.createdAt ?? Date.now()),
      amount: Number(pmt.amount ?? 0),
      method: (pmt.method ?? "bank_transfer") as Payment["method"],
      reference: pmt.reference ?? "",
    })),
    activity: (inv.activity ?? []).map((act: any) => ({
      id: act.id ?? String(Math.random()),
      type: (act.type ?? "created") as ActivityLog["type"],
      timestamp: new Date(act.timestamp ?? act.createdAt ?? Date.now()),
      description: act.description ?? "",
    })),
    notes: inv.notes ?? undefined,
    terms: inv.terms ?? undefined,
  };
}

const getStatusBadgeVariant = (
  status: InvoiceStatus
): "default" | "success" | "warning" | "danger" | "info" | "primary" => {
  switch (status) {
    case "paid": return "success";
    case "sent": return "info";
    case "draft": return "default";
    case "overdue": return "danger";
    case "cancelled": return "warning";
    default: return "default";
  }
};

const getActivityIcon = (type: ActivityLog["type"]) => {
  switch (type) {
    case "created": return <FileText className="w-4 h-4" />;
    case "sent": return <Send className="w-4 h-4" />;
    case "viewed": return <Eye className="w-4 h-4" />;
    case "paid": return <CreditCard className="w-4 h-4" />;
    case "reminder_sent": return <Bell className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const { addToast } = useToast();

  const { data: rawInvoice, loading, error } = useApiQuery<any>(`/api/v4/invoices/${invoiceId}`);
  const [localOverrides, setLocalOverrides] = useState<Partial<Invoice>>({});

  const invoice = useMemo<Invoice | null>(() => {
    if (!rawInvoice) return null;
    const base = normalizeApiInvoice(rawInvoice);
    return { ...base, ...localOverrides };
  }, [rawInvoice, localOverrides]);

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
    return Math.floor((new Date().getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [isOverdue, invoice]);

  const amountPaid = useMemo(() => {
    return (invoice?.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  }, [invoice]);

  const remainingBalance = useMemo(() => {
    if (!invoice) return 0;
    return invoice.total - amountPaid;
  }, [invoice, amountPaid]);

  const handleDownloadPDF = useCallback(async () => {
    if (isPdfLoading || !invoice) return;
    setIsPdfLoading(true);
    const invoiceNumber = invoice.number;
    try {
      const token = document.cookie.split("; ").find((c) => c.startsWith("auth-token="))?.split("=")[1];
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/v4/invoices/${invoiceId}/pdf`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", title: "PDF downloaded", message: `Invoice ${invoice.number} downloaded.` });
    } catch (err) {
      addToast({ type: "error", title: "Download failed", message: err instanceof Error ? err.message : "Failed to download PDF." });
    } finally {
      setIsPdfLoading(false);
    }
  }, [invoiceId, invoice, isPdfLoading, addToast]);

  const handleSendInvoice = useCallback(async () => {
    if (isSending || !invoice) return;
    setIsSending(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/send`, {});
      setLocalOverrides((prev) => ({ ...prev, status: "sent", sentDate: new Date() }));
      addToast({ type: "success", title: "Invoice sent", message: `Invoice ${invoice.number} sent to customer.` });
    } catch (err) {
      addToast({ type: "error", title: "Send failed", message: err instanceof Error ? err.message : "Failed to send invoice." });
    } finally {
      setIsSending(false);
    }
  }, [invoiceId, invoice, isSending, addToast]);

  const handleMarkPaid = useCallback(async () => {
    if (isMarkingPaid || !invoice) return;
    setIsMarkingPaid(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/mark-paid`, {});
      setLocalOverrides((prev) => ({ ...prev, status: "paid", paidDate: new Date() }));
      addToast({ type: "success", title: "Invoice marked as paid", message: "Invoice status updated to Paid." });
    } catch (err) {
      addToast({ type: "error", title: "Failed to mark as paid", message: err instanceof Error ? err.message : "Could not update invoice." });
    } finally {
      setIsMarkingPaid(false);
    }
  }, [invoiceId, invoice, isMarkingPaid, addToast]);

  const handleVoidInvoice = useCallback(async () => {
    if (isVoiding || !invoice) return;
    setIsVoiding(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/void`, {});
      setLocalOverrides((prev) => ({ ...prev, status: "cancelled" }));
      setShowDeleteConfirm(false);
      addToast({ type: "success", title: "Invoice voided", message: "The invoice has been voided." });
    } catch (err) {
      addToast({ type: "error", title: "Failed to void invoice", message: err instanceof Error ? err.message : "Could not void the invoice." });
    } finally {
      setIsVoiding(false);
    }
  }, [invoiceId, isVoiding, addToast, refetch]);

  const handleSendReminder = useCallback(async () => {
    if (isSendingReminder || !invoice) return;
    setIsSendingReminder(true);
    try {
      await api.post(`/api/v4/invoices/${invoiceId}/send-reminder`, {});
      addToast({ type: "success", title: "Reminder sent", message: `Reminder sent to ${invoice.customerEmail || "customer"}.` });
    } catch (err) {
      addToast({ type: "error", title: "Reminder failed", message: err instanceof Error ? err.message : "Failed to send reminder." });
    } finally {
      setIsSendingReminder(false);
    }
  }, [invoiceId, invoice, isSendingReminder, addToast]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-[#0a0a0f] min-h-screen">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-[#0a0a0f] min-h-screen">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center bg-[#12121a] border border-[#1e1e2e]">
          <p className="text-red-400 mb-4">{error?.message ?? "Invoice not found"}</p>
          <Button variant="secondary" onClick={() => router.back()}>Go Back</Button>
        </Card>
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
              <h1 className="text-3xl font-bold text-white">{invoice.number}</h1>
              <Badge variant={getStatusBadgeVariant(invoice.status)}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
              {isOverdue && <Badge variant="danger">{daysOverdue} days overdue</Badge>}
            </div>
            <p className="text-gray-400">Created {invoice.createdDate.toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <Button variant="secondary" size="lg" onClick={handleSendInvoice} disabled={isSending}>
              <Send className="w-4 h-4" />
              {isSending ? "Sending..." : "Send"}
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <>
              <Button variant="secondary" size="lg" onClick={handleSendReminder} disabled={isSendingReminder}>
                <Bell className="w-4 h-4" />
                {isSendingReminder ? "Sending..." : "Send Reminder"}
              </Button>
              <Button variant="secondary" size="lg" onClick={handleMarkPaid} disabled={isMarkingPaid}>
                <CheckCircle className="w-4 h-4" />
                {isMarkingPaid ? "Marking Paid..." : "Mark Paid"}
              </Button>
            </>
          )}
          <Button variant="secondary" size="lg" onClick={handleDownloadPDF} disabled={isPdfLoading}>
            <Download className="w-4 h-4" />
            {isPdfLoading ? "Generating…" : "PDF"}
          </Button>
          <Button variant="danger" size="lg" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-4 h-4" />
            Void
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 flex flex-col gap-6">
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold uppercase text-gray-400 mb-4">Bill To</h3>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-white">{invoice.customerName}</p>
                  {invoice.customerEmail && <p className="text-sm text-gray-400">{invoice.customerEmail}</p>}
                  {invoice.customerAddress && <p className="text-sm text-gray-400">{invoice.customerAddress}</p>}
                  {!invoice.customerEmail && !invoice.customerAddress && invoice.customerId && (
                    <p className="text-xs text-gray-500">Customer ID: {invoice.customerId.substring(0, 8)}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-gray-400">Invoice Date</p>
                    <p className="font-semibold text-white">{invoice.createdDate.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Due Date</p>
                    <p className={cn("font-semibold", isOverdue ? "text-red-500" : "text-white")}>
                      {invoice.dueDate.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Line Items */}
          {invoice.lineItems.length > 0 && (
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <Table
                columns={[
                  { key: "description", header: "Description", width: "50%" },
                  { key: "quantity", header: "Qty", align: "right", width: "15%" },
                  {
                    key: "rate",
                    header: "Rate",
                    align: "right",
                    render: (item: LineItem) => <span>${item.rate.toFixed(2)}</span>,
                    width: "15%",
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: (item: LineItem) => <span className="font-medium">${item.amount.toFixed(2)}</span>,
                    width: "20%",
                  },
                ]}
                data={invoice.lineItems}
              />
              <div className="border-t border-[#1e1e2e] p-6">
                <div className="flex justify-end max-w-xs ml-auto space-y-3">
                  <div className="w-full">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-white">${invoice.subtotal.toFixed(2)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div className="flex justify-between mb-2 text-emerald-600">
                        <span>Discount</span>
                        <span>-${invoice.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {invoice.taxAmount > 0 && (
                      <div className="flex justify-between mb-2 border-t border-[#1e1e2e] pt-2">
                        <span className="text-gray-400">Tax</span>
                        <span className="text-white">${invoice.taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t-2 border-[#1e1e2e] pt-3 mt-3">
                      <span className="text-white">Total</span>
                      <span className="text-blue-500">${invoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <Card className="p-6 space-y-4 bg-[#12121a] border border-[#1e1e2e]">
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-gray-400 mb-2">Notes</h3>
                  <p className="text-sm text-white">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="text-sm font-semibold uppercase text-gray-400 mb-2">Terms & Conditions</h3>
                  <p className="text-sm text-white">{invoice.terms}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* Payment Summary */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h3 className="font-semibold text-white mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase text-gray-400">Total Amount</p>
                <p className="text-xl font-bold text-white">${invoice.total.toFixed(2)}</p>
              </div>
              <div className="border-t border-[#1e1e2e] pt-3">
                <p className="text-xs uppercase text-gray-400">Amount Paid</p>
                <p className="text-lg font-bold text-emerald-600">${amountPaid.toFixed(2)}</p>
              </div>
              <div className="border-t border-[#1e1e2e] pt-3">
                <p className="text-xs uppercase text-gray-400">Remaining Balance</p>
                <p className={cn("text-lg font-bold", remainingBalance > 0 ? "text-red-500" : "text-emerald-600")}>
                  ${remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h3 className="font-semibold text-white mb-4">Payment History</h3>
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="border-b border-[#1e1e2e] pb-3 last:border-b-0 last:pb-0">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-medium text-white">${payment.amount.toFixed(2)}</p>
                      <span className="text-xs text-gray-400">{payment.date.toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-gray-400">{payment.method.replace("_", " ")}</p>
                    {payment.reference && <p className="text-xs font-mono text-gray-400">Ref: {payment.reference}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Activity Log */}
          {invoice.activity.length > 0 && (
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
              <h3 className="font-semibold text-white mb-4">Activity Log</h3>
              <div className="space-y-3">
                {invoice.activity.map((activity) => (
                  <div key={activity.id} className="flex gap-3 pb-3 last:pb-0 border-b border-[#1e1e2e] last:border-b-0">
                    <div className="text-gray-400 mt-1">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">
                        {activity.description} —{" "}
                        {activity.timestamp.toLocaleDateString()} at{" "}
                        {activity.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Void Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-bold text-white mb-2">Void Invoice?</h2>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to void this invoice? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleVoidInvoice} disabled={isVoiding} className="flex-1">
                {isVoiding ? "Voiding..." : "Void Invoice"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
