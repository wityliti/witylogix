/**
 * usePOS — Point of Sale management hooks.
 * Provides data for POS overview, transactions, terminals, and sales trends.
 */

import { useEffect, useState, useCallback } from "react";

/**
 * Transaction status enum
 */
export type TransactionStatus = "completed" | "pending" | "refunded" | "cancelled" | "failed";
export type PaymentMethod = "cash" | "card" | "mobile" | "check" | "gift_card";

/**
 * Terminal status enum
 */
export type TerminalStatus = "online" | "offline" | "error";

/**
 * Transaction data structure
 */
export interface Transaction {
  id: string;
  transactionId: string;
  terminalId: string;
  terminalName: string;
  timestamp: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  tax: number;
  discount: number;
  subtotal: number;
  items: TransactionItem[];
  customerName?: string;
  customerEmail?: string;
  receiptNumber: string;
  notes?: string;
  refundedAmount?: number;
  refundReason?: string;
}

/**
 * Transaction item
 */
export interface TransactionItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: string;
}

/**
 * POS Terminal data structure
 */
export interface POSTerminal {
  id: string;
  name: string;
  location: string;
  status: TerminalStatus;
  lastActivity: string;
  totalTransactions: number;
  totalSales: number;
  operatingHours?: { open: string; close: string };
  currentShift?: string;
}

/**
 * POS overview metrics
 */
export interface POSOverview {
  todaysSales: number;
  transactionCount: number;
  avgTicket: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    mobile: number;
    other: number;
  };
}

/**
 * Sales trend data
 */
export interface SalesTrend {
  date: string;
  daily: number;
  weekly: number;
  monthly: number;
  transactions: number;
}

/**
 * Top-selling item
 */
export interface TopSellingItem {
  id: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  category: string;
}

/**
 * Mock data
 */
const TERMINALS: POSTerminal[] = [
  {
    id: "term-1",
    name: "Register 1 - Front Counter",
    location: "Main Entrance",
    status: "online",
    lastActivity: "now",
    totalTransactions: 47,
    totalSales: 2450.23,
    currentShift: "Sarah",
  },
  {
    id: "term-2",
    name: "Register 2 - Checkout",
    location: "Main Counter",
    status: "online",
    lastActivity: "5m ago",
    totalTransactions: 52,
    totalSales: 2850.45,
    currentShift: "Mike",
  },
  {
    id: "term-3",
    name: "Register 3 - VIP",
    location: "VIP Lounge",
    status: "offline",
    lastActivity: "2h ago",
    totalTransactions: 12,
    totalSales: 1250.00,
  },
  {
    id: "term-4",
    name: "Self-Checkout 1",
    location: "Exit Area",
    status: "online",
    lastActivity: "now",
    totalTransactions: 38,
    totalSales: 1680.50,
  },
];

const TRANSACTIONS: Transaction[] = [
  {
    id: "txn-1",
    transactionId: "TXN-20240317-001",
    terminalId: "term-1",
    terminalName: "Register 1",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    status: "completed",
    paymentMethod: "card",
    amount: 245.50,
    tax: 19.64,
    discount: 0,
    subtotal: 225.86,
    items: [
      { id: "item-1", name: "Wireless Headphones", sku: "WH-001", quantity: 1, unitPrice: 99.99, totalPrice: 99.99, category: "Electronics" },
      { id: "item-2", name: "Phone Case", sku: "PC-105", quantity: 2, unitPrice: 19.99, totalPrice: 39.98, category: "Accessories" },
      { id: "item-3", name: "Screen Protector", sku: "SP-202", quantity: 2, unitPrice: 9.99, totalPrice: 19.98, category: "Accessories" },
    ],
    receiptNumber: "RCP-20240317-001",
    customerName: "John Smith",
    customerEmail: "john@example.com",
  },
  {
    id: "txn-2",
    transactionId: "TXN-20240317-002",
    terminalId: "term-2",
    terminalName: "Register 2",
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    status: "completed",
    paymentMethod: "cash",
    amount: 89.99,
    tax: 7.20,
    discount: 0,
    subtotal: 82.79,
    items: [
      { id: "item-4", name: "USB Cable", sku: "USB-001", quantity: 3, unitPrice: 19.99, totalPrice: 59.97, category: "Cables" },
      { id: "item-5", name: "Power Bank", sku: "PB-050", quantity: 1, unitPrice: 22.99, totalPrice: 22.99, category: "Electronics" },
    ],
    receiptNumber: "RCP-20240317-002",
  },
  {
    id: "txn-3",
    transactionId: "TXN-20240317-003",
    terminalId: "term-4",
    terminalName: "Self-Checkout 1",
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    status: "completed",
    paymentMethod: "mobile",
    amount: 156.75,
    tax: 12.54,
    discount: 10.0,
    subtotal: 144.21,
    items: [
      { id: "item-6", name: "Bluetooth Speaker", sku: "BS-100", quantity: 1, unitPrice: 129.99, totalPrice: 129.99, category: "Electronics" },
      { id: "item-7", name: "Batteries (AA)", sku: "BAT-AA", quantity: 1, unitPrice: 8.99, totalPrice: 8.99, category: "Supplies" },
    ],
    receiptNumber: "RCP-20240317-003",
    customerName: "Emily Johnson",
  },
  {
    id: "txn-4",
    transactionId: "TXN-20240317-004",
    terminalId: "term-1",
    terminalName: "Register 1",
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    status: "refunded",
    paymentMethod: "card",
    amount: 0,
    tax: 0,
    discount: 0,
    subtotal: 0,
    items: [],
    receiptNumber: "RCP-20240317-004",
    refundedAmount: 199.99,
    refundReason: "Defective product",
  },
  {
    id: "txn-5",
    transactionId: "TXN-20240317-005",
    terminalId: "term-2",
    terminalName: "Register 2",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    status: "completed",
    paymentMethod: "card",
    amount: 567.89,
    tax: 45.43,
    discount: 20.0,
    subtotal: 522.46,
    items: [
      { id: "item-8", name: "Laptop Stand", sku: "LS-200", quantity: 1, unitPrice: 179.99, totalPrice: 179.99, category: "Office" },
      { id: "item-9", name: "Mechanical Keyboard", sku: "KB-MEC", quantity: 1, unitPrice: 189.99, totalPrice: 189.99, category: "Electronics" },
      { id: "item-10", name: "Mouse Pad", sku: "MP-XL", quantity: 1, unitPrice: 29.99, totalPrice: 29.99, category: "Accessories" },
      { id: "item-11", name: "USB Hub", sku: "HUB-USB", quantity: 1, unitPrice: 49.99, totalPrice: 49.99, category: "Electronics" },
    ],
    receiptNumber: "RCP-20240317-005",
    customerName: "Robert Wilson",
  },
];

