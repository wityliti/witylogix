'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  Settings,
  Power,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  CreditCard,
  DollarSign,
  TrendingUp,
  Activity,
  Eye,
  Download,
  Repeat2,
  Shield,
  AlertTriangle,
  Send,
} from 'lucide-react';

interface PaymentProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  transactions?: number;
  volume?: string;
  fees?: string;
  lastSync?: string;
}

interface Transaction {
  id: string;
  date: string;
  type: "charge" | "refund" | "authorization";
  amount: number;
  currency: string;
  status: "successful" | "pending" | "failed" | "disputed";
  provider: string;
  paymentMethod: string;
  customer: string;
  description: string;
  reference?: string;
}

interface PaymentMethod {
  id: string;
  type: "card" | "ach" | "wallet";
  label: string;
  last4?: string;
  expiryDate?: string;
  bankName?: string;
  routingNumber?: string;
  isDefault: boolean;
  status: "active" | "inactive" | "expired";
  addedDate: string;
}

interface RefundChargebackCase {
  id: string;
  transactionId: string;
  type: "refund" | "chargeback";
  date: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "denied";
  reason: string;
  customer: string;
  provider: string;
  notes?: string;
}

interface SettlementReport {
  id: string;
  date: string;
  period: string;
  provider: string;
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  netSettlement: number;
  status: "pending" | "settled" | "reconciled";
}

interface ReconciliationIssue {
  id: string;
  date: string;
  type: string;
  amount: number;
  status: "open" | "investigating" | "resolved";
  description: string;
  provider: string;
}

const providers: PaymentProvider[] = [
  {
    id: "stripe",
    name: "Stripe",
    icon: <CreditCard className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-08-15",
    transactions: 3245,
    volume: "$487,230.00",
    fees: "$12,180.75",
    lastSync: "2026-03-12 14:32",
  },
  {
    id: "paypal",
    name: "PayPal",
    icon: <DollarSign className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-09-10",
    transactions: 1876,
    volume: "$245,100.00",
    fees: "$7,350.50",
    lastSync: "2026-03-12 14:28",
  },
  {
    id: "square",
    name: "Square",
    icon: <Activity className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-10-22",
    transactions: 892,
    volume: "$142,500.00",
    fees: "$3,810.00",
    lastSync: "2026-03-12 14:35",
  },
  {
    id: "braintree",
    name: "Braintree",
    icon: <Shield className="w-5 h-5" />,
    status: "disconnected",
    transactions: 0,
    volume: "$0.00",
    fees: "$0.00",
  },
  {
    id: "authorizenet",
    name: "Authorize.Net",
    icon: <Send className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-11-05",
    transactions: 456,
    volume: "$89,200.00",
    fees: "$2,250.00",
    lastSync: "2026-03-12 14:30",
  },
  {
    id: "adyen",
    name: "Adyen",
    icon: <TrendingUp className="w-5 h-5" />,
    status: "error",
    transactions: 234,
    volume: "$34,500.00",
    fees: "$950.00",
    lastSync: "2026-03-11 09:15",
  },
];

const transactions: Transaction[] = [
  {
    id: "txn-001",
    date: "2026-03-12 14:32:15",
    type: "charge",
    amount: 2450.00,
    currency: "USD",
    status: "successful",
    provider: "Stripe",
    paymentMethod: "Visa ending in 4242",
    customer: "Acme Logistics",
    description: "Monthly shipping fees",
    reference: "INV-2026-0001",
  },
  {
    id: "txn-002",
    date: "2026-03-12 13:45:22",
    type: "charge",
    amount: 1850.50,
    currency: "USD",
    status: "successful",
    provider: "PayPal",
    paymentMethod: "PayPal (jane@acme.com)",
    customer: "Express Delivery Co",
    description: "Service charge - Q1 2026",
    reference: "INV-2026-0002",
  },
  {
    id: "txn-003",
    date: "2026-03-12 11:20:45",
    type: "refund",
    amount: 500.00,
    currency: "USD",
    status: "successful",
    provider: "Stripe",
    paymentMethod: "Visa ending in 4242",
    customer: "Transport Plus",
    description: "Partial refund - service adjustment",
    reference: "REF-2026-0001",
  },
  {
    id: "txn-004",
    date: "2026-03-11 16:30:00",
    type: "charge",
    amount: 3200.00,
    currency: "USD",
    status: "pending",
    provider: "Square",
    paymentMethod: "ACH Bank Transfer",
    customer: "National Freight",
    description: "Annual contract payment",
    reference: "INV-2026-0003",
  },
  {
    id: "txn-005",
    date: "2026-03-11 14:15:32",
    type: "charge",
    amount: 750.00,
    currency: "USD",
    status: "failed",
    provider: "Authorize.Net",
    paymentMethod: "Mastercard ending in 5555",
    customer: "Local Delivery",
    description: "Monthly service fee",
    reference: "INV-2026-0004",
  },
];

