"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Search, X, ChevronRight, Clock } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   RETURNS MANAGEMENT PAGE — Full return lifecycle with
   multi-status workflow, filtering, and detail viewing
   ═══════════════════════════════════════════════════════════ */

type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "inspected" | "refunded";

interface ReturnItem {
  id: string;
  name: string;
  quantity: number;
  condition: "good" | "damaged" | "defective";
}

interface ReturnRecord {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: ReturnStatus;
  reason: string;
  items: ReturnItem[];
  refundAmount: number;
  createdAt: string;
  requestedAt: string;
  approvedAt?: string;
  receivedAt?: string;
  inspectedAt?: string;
  refundedAt?: string;
  notes: string;
  timeline: Array<{
    timestamp: string;
    status: ReturnStatus;
    notes: string;
  }>;
}

// Mock returns data with varied statuses
const MOCK_RETURNS: ReturnRecord[] = [
  {
    id: "RET-2024-001",
    orderId: "ORD-2024-115",
    customerId: "CUST-001",
    customerName: "John Smith",
    customerEmail: "john.smith@email.com",
    status: "requested",
    reason: "Product arrived damaged",
    items: [
      { id: "I-1", name: "Blue Wireless Headphones", quantity: 1, condition: "damaged" },
    ],
    refundAmount: 89.99,
    createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    notes: "Customer reports broken cable connector",
    timeline: [
      { timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
    ],
  },
  {
    id: "RET-2024-002",
    orderId: "ORD-2024-114",
    customerId: "CUST-002",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@email.com",
    status: "approved",
    reason: "Wrong size",
    items: [
      { id: "I-2", name: "Wool Winter Jacket (L)", quantity: 1, condition: "good" },
    ],
    refundAmount: 159.99,
    createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    notes: "Customer ordered size L but needed M. Approved for return.",
    timeline: [
      { timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 4 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved - full refund authorized" },
    ],
  },
  {
    id: "RET-2024-003",
    orderId: "ORD-2024-113",
    customerId: "CUST-003",
    customerName: "Emily Davis",
    customerEmail: "emily.davis@email.com",
    status: "received",
    reason: "Defective unit",
    items: [
      { id: "I-3", name: "Portable Phone Charger 20K", quantity: 2, condition: "defective" },
    ],
    refundAmount: 119.98,
    createdAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Units won't charge. Return label provided. Package received on 3/17.",
    timeline: [
      { timestamp: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 6 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), status: "received", notes: "Return package received and logged" },
    ],
  },
  {
    id: "RET-2024-004",
    orderId: "ORD-2024-112",
    customerId: "CUST-004",
    customerName: "Michael Brown",
    customerEmail: "m.brown@email.com",
    status: "inspected",
    reason: "Changed mind",
    items: [
      { id: "I-4", name: "Ergonomic Office Chair", quantity: 1, condition: "good" },
    ],
    refundAmount: 249.99,
    createdAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    inspectedAt: new Date(Date.now() - 6 * 60000).toISOString(),
    notes: "Item in excellent condition, 10% restocking fee applied.",
    timeline: [
      { timestamp: new Date(Date.now() - 10 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 9 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), status: "received", notes: "Return received and inspected" },
      { timestamp: new Date(Date.now() - 6 * 60000).toISOString(), status: "inspected", notes: "Inspection complete - ready for refund" },
    ],
  },
  {
    id: "RET-2024-005",
    orderId: "ORD-2024-111",
    customerId: "CUST-005",
    customerName: "Lisa Wilson",
    customerEmail: "lisa.w@email.com",
    status: "refunded",
    reason: "Not as described",
    items: [
      { id: "I-5", name: "Stainless Steel Water Bottle", quantity: 3, condition: "good" },
    ],
    refundAmount: 74.97,
    createdAt: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 13 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
    inspectedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    refundedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Refund issued successfully. Customer notified.",
    timeline: [
      { timestamp: new Date(Date.now() - 14 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 13 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 8 * 24 * 3600000).toISOString(), status: "received", notes: "Return received" },
      { timestamp: new Date(Date.now() - 4 * 24 * 3600000).toISOString(), status: "inspected", notes: "Inspection passed" },
      { timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), status: "refunded", notes: "Refund processed to original method" },
    ],
  },
  {
    id: "RET-2024-006",
    orderId: "ORD-2024-110",
    customerId: "CUST-006",
    customerName: "Robert Taylor",
    customerEmail: "r.taylor@email.com",
    status: "requested",
    reason: "Duplicate order",
    items: [
      { id: "I-6", name: "Wireless Mouse", quantity: 1, condition: "good" },
      { id: "I-7", name: "USB-C Cable", quantity: 2, condition: "good" },
    ],
    refundAmount: 45.98,
    createdAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Customer accidentally placed duplicate order",
    timeline: [
      { timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
    ],
  },
  {
    id: "RET-2024-007",
    orderId: "ORD-2024-109",
    customerId: "CUST-007",
    customerName: "Jennifer Anderson",
    customerEmail: "j.anderson@email.com",
    status: "rejected",
    reason: "Out of return window",
    items: [
      { id: "I-8", name: "Leather Wallet", quantity: 1, condition: "good" },
    ],
    refundAmount: 0,
    createdAt: new Date(Date.now() - 45 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 45 * 24 * 3600000).toISOString(),
    notes: "Return requested 45 days after purchase. 30-day return window expired.",
    timeline: [
      { timestamp: new Date(Date.now() - 45 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 44 * 24 * 3600000).toISOString(), status: "rejected", notes: "Return denied - outside return period" },
    ],
  },
  {
    id: "RET-2024-008",
    orderId: "ORD-2024-108",
    customerId: "CUST-008",
    customerName: "David Martinez",
    customerEmail: "d.martinez@email.com",
    status: "approved",
    reason: "Color mismatch",
    items: [
      { id: "I-9", name: "Cotton T-Shirt (Blue)", quantity: 2, condition: "good" },
    ],
    refundAmount: 39.98,
    createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    notes: "Website showed blue, but received black. Return approved.",
    timeline: [
      { timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved with prepaid label" },
    ],
  },
  {
    id: "RET-2024-009",
    orderId: "ORD-2024-107",
    customerId: "CUST-009",
    customerName: "Amanda White",
    customerEmail: "a.white@email.com",
    status: "received",
    reason: "Size too large",
    items: [
      { id: "I-10", name: "Denim Jeans (36W)", quantity: 1, condition: "good" },
    ],
    refundAmount: 69.99,
    createdAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    notes: "Package received on 3/16. Awaiting inspection.",
    timeline: [
      { timestamp: new Date(Date.now() - 6 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(), status: "received", notes: "Return received at warehouse" },
    ],
  },
  {
    id: "RET-2024-010",
    orderId: "ORD-2024-106",
    customerId: "CUST-010",
    customerName: "Christopher Lee",
    customerEmail: "c.lee@email.com",
    status: "refunded",
    reason: "Defective unit",
    items: [
      { id: "I-11", name: "Gaming Laptop Stand", quantity: 1, condition: "defective" },
    ],
    refundAmount: 129.99,
    createdAt: new Date(Date.now() - 21 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 21 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 20 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 12 * 24 * 3600000).toISOString(),
    inspectedAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
    refundedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    notes: "Full refund issued. Defective unit was unsaleable.",
    timeline: [
      { timestamp: new Date(Date.now() - 21 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 20 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 12 * 24 * 3600000).toISOString(), status: "received", notes: "Return received" },
      { timestamp: new Date(Date.now() - 8 * 24 * 3600000).toISOString(), status: "inspected", notes: "Unit confirmed defective" },
      { timestamp: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), status: "refunded", notes: "Full refund processed" },
    ],
  },
  {
    id: "RET-2024-011",
    orderId: "ORD-2024-105",
    customerId: "CUST-011",
    customerName: "Michelle Garcia",
    customerEmail: "m.garcia@email.com",
    status: "requested",
    reason: "Item stopped working",
    items: [
      { id: "I-12", name: "Bluetooth Speaker", quantity: 1, condition: "defective" },
    ],
    refundAmount: 99.99,
    createdAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    notes: "Customer reports speaker not turning on after 2 weeks of use",
    timeline: [
      { timestamp: new Date(Date.now() - 4 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
    ],
  },
  {
    id: "RET-2024-012",
    orderId: "ORD-2024-104",
    customerId: "CUST-012",
    customerName: "Daniel Rodriguez",
    customerEmail: "d.rodriguez@email.com",
    status: "approved",
    reason: "Different expectations",
    items: [
      { id: "I-13", name: "Yoga Mat", quantity: 1, condition: "good" },
    ],
    refundAmount: 34.99,
    createdAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    notes: "Customer expected thicker mat. Return approved for store credit.",
    timeline: [
      { timestamp: new Date(Date.now() - 8 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved - awaiting shipment" },
    ],
  },
  {
    id: "RET-2024-013",
    orderId: "ORD-2024-103",
    customerId: "CUST-013",
    customerName: "Jessica Thompson",
    customerEmail: "j.thompson@email.com",
    status: "inspected",
    reason: "Wrong item shipped",
    items: [
      { id: "I-14", name: "Coffee Maker", quantity: 1, condition: "good" },
    ],
    refundAmount: 149.99,
    createdAt: new Date(Date.now() - 12 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 12 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 11 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    inspectedAt: new Date(Date.now() - 3 * 60000).toISOString(),
    notes: "Received wrong model. Inspection confirms it's unopened and resaleable.",
    timeline: [
      { timestamp: new Date(Date.now() - 12 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 11 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 4 * 24 * 3600000).toISOString(), status: "received", notes: "Return received" },
      { timestamp: new Date(Date.now() - 3 * 60000).toISOString(), status: "inspected", notes: "Inspection passed - item resaleable" },
    ],
  },
  {
    id: "RET-2024-014",
    orderId: "ORD-2024-102",
    customerId: "CUST-014",
    customerName: "Mark Johnson",
    customerEmail: "m.johnson@email.com",
    status: "refunded",
    reason: "Part of order",
    items: [
      { id: "I-15", name: "USB Hub", quantity: 1, condition: "good" },
    ],
    refundAmount: 29.99,
    createdAt: new Date(Date.now() - 28 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 28 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 27 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 18 * 24 * 3600000).toISOString(),
    inspectedAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
    refundedAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    notes: "Returned as part of partial order return",
    timeline: [
      { timestamp: new Date(Date.now() - 28 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 27 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 18 * 24 * 3600000).toISOString(), status: "received", notes: "Return received" },
      { timestamp: new Date(Date.now() - 10 * 24 * 3600000).toISOString(), status: "inspected", notes: "Inspection complete" },
      { timestamp: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), status: "refunded", notes: "Refund processed" },
    ],
  },
  {
    id: "RET-2024-015",
    orderId: "ORD-2024-101",
    customerId: "CUST-015",
    customerName: "Karen Wilson",
    customerEmail: "k.wilson@email.com",
    status: "received",
    reason: "Quality concerns",
    items: [
      { id: "I-16", name: "Bed Sheets Set", quantity: 1, condition: "damaged" },
    ],
    refundAmount: 49.99,
    createdAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
    requestedAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString(),
    approvedAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
    receivedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
    notes: "Package received 3/17. Awaiting quality inspection.",
    timeline: [
      { timestamp: new Date(Date.now() - 9 * 24 * 3600000).toISOString(), status: "requested", notes: "Return requested" },
      { timestamp: new Date(Date.now() - 8 * 24 * 3600000).toISOString(), status: "approved", notes: "Return approved" },
      { timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), status: "received", notes: "Return received at warehouse" },
    ],
  },
];

const STATUS_CONFIG: Record<ReturnStatus, { badge: string; color: "default" | "success" | "warning" | "danger" | "info" | "primary"; label: string }> = {
  requested: { badge: "Requested", color: "info", label: "Pending Review" },
  approved: { badge: "Approved", color: "primary", label: "Return Approved" },
  rejected: { badge: "Rejected", color: "danger", label: "Return Denied" },
  received: { badge: "Received", color: "warning", label: "Awaiting Inspection" },
  inspected: { badge: "Inspected", color: "default", label: "Ready for Refund" },
  refunded: { badge: "Refunded", color: "success", label: "Refund Processed" },
};

export default function ReturnsPage() {
  const [filterStatus, setFilterStatus] = useState<ReturnStatus | "all">("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "7days" | "30days" | "90days">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Filter returns
  const filteredReturns = useMemo(() => {
    return MOCK_RETURNS.filter((ret) => {
      // Status filter
      if (filterStatus !== "all" && ret.status !== filterStatus) {
        return false;
      }

      // Date range filter
      const createdDate = new Date(ret.createdAt);
      const now = new Date();
      const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

      if (filterDateRange === "7days" && daysDiff > 7) return false;
      if (filterDateRange === "30days" && daysDiff > 30) return false;
      if (filterDateRange === "90days" && daysDiff > 90) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          ret.id.toLowerCase().includes(query) ||
          ret.orderId.toLowerCase().includes(query) ||
          ret.customerName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [filterStatus, filterDateRange, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate stats
  const stats = useMemo(() => {
    return {
      totalReturns: MOCK_RETURNS.length,
      pendingApproval: MOCK_RETURNS.filter((r) => r.status === "requested").length,
      awaitingReceipt: MOCK_RETURNS.filter((r) => r.status === "approved").length,
      refunded: MOCK_RETURNS.filter((r) => r.status === "refunded").length,
      totalRefundAmount: MOCK_RETURNS.filter((r) => r.status === "refunded").reduce((sum, r) => sum + r.refundAmount, 0),
    };
  }, []);

  // Handle action buttons
  const handleApprove = async (returnId: string) => {
    setProcessingId(returnId);
    setTimeout(() => {
      setProcessingId(null);
      alert("Return approved successfully!");
    }, 800);
  };

  const handleReject = async (returnId: string) => {
    setProcessingId(returnId);
    setTimeout(() => {
      setProcessingId(null);
      alert("Return rejected successfully!");
    }, 800);
  };

  const handleMarkReceived = async (returnId: string) => {
    setProcessingId(returnId);
    setTimeout(() => {
      setProcessingId(null);
      alert("Return marked as received!");
    }, 800);
  };

  const handleInspect = async (returnId: string) => {
    setProcessingId(returnId);
    setTimeout(() => {
      setProcessingId(null);
      alert("Return inspected and ready for refund!");
    }, 800);
  };

  const handleProcessRefund = async (returnId: string) => {
    setProcessingId(returnId);
    setTimeout(() => {
      setProcessingId(null);
      alert("Refund processed successfully!");
    }, 800);
  };

  // Get action buttons for each status
  const getActionButtons = (ret: ReturnRecord) => {
    const isProcessing = processingId === ret.id;

    switch (ret.status) {
      case "requested":
        return (
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleApprove(ret.id)}
              disabled={isProcessing}
            >
              {isProcessing ? "⟳" : "✓"} Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleReject(ret.id)}
              disabled={isProcessing}
            >
              {isProcessing ? "⟳" : "✕"} Reject
            </Button>
          </div>
        );
      case "approved":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleMarkReceived(ret.id)}
            disabled={isProcessing}
          >
            {isProcessing ? "⟳" : "→"} Mark Received
          </Button>
        );
      case "received":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleInspect(ret.id)}
            disabled={isProcessing}
          >
            {isProcessing ? "⟳" : "🔍"} Inspect
          </Button>
        );
      case "inspected":
        return (
          <Button
            variant="success"
            size="sm"
            onClick={() => handleProcessRefund(ret.id)}
            disabled={isProcessing}
          >
            {isProcessing ? "⟳" : "$"} Process Refund
          </Button>
        );
      default:
        return (
          <Button variant="secondary" size="sm" disabled>
            No Actions
          </Button>
        );
    }
  };

  const headerActions = (
    <div className="flex gap-2">
      <Button variant="secondary" size="md">
        📊 Export
      </Button>
      <Button variant="primary" size="md">
        + New Return
      </Button>
    </div>
  );

  return (
    <>
      <Header
        title="Returns Management"
        subtitle={`${filteredReturns.length} returns • ${stats.pendingApproval} pending approval`}
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Total Returns
            </div>
            <div className="text-3xl font-bold font-mono text-wl-text-primary">
              {stats.totalReturns}
            </div>
            <div className="text-xs text-wl-text-secondary mt-1">
              all time
            </div>
          </Card>

          <Card className="p-4 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Pending Approval
            </div>
            <div className="text-3xl font-bold font-mono text-wl-text-primary">
              {stats.pendingApproval}
            </div>
            <div className="text-xs text-wl-text-secondary mt-1">
              needs review
            </div>
          </Card>

          <Card className="p-4 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Awaiting Receipt
            </div>
            <div className="text-3xl font-bold font-mono text-wl-text-primary">
              {stats.awaitingReceipt}
            </div>
            <div className="text-xs text-wl-text-secondary mt-1">
              in transit
            </div>
          </Card>

          <Card className="p-4 bg-wl-bg-elevated border border-wl-border-subtle rounded-lg">
            <div className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-2">
              Refunded
            </div>
            <div className="text-3xl font-bold font-mono text-wl-text-primary">
              ${stats.totalRefundAmount.toFixed(2)}
            </div>
            <div className="text-xs text-wl-text-secondary mt-1">
              {stats.refunded} returns
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 border border-wl-border-subtle rounded-lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-wl-text-tertiary" />
              <input
                type="text"
                placeholder="Search by Return ID, Order #, or Customer name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 px-3 py-2 bg-wl-bg border border-wl-border-subtle rounded text-sm text-wl-text-primary outline-none focus:border-wl-border-default"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="p-1 hover:bg-wl-bg rounded transition-colors"
                >
                  <X className="w-4 h-4 text-wl-text-tertiary" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as ReturnStatus | "all");
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-wl-bg border border-wl-border-subtle rounded text-sm text-wl-text-primary outline-none focus:border-wl-border-default"
                >
                  <option value="all">All Statuses</option>
                  <option value="requested">Requested</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="received">Received</option>
                  <option value="inspected">Inspected</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Date Range
                </label>
                <select
                  value={filterDateRange}
                  onChange={(e) => {
                    setFilterDateRange(e.target.value as "all" | "7days" | "30days" | "90days");
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 bg-wl-bg border border-wl-border-subtle rounded text-sm text-wl-text-primary outline-none focus:border-wl-border-default"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Returns Table */}
        <Card className="border border-wl-border-subtle rounded-lg overflow-hidden">
          {filteredReturns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-wl-text-tertiary text-lg font-medium">
                No returns match your filters
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-subtle bg-wl-bg-elevated">
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Return ID
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Order #
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Reason
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-wl-text-primary">
                        Refund Amount
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-wl-text-primary">
                        Created
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-wl-text-primary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReturns.map((ret, idx) => (
                      <tr
                        key={ret.id}
                        className={cn(
                          "border-b border-wl-border-subtle transition-colors hover:bg-wl-bg-elevated cursor-pointer",
                          idx === paginatedReturns.length - 1 && "border-b-0"
                        )}
                        onClick={() => setSelectedReturn(ret)}
                      >
                        <td className="px-4 py-3 font-mono text-wl-primary-400">
                          {ret.id}
                        </td>
                        <td className="px-4 py-3 text-wl-text-primary">
                          {ret.orderId}
                        </td>
                        <td className="px-4 py-3 text-wl-text-primary">
                          {ret.customerName}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary">
                          {ret.items.length} item{ret.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary max-w-xs truncate">
                          {ret.reason}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_CONFIG[ret.status].color}>
                            {STATUS_CONFIG[ret.status].badge}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-wl-text-primary">
                          ${ret.refundAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-wl-text-secondary text-xs">
                          {new Date(ret.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReturn(ret);
                            }}
                            className="p-1 hover:bg-wl-bg rounded transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-wl-text-tertiary" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-4 border-t border-wl-border-subtle flex items-center justify-between">
                  <div className="text-sm text-wl-text-secondary">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, filteredReturns.length)} of{" "}
                    {filteredReturns.length}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </Button>
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-sm text-wl-text-secondary">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Detail Modal / Slide-over */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedReturn(null)}
          />

          {/* Slide-over Panel */}
          <div className="relative ml-auto w-full max-w-2xl bg-wl-bg shadow-2xl border-l border-wl-border-subtle flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-wl-border-subtle">
              <div>
                <h2 className="text-2xl font-bold text-wl-text-primary">
                  {selectedReturn.id}
                </h2>
                <p className="text-sm text-wl-text-secondary mt-1">
                  Order {selectedReturn.orderId} • {selectedReturn.customerName}
                </p>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-2 hover:bg-wl-bg-elevated rounded transition-colors"
              >
                <X className="w-6 h-6 text-wl-text-tertiary" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Status & Summary */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-wl-text-tertiary uppercase tracking-wide">
                      Current Status
                    </h3>
                    <Badge variant={STATUS_CONFIG[selectedReturn.status].color}>
                      {STATUS_CONFIG[selectedReturn.status].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-wl-text-tertiary text-xs mb-1">
                        Refund Amount
                      </div>
                      <div className="text-lg font-semibold text-wl-text-primary">
                        ${selectedReturn.refundAmount.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-wl-text-tertiary text-xs mb-1">
                        Created
                      </div>
                      <div className="text-lg font-semibold text-wl-text-primary">
                        {new Date(selectedReturn.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Details */}
                <div className="space-y-3 pb-4 border-b border-wl-border-subtle">
                  <h3 className="text-sm font-semibold text-wl-text-tertiary uppercase tracking-wide">
                    Return Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Customer:</span>
                      <span className="text-wl-text-primary">
                        {selectedReturn.customerName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Email:</span>
                      <span className="text-wl-text-primary">
                        {selectedReturn.customerEmail}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Reason:</span>
                      <span className="text-wl-text-primary">
                        {selectedReturn.reason}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-wl-text-tertiary uppercase tracking-wide">
                    Items ({selectedReturn.items.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedReturn.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-wl-text-primary">
                              {item.name}
                            </div>
                            <div className="text-xs text-wl-text-secondary">
                              Qty: {item.quantity}
                            </div>
                          </div>
                          <Badge
                            variant={
                              item.condition === "good"
                                ? "success"
                                : item.condition === "damaged"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {item.condition === "good"
                              ? "Good"
                              : item.condition === "damaged"
                                ? "Damaged"
                                : "Defective"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3 pb-4 border-b border-wl-border-subtle">
                  <h3 className="text-sm font-semibold text-wl-text-tertiary uppercase tracking-wide">
                    Status Timeline
                  </h3>
                  <div className="space-y-3">
                    {selectedReturn.timeline.map((event, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <Clock className="w-4 h-4 text-wl-text-tertiary" />
                          {idx < selectedReturn.timeline.length - 1 && (
                            <div className="w-0.5 h-8 bg-wl-border-subtle mt-1" />
                          )}
                        </div>
                        <div className="pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-wl-text-primary">
                              {STATUS_CONFIG[event.status].label}
                            </span>
                            <span className="text-xs text-wl-text-tertiary">
                              {new Date(event.timestamp).toLocaleDateString()} at{" "}
                              {new Date(event.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-wl-text-secondary mt-1">
                            {event.notes}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedReturn.notes && (
                  <div className="space-y-3 p-3 rounded-lg bg-wl-bg-elevated border border-wl-border-subtle">
                    <h3 className="text-sm font-semibold text-wl-text-tertiary uppercase tracking-wide">
                      Notes
                    </h3>
                    <p className="text-sm text-wl-text-primary">
                      {selectedReturn.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-wl-border-subtle p-6 space-y-3">
              <div className="flex gap-2">
                {getActionButtons(selectedReturn)}
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelectedReturn(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