const TOP_ITEMS: TopSellingItem[] = [
  { id: "item-1", name: "Wireless Headphones", sku: "WH-001", unitsSold: 24, revenue: 2399.76, category: "Electronics" },
  { id: "item-4", name: "USB Cable", sku: "USB-001", unitsSold: 67, revenue: 1339.33, category: "Cables" },
  { id: "item-6", name: "Bluetooth Speaker", sku: "BS-100", unitsSold: 18, revenue: 2339.82, category: "Electronics" },
  { id: "item-8", name: "Laptop Stand", sku: "LS-200", unitsSold: 12, revenue: 2159.88, category: "Office" },
  { id: "item-9", name: "Mechanical Keyboard", sku: "KB-MEC", unitsSold: 15, revenue: 2849.85, category: "Electronics" },
];

/**
 * Hook: usePOSOverview
 * Returns POS overview metrics for today
 */
export function usePOSOverview(): POSOverview & { isLoading: boolean } {
  const [overview, setOverview] = useState<POSOverview & { isLoading: boolean }>({
    todaysSales: 0,
    transactionCount: 0,
    avgTicket: 0,
    paymentBreakdown: { cash: 0, card: 0, mobile: 0, other: 0 },
    isLoading: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const totalSales = TRANSACTIONS.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.amount, 0);
      const completedTxns = TRANSACTIONS.filter((t) => t.status === "completed");

      const breakdown = {
        cash: completedTxns
          .filter((t) => t.paymentMethod === "cash")
          .reduce((sum, t) => sum + t.amount, 0),
        card: completedTxns
          .filter((t) => t.paymentMethod === "card")
          .reduce((sum, t) => sum + t.amount, 0),
        mobile: completedTxns
          .filter((t) => t.paymentMethod === "mobile")
          .reduce((sum, t) => sum + t.amount, 0),
        other: completedTxns
          .filter((t) => !["cash", "card", "mobile"].includes(t.paymentMethod))
          .reduce((sum, t) => sum + t.amount, 0),
      };

      setOverview({
        todaysSales: totalSales,
        transactionCount: completedTxns.length,
        avgTicket: completedTxns.length > 0 ? totalSales / completedTxns.length : 0,
        paymentBreakdown: breakdown,
        isLoading: false,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return overview;
}

/**
 * Hook: useTransactions
 * Returns filtered transactions
 */
export function useTransactions(
  filters?: {
    dateRange?: { start: string; end: string };
    paymentType?: PaymentMethod;
    terminalId?: string;
    amountRange?: { min: number; max: number };
    status?: TransactionStatus;
    searchTerm?: string;
  }
): { transactions: Transaction[]; total: number; isLoading: boolean } {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      let result = [...TRANSACTIONS];

      if (filters?.status) {
        result = result.filter((t) => t.status === filters.status);
      }

      if (filters?.paymentType) {
        result = result.filter((t) => t.paymentMethod === filters.paymentType);
      }

      if (filters?.terminalId) {
        result = result.filter((t) => t.terminalId === filters.terminalId);
      }

      if (filters?.amountRange) {
        result = result.filter((t) => t.amount >= filters.amountRange!.min && t.amount <= filters.amountRange!.max);
      }

      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        result = result.filter(
          (t) =>
            t.transactionId.toLowerCase().includes(term) ||
            t.customerName?.toLowerCase().includes(term) ||
            t.receiptNumber.toLowerCase().includes(term)
        );
      }

      setTransactions(result);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [filters]);

  return { transactions, total: transactions.length, isLoading };
}

/**
 * Hook: useTerminals
 * Returns POS terminal status
 */
export function useTerminals(): { terminals: POSTerminal[]; isLoading: boolean } {
  const [terminals, setTerminals] = useState<POSTerminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerminals(TERMINALS);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return { terminals, isLoading };
}

/**
 * Hook: useSalesTrends
 * Returns sales trend data for charts
 */
export function useSalesTrends(period: "daily" | "weekly" | "monthly" = "daily"): {
  trends: SalesTrend[];
  isLoading: boolean;
} {
  const [trends, setTrends] = useState<SalesTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const data: SalesTrend[] = [];

      if (period === "daily") {
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          data.push({
            date: date.toLocaleDateString(),
            daily: Math.random() * 5000 + 2000,
            weekly: 0,
            monthly: 0,
            transactions: Math.floor(Math.random() * 100 + 30),
          });
        }
      } else if (period === "weekly") {
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i * 7);
          data.push({
            date: `Week of ${date.toLocaleDateString()}`,
            daily: 0,
            weekly: Math.random() * 35000 + 15000,
            monthly: 0,
            transactions: Math.floor(Math.random() * 800 + 200),
          });
        }
      } else {
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          data.push({
            date: date.toLocaleDateString("default", { month: "short", year: "numeric" }),
            daily: 0,
            weekly: 0,
            monthly: Math.random() * 150000 + 50000,
            transactions: Math.floor(Math.random() * 3000 + 800),
          });
        }
      }

      setTrends(data);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [period]);

  return { trends, isLoading };
}