const paymentMethods: PaymentMethod[] = [
  {
    id: "pm-001",
    type: "card",
    label: "Visa - Corporate Account",
    last4: "4242",
    expiryDate: "12/2027",
    isDefault: true,
    status: "active",
    addedDate: "2025-08-10",
  },
  {
    id: "pm-002",
    type: "card",
    label: "Mastercard - Operations",
    last4: "5555",
    expiryDate: "06/2026",
    isDefault: false,
    status: "active",
    addedDate: "2025-09-15",
  },
  {
    id: "pm-003",
    type: "ach",
    label: "Primary Business Bank",
    bankName: "First National Bank",
    routingNumber: "021000021",
    isDefault: false,
    status: "active",
    addedDate: "2025-10-01",
  },
  {
    id: "pm-004",
    type: "card",
    label: "American Express - Travel",
    last4: "3782",
    expiryDate: "03/2025",
    isDefault: false,
    status: "expired",
    addedDate: "2024-03-15",
  },
  {
    id: "pm-005",
    type: "wallet",
    label: "Digital Wallet - Mobile Pay",
    isDefault: false,
    status: "active",
    addedDate: "2025-11-20",
  },
];

const refundsAndChargebacks: RefundChargebackCase[] = [
  {
    id: "rc-001",
    transactionId: "txn-003",
    type: "refund",
    date: "2026-03-12 11:20",
    amount: 500.00,
    status: "completed",
    reason: "Service adjustment",
    customer: "Transport Plus",
    provider: "Stripe",
    notes: "Customer satisfied with resolution",
  },
  {
    id: "rc-002",
    transactionId: "txn-005",
    type: "chargeback",
    date: "2026-03-09 08:45",
    amount: 750.00,
    status: "pending",
    reason: "Customer disputes charge",
    customer: "Local Delivery",
    provider: "Authorize.Net",
    notes: "Gathering documentation for dispute",
  },
  {
    id: "rc-003",
    transactionId: "txn-2024-0854",
    type: "refund",
    date: "2026-03-08 14:30",
    amount: 1200.00,
    status: "completed",
    reason: "Double charge error",
    customer: "Mid-West Logistics",
    provider: "PayPal",
    notes: "System processing error corrected",
  },
  {
    id: "rc-004",
    transactionId: "txn-2024-0920",
    type: "chargeback",
    date: "2026-02-28 09:15",
    amount: 2100.00,
    status: "investigating",
    reason: "Unauthorized transaction claim",
    customer: "Premium Delivery",
    provider: "Stripe",
    notes: "Requested evidence from customer account",
  },
];

const settlementReports: SettlementReport[] = [
  {
    id: "sett-001",
    date: "2026-03-12",
    period: "2026-03-06 to 2026-03-12",
    provider: "Stripe",
    totalTransactions: 487,
    totalVolume: 98450.00,
    totalFees: 2453.75,
    netSettlement: 95996.25,
    status: "settled",
  },
  {
    id: "sett-002",
    date: "2026-03-12",
    period: "2026-03-06 to 2026-03-12",
    provider: "PayPal",
    totalTransactions: 234,
    totalVolume: 52300.00,
    totalFees: 1570.50,
    netSettlement: 50729.50,
    status: "settled",
  },
  {
    id: "sett-003",
    date: "2026-03-12",
    period: "2026-03-06 to 2026-03-12",
    provider: "Square",
    totalTransactions: 145,
    totalVolume: 31200.00,
    totalFees: 902.50,
    netSettlement: 30297.50,
    status: "reconciled",
  },
  {
    id: "sett-004",
    date: "2026-03-12",
    period: "2026-03-06 to 2026-03-12",
    provider: "Authorize.Net",
    totalTransactions: 78,
    totalVolume: 18900.00,
    totalFees: 450.00,
    netSettlement: 18450.00,
    status: "pending",
  },
];

const reconciliationIssues: ReconciliationIssue[] = [
  {
    id: "recon-001",
    date: "2026-03-10",
    type: "Amount Mismatch",
    amount: 125.50,
    status: "resolved",
    description: "PayPal settlement amount did not match expected total",
    provider: "PayPal",
  },
  {
    id: "recon-002",
    date: "2026-03-09",
    type: "Transaction Discrepancy",
    amount: 250.00,
    status: "investigating",
    description: "Square transaction appears in settlement but not in system",
    provider: "Square",
  },
  {
    id: "recon-003",
    date: "2026-03-08",
    type: "Timing Difference",
    amount: 875.25,
    status: "open",
    description: "Stripe transaction dated 3/8 but settled on 3/10",
    provider: "Stripe",
  },
];