/**
 * Hook: useTopSellingItems
 * Returns top-selling items
 */
export function useTopSellingItems(): { items: TopSellingItem[]; isLoading: boolean } {
  const [items, setItems] = useState<TopSellingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(TOP_ITEMS);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return { items, isLoading };
}

/**
 * Hook: useTransactionDetail
 * Returns detailed transaction data
 */
export function useTransactionDetail(txnId: string): { transaction: Transaction | null; isLoading: boolean } {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const found = TRANSACTIONS.find((t) => t.id === txnId);
      setTransaction(found || null);
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [txnId]);

  return { transaction, isLoading };
}

/**
 * Hook: useRefundTransaction
 * Handles refund operations
 */
export function useRefundTransaction(): {
  refund: (txnId: string, reason: string) => Promise<boolean>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  const refund = useCallback(async (txnId: string, reason: string) => {
    setIsLoading(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock refund logic
        const txn = TRANSACTIONS.find((t) => t.id === txnId);
        if (txn) {
          txn.status = "refunded";
          txn.refundedAmount = txn.amount;
          txn.refundReason = reason;
        }
        setIsLoading(false);
        resolve(true);
      }, 500);
    });
  }, []);

  return { refund, isLoading };
}

/**
 * Hook: useExportTransactions
 * Exports transactions to CSV or PDF
 */
export function useExportTransactions(): {
  export: (transactions: Transaction[], format: "csv" | "pdf") => Promise<Blob>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);

  const exportData = useCallback(async (transactions: Transaction[], format: "csv" | "pdf") => {
    setIsLoading(true);
    return new Promise<Blob>((resolve) => {
      setTimeout(() => {
        let content = "";

        if (format === "csv") {
          // CSV header
          content = "Transaction ID,Receipt #,Terminal,Amount,Tax,Payment Method,Status,Customer,Date\n";
          // CSV rows
          transactions.forEach((t) => {
            content += `${t.transactionId},${t.receiptNumber},${t.terminalName},${t.amount.toFixed(2)},${t.tax.toFixed(2)},${t.paymentMethod},${t.status},${t.customerName || "N/A"},${new Date(t.timestamp).toLocaleDateString()}\n`;
          });
        } else {
          // PDF simulation (in real app, would use a PDF library)
          content = `POS TRANSACTION EXPORT\n${new Date().toLocaleDateString()}\n\n`;
          transactions.forEach((t) => {
            content += `${t.transactionId} - ${t.customerName || "N/A"} - $${t.amount.toFixed(2)}\n`;
          });
        }

        const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/pdf" });
        setIsLoading(false);
        resolve(blob);
      }, 1000);
    });
  }, []);

  return { export: exportData, isLoading };
}