export default function PaymentsPage() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    providers: true,
    transactions: true,
    methods: true,
    refunds: true,
    settlement: true,
    reconciliation: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const totalVolume = providers.reduce((sum, p) => {
    const volume = p.volume?.replace(/[$,]/g, "") || "0";
    return sum + parseFloat(volume);
  }, 0);

  const totalFees = providers.reduce((sum, p) => {
    const fees = p.fees?.replace(/[$,]/g, "") || "0";
    return sum + parseFloat(fees);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="Payment Integrations"
        subtitle="Manage payment processors, transactions, and settlement reconciliation"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/integrations">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-[var(--wl-primary)]/10 to-[var(--wl-primary)]/5 border-[var(--wl-primary)]/30">
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                Total Volume
              </p>
              <p className="text-3xl font-bold text-[var(--wl-primary)] mt-2">
                ${totalVolume.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Across all providers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/30">
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                Total Fees
              </p>
              <p className="text-3xl font-bold text-blue-400 mt-2">
                ${totalFees.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                {((totalFees / totalVolume) * 100).toFixed(2)}% of volume
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30">
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                Connected Providers
              </p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                {providers.filter((p) => p.status === "connected").length}/{providers.length}
              </p>
              <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                Active integrations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Providers Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("providers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Payment Providers
              </h2>
              <Badge variant="primary" className="bg-[var(--wl-primary)]/30 text-[var(--wl-primary)]">
                {providers.filter((p) => p.status === "connected").length} connected
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.providers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:border-[var(--wl-primary)]/50">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-[var(--wl-primary)] text-2xl">{provider.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">
                            {provider.name}
                          </h3>
                          <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                            {provider.status === "connected" && `Connected on ${provider.connectedAt}`}
                            {provider.status === "disconnected" && "Not connected"}
                            {provider.status === "error" && "Connection error"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          provider.status === "connected"
                            ? "success"
                            : provider.status === "error"
                              ? "danger"
                              : "default"
                        }
                        className={cn(
                          provider.status === "connected" && "bg-green-500/20 text-green-400 border border-green-500/50",
                          provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50"
                        )}
                      >
                        {provider.status === "connected" && (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                        {provider.status === "disconnected" && "Disconnected"}
                        {provider.status === "error" && (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Stats Grid */}
                    {provider.status === "connected" && (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-[var(--wl-border)]">
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Txns
                            </p>
                            <p className="text-lg font-bold text-[var(--wl-text-primary)] mt-1">
                              {provider.transactions?.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Volume
                            </p>
                            <p className="text-lg font-bold text-green-400 mt-1">
                              {provider.volume}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Fees
                            </p>
                            <p className="text-lg font-bold text-[var(--wl-text-primary)] mt-1">
                              {provider.fees}
                            </p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                            Last Sync
                          </p>
                          <p className="text-sm text-[var(--wl-text-primary)] mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-green-500" />
                            {provider.lastSync}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {provider.status === "connected" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Configure
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : provider.status === "error" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Transactions Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("transactions")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Recent Transactions
              </h2>
              <Badge variant="info" className="bg-blue-500/20 text-blue-400">
                {transactions.length} transactions
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.transactions ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.transactions && (
            <Card className="bg-[var(--wl-bg-tertiary)]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {transactions.map((txn) => {
                    const statusColor =
                      txn.status === "successful"
                        ? "bg-green-500/20 text-green-400"
                        : txn.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400";
                    return (
                      <div
                        key={txn.id}
                        className="flex items-start justify-between p-4 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)] hover:border-[var(--wl-primary)]/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-[var(--wl-text-primary)] capitalize">
                              {txn.type}
                            </h4>
                            <Badge variant="default" className="text-xs font-mono">
                              {txn.provider}
                            </Badge>
                            <Badge variant="secondary" className={cn("text-xs capitalize", statusColor)}>
                              {txn.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-[var(--wl-text-secondary)] mb-1">
                            {txn.customer} • {txn.description}
                          </p>
                          <p className="text-xs text-[var(--wl-text-tertiary)]">
                            {txn.paymentMethod} • {txn.date}
                          </p>
                          {txn.reference && (
                            <p className="text-xs text-[var(--wl-text-tertiary)] mt-1 font-mono">
                              Ref: {txn.reference}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className={cn(
                            "text-lg font-bold",
                            txn.type === "refund" ? "text-red-400" : "text-green-400"
                          )}>
                            {txn.type === "refund" ? "-" : ""}{txn.amount.toFixed(2)} {txn.currency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment Methods Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("methods")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Payment Methods
              </h2>
              <Badge variant="default" className="bg-[var(--wl-bg-secondary)]">
                {paymentMethods.filter((m) => m.status === "active").length} active
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.methods ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.methods && (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <Card key={method.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-[var(--wl-bg-secondary)] flex items-center justify-center text-[var(--wl-primary)]">
                          {method.type === "card" && <CreditCard className="w-6 h-6" />}
                          {method.type === "ach" && <DollarSign className="w-6 h-6" />}
                          {method.type === "wallet" && <Activity className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--wl-text-primary)]">
                            {method.label}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {method.type === "card" && (
                              <>
                                <p className="text-sm text-[var(--wl-text-tertiary)]">
                                  •••• {method.last4}
                                </p>
                                <span className="text-xs text-[var(--wl-text-tertiary)]">
                                  Expires {method.expiryDate}
                                </span>
                              </>
                            )}
                            {method.type === "ach" && (
                              <p className="text-sm text-[var(--wl-text-tertiary)]">
                                {method.bankName} • {method.routingNumber}
                              </p>
                            )}
                            {method.type === "wallet" && (
                              <p className="text-sm text-[var(--wl-text-tertiary)]">
                                Added {method.addedDate}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          {method.isDefault && (
                            <Badge variant="success" className="bg-green-500/20 text-green-400 mb-2">
                              Default
                            </Badge>
                          )}
                          <Badge
                            variant={method.status === "active" ? "success" : "danger"}
                            className={cn(
                              method.status === "active"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {method.status}
                          </Badge>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="primary"
                className="w-full bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          )}
        </div>

        {/* Refunds & Chargebacks Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("refunds")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Refunds & Chargebacks
              </h2>
              <Badge variant="warning" className="bg-yellow-500/20 text-yellow-400">
                {refundsAndChargebacks.filter((r) => r.status === "pending" || r.status === "investigating").length} pending
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.refunds ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.refunds && (
            <div className="space-y-4">
              {refundsAndChargebacks.map((case_) => (
                <Card key={case_.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-[var(--wl-text-primary)] capitalize">
                            {case_.type}
                          </h3>
                          <Badge
                            variant={case_.type === "refund" ? "success" : "danger"}
                            className={cn(
                              "text-xs",
                              case_.type === "refund" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {case_.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-[var(--wl-text-tertiary)]">
                          {case_.customer} • {case_.date}
                        </p>
                        <p className="text-xs text-[var(--wl-text-tertiary)] mt-1 font-mono">
                          Txn: {case_.transactionId}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-red-400 mb-2">
                          -${case_.amount.toFixed(2)}
                        </p>
                        <Badge
                          variant={case_.status === "completed" ? "success" : case_.status === "pending" ? "warning" : "default"}
                          className={cn(
                            "text-xs capitalize",
                            case_.status === "completed" && "bg-green-500/20 text-green-400",
                            case_.status === "pending" && "bg-yellow-500/20 text-yellow-400",
                            case_.status === "investigating" && "bg-blue-500/20 text-blue-400"
                          )}
                        >
                          {case_.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="mb-4 pb-4 border-b border-[var(--wl-border)]">
                      <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-2">
                        Reason
                      </p>
                      <p className="text-sm text-[var(--wl-text-primary)]">{case_.reason}</p>
                      {case_.notes && (
                        <p className="text-xs text-[var(--wl-text-tertiary)] mt-2 italic">
                          Note: {case_.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                      {case_.status === "pending" || case_.status === "investigating" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        >
                          Respond
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Settlement Reports Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("settlement")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Settlement Reports
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                Week of Mar 6
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.settlement ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.settlement && (
            <div className="space-y-4">
              {settlementReports.map((report) => (
                <Card key={report.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-[var(--wl-text-primary)]">
                          {report.provider}
                        </h3>
                        <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                          {report.period}
                        </p>
                      </div>
                      <Badge
                        variant={report.status === "reconciled" ? "success" : report.status === "settled" ? "info" : "default"}
                        className={cn(
                          "capitalize",
                          report.status === "reconciled" && "bg-green-500/20 text-green-400",
                          report.status === "settled" && "bg-blue-500/20 text-blue-400"
                        )}
                      >
                        {report.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4 pb-4 border-b border-[var(--wl-border)]">
                      <div>
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Txns
                        </p>
                        <p className="text-lg font-bold text-[var(--wl-text-primary)] mt-1">
                          {report.totalTransactions}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Volume
                        </p>
                        <p className="text-lg font-bold text-green-400 mt-1">
                          ${report.totalVolume.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Fees
                        </p>
                        <p className="text-lg font-bold text-[var(--wl-text-primary)] mt-1">
                          ${report.totalFees.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Net
                        </p>
                        <p className="text-lg font-bold text-[var(--wl-primary)] mt-1">
                          ${report.netSettlement.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Reconciliation Issues Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("reconciliation")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Reconciliation Issues
              </h2>
              <Badge variant="warning" className="bg-yellow-500/20 text-yellow-400">
                {reconciliationIssues.filter((r) => r.status !== "resolved").length} open
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.reconciliation ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.reconciliation && (
            <div className="space-y-4">
              {reconciliationIssues.map((issue) => (
                <Card key={issue.id} className={cn(
                  "bg-[var(--wl-bg-tertiary)]",
                  issue.status === "open" && "border-yellow-500/50"
                )}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[var(--wl-text-primary)]">
                          {issue.type}
                        </h3>
                        <p className="text-sm text-[var(--wl-text-secondary)] mt-1">
                          {issue.description}
                        </p>
                        <p className="text-xs text-[var(--wl-text-tertiary)] mt-2">
                          {issue.provider} • {issue.date}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-[var(--wl-primary)] mb-2">
                          ${issue.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                        <Badge
                          variant={issue.status === "resolved" ? "success" : issue.status === "investigating" ? "info" : "warning"}
                          className={cn(
                            "capitalize",
                            issue.status === "resolved" && "bg-green-500/20 text-green-400",
                            issue.status === "investigating" && "bg-blue-500/20 text-blue-400",
                            issue.status === "open" && "bg-yellow-500/20 text-yellow-400"
                          )}
                        >
                          {issue.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Investigate
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
