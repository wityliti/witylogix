"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Users,
  ShoppingCart,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  Clock,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Tag,
  GitMerge,
  FileText,
} from "lucide-react";

// Types
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  store: string;
  ordersCount: number;
  totalSpent: number;
  lastOrder: string;
  status: "active" | "inactive" | "vip";
  joined: string;
  addresses: { type: string; address: string }[];
  notes: string;
  tags: string[];
}

// Mock customers data
const mockCustomers: Customer[] = [
  {
    id: "cust-001",
    name: "Acme Corporation",
    email: "procurement@acme.com",
    phone: "(555) 123-4567",
    store: "Eastern Distribution",
    ordersCount: 145,
    totalSpent: 85500,
    lastOrder: "2026-03-05",
    status: "vip",
    joined: "2023-05-10",
    addresses: [
      { type: "Billing", address: "123 Business Ave, New York, NY 10001" },
      { type: "Shipping", address: "456 Warehouse Rd, Jersey City, NJ 07302" },
    ],
    notes: "Premium customer with consistent monthly orders",
    tags: ["enterprise", "high-value", "reliable"],
  },
  {
    id: "cust-002",
    name: "Global Tech Supply",
    email: "orders@globaltech.io",
    phone: "(555) 234-5678",
    store: "Western Hub",
    ordersCount: 87,
    totalSpent: 52300,
    lastOrder: "2026-03-06",
    status: "active",
    joined: "2023-08-22",
    addresses: [
      { type: "Billing", address: "789 Tech Park, San Francisco, CA 94105" },
      { type: "Shipping", address: "321 Distribution Center, Oakland, CA 94601" },
    ],
    notes: "Regular customer, growth trajectory positive",
    tags: ["tech", "growing", "reliable"],
  },
  {
    id: "cust-003",
    name: "Urban Retail Group",
    email: "supply@urbanretail.com",
    phone: "(555) 345-6789",
    store: "Central Warehouse",
    ordersCount: 234,
    totalSpent: 127900,
    lastOrder: "2026-03-07",
    status: "vip",
    joined: "2024-01-15",
    addresses: [
      { type: "Billing", address: "555 Downtown Ave, Chicago, IL 60601" },
    ],
    notes: "VIP status justified - high volume, premium products",
    tags: ["retail", "high-volume", "vip"],
  },
  {
    id: "cust-004",
    name: "Fresh Foods Distribution",
    email: "logistics@freshfoods.net",
    phone: "(555) 456-7890",
    store: "Southern Terminal",
    ordersCount: 312,
    totalSpent: 189200,
    lastOrder: "2026-03-07",
    status: "vip",
    joined: "2022-11-03",
    addresses: [
      { type: "Billing", address: "999 Food Court, Atlanta, GA 30303" },
      { type: "Shipping", address: "222 Refrigerated Warehouse, Decatur, GA 30031" },
    ],
    notes: "Largest customer by volume - critical account",
    tags: ["food-service", "high-volume", "critical"],
  },
  {
    id: "cust-005",
    name: "Smart Home Solutions",
    email: "procurement@smarthome.io",
    phone: "(555) 567-8901",
    store: "Northern Facility",
    ordersCount: 45,
    totalSpent: 28700,
    lastOrder: "2026-02-28",
    status: "active",
    joined: "2025-03-20",
    addresses: [
      { type: "Billing", address: "111 Innovation Way, Seattle, WA 98101" },
    ],
    notes: "New customer, showing promise",
    tags: ["tech", "startup", "new"],
  },
  {
    id: "cust-006",
    name: "Regional Fashion Wholesale",
    email: "buying@regionfashion.com",
    phone: "(555) 678-9012",
    store: "Eastern Distribution",
    ordersCount: 12,
    totalSpent: 8900,
    lastOrder: "2025-12-15",
    status: "inactive",
    joined: "2024-06-10",
    addresses: [
      { type: "Billing", address: "333 Fashion Plaza, Miami, FL 33101" },
    ],
    notes: "No orders in 3 months - follow up needed",
    tags: ["fashion", "wholesale", "dormant"],
  },
  {
    id: "cust-007",
    name: "Industrial Supply Co",
    email: "quotes@industrialsupply.com",
    phone: "(555) 789-0123",
    store: "Western Hub",
    ordersCount: 156,
    totalSpent: 94500,
    lastOrder: "2026-03-04",
    status: "active",
    joined: "2023-02-14",
    addresses: [
      { type: "Billing", address: "666 Factory St, Houston, TX 77002" },
      { type: "Shipping", address: "888 Industrial Zone, Houston, TX 77073" },
    ],
    notes: "Steady performer, good margins",
    tags: ["industrial", "stable", "reliable"],
  },
  {
    id: "cust-008",
    name: "Premium Events & Catering",
    email: "orders@premiumevents.co",
    phone: "(555) 890-1234",
    store: "Southern Terminal",
    ordersCount: 78,
    totalSpent: 45600,
    lastOrder: "2026-03-06",
    status: "active",
    joined: "2024-04-05",
    addresses: [
      { type: "Billing", address: "777 Grand Boulevard, Los Angeles, CA 90001" },
    ],
    notes: "Seasonal orders, peak during Q4",
    tags: ["events", "seasonal", "catering"],
  },
];

const getStatusBadgeVariant = (status: Customer["status"]): "success" | "warning" | "danger" | "info" | "default" => {
  switch (status) {
    case "active":
      return "success";
    case "inactive":
      return "warning";
    case "vip":
      return "primary";
    default:
      return "default";
  }
};

// Customer Detail Modal
const CustomerDetailModal = ({ customer, isOpen, onClose }: { customer: Customer | null; isOpen: boolean; onClose: () => void }) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview", "addresses"]);

  if (!customer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Customer Details: ${customer.name}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
        {/* Overview Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("overview")
                  ? expandedSections.filter((s) => s !== "overview")
                  : [...expandedSections, "overview"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("overview") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Overview
          </button>
          {expandedSections.includes("overview") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-4)", marginTop: "var(--wl-space-3)" }}>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Name
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {customer.name}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Status
                </p>
                <Badge variant={getStatusBadgeVariant(customer.status)} style={{ fontSize: "var(--wl-text-xs)", textTransform: "capitalize" }}>
                  {customer.status}
                </Badge>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Email
                </p>
                <a href={`mailto:${customer.email}`} style={{ color: "var(--wl-brand-primary)", textDecoration: "none", fontSize: "var(--wl-text-sm)", fontWeight: 500 }}>
                  {customer.email}
                </a>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Phone
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {customer.phone}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Store
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {customer.store}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Joined
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {customer.joined}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Order History Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("orders")
                  ? expandedSections.filter((s) => s !== "orders")
                  : [...expandedSections, "orders"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("orders") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Order History
          </button>
          {expandedSections.includes("orders") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--wl-space-4)", marginTop: "var(--wl-space-3)" }}>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Total Orders
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-lg)", fontWeight: 700, margin: 0 }}>
                  {customer.ordersCount}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Total Spent
                </p>
                <p style={{ color: "var(--wl-brand-primary)", fontSize: "var(--wl-text-lg)", fontWeight: 700, margin: 0 }}>
                  ${customer.totalSpent.toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                  Last Order
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", fontWeight: 500, margin: 0 }}>
                  {customer.lastOrder}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Addresses Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("addresses")
                  ? expandedSections.filter((s) => s !== "addresses")
                  : [...expandedSections, "addresses"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("addresses") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Addresses ({customer.addresses.length})
          </button>
          {expandedSections.includes("addresses") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-3)", marginTop: "var(--wl-space-3)" }}>
              {customer.addresses.map((addr, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "var(--wl-space-3)",
                    backgroundColor: "var(--wl-bg-base)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid var(--wl-border-subtle)",
                  }}
                >
                  <p style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", margin: 0, marginBottom: "4px", fontWeight: 600, textTransform: "uppercase" }}>
                    {addr.type}
                  </p>
                  <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)", margin: 0 }}>
                    {addr.address}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div style={{ borderBottom: "1px solid var(--wl-border-subtle)", paddingBottom: "var(--wl-space-3)" }}>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("tags")
                  ? expandedSections.filter((s) => s !== "tags")
                  : [...expandedSections, "tags"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("tags") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Tags ({customer.tags.length})
          </button>
          {expandedSections.includes("tags") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--wl-space-2)", marginTop: "var(--wl-space-3)" }}>
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="info" style={{ fontSize: "var(--wl-text-xs)", textTransform: "capitalize" }}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div>
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("notes")
                  ? expandedSections.filter((s) => s !== "notes")
                  : [...expandedSections, "notes"]
              )
            }
            style={{
              background: "transparent",
              border: "none",
              color: "var(--wl-text-primary)",
              fontWeight: 600,
              fontSize: "var(--wl-text-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--wl-space-2)",
              padding: "var(--wl-space-2) 0",
            }}
          >
            {expandedSections.includes("notes") ? <ChevronUp style={{ width: "16px", height: "16px" }} /> : <ChevronDown style={{ width: "16px", height: "16px" }} />}
            Notes
          </button>
          {expandedSections.includes("notes") && (
            <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-sm)", margin: "var(--wl-space-2) 0 0 0", padding: "var(--wl-space-3)", backgroundColor: "var(--wl-bg-base)", borderRadius: "var(--wl-radius-md)", border: "1px solid var(--wl-border-subtle)" }}>
              {customer.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-2)",
            marginTop: "var(--wl-space-4)",
            borderTop: "1px solid var(--wl-border-subtle)",
            paddingTop: "var(--wl-space-4)",
          }}
        >
          <Button variant="secondary" size="sm">
            <FileText style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Add Note
          </Button>
          <Button variant="ghost" size="sm">
            <GitMerge style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Merge Duplicates
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Stats Bar
const StatsBar = ({ customers }: { customers: Customer[] }) => {
  const activeCustomers = customers.filter((c) => c.status !== "inactive").length;
  const vipCustomers = customers.filter((c) => c.status === "vip").length;
  const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrders = Math.round(customers.reduce((sum, c) => sum + c.ordersCount, 0) / customers.length);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--wl-space-4)",
        marginBottom: "var(--wl-space-6)",
      }}
    >
      {[
        { label: "Total Customers", value: customers.length.toString(), icon: Users, color: "#6366f1" },
        { label: "Active", value: activeCustomers.toString(), icon: TrendingUp, color: "#10b981" },
        { label: "VIP", value: vipCustomers.toString(), icon: ShoppingCart, color: "#f59e0b" },
        { label: "Total Revenue", value: `$${(totalSpent / 1000).toFixed(0)}K`, icon: DollarSign, color: "#8b5cf6" },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            style={{
              backgroundColor: "var(--wl-bg-surface)",
              borderColor: "var(--wl-border-subtle)",
              animation: `fadeInUp 0.4s ease-out ${idx * 50}ms both`,
            }}
          >
            <CardContent style={{ padding: "var(--wl-space-4)", display: "flex", gap: "var(--wl-space-3)", alignItems: "flex-start" }}>
              <div
                style={{
                  padding: "var(--wl-space-2)",
                  borderRadius: "var(--wl-radius-md)",
                  backgroundColor: stat.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon style={{ color: stat.color, width: "20px", height: "20px" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {stat.label}
                </p>
                <p style={{ color: "var(--wl-text-primary)", fontSize: "var(--wl-text-lg)", fontWeight: 700, margin: "var(--wl-space-1) 0 0 0" }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Main Page
export default function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "vip">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    return mockCustomers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm);

      const matchesStore = storeFilter === "all" || customer.store === storeFilter;
      const matchesStatus = statusFilter === "all" || customer.status === statusFilter;

      return matchesSearch && matchesStore && matchesStatus;
    });
  }, [searchTerm, storeFilter, statusFilter]);

  const stores = ["all", ...new Set(mockCustomers.map((c) => c.store))];

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const csv = [["Name", "Email", "Phone", "Store", "Orders", "Total Spent", "Last Order", "Status"]];
    filteredCustomers.forEach((customer) => {
      csv.push([customer.name, customer.email, customer.phone, customer.store, customer.ordersCount.toString(), customer.totalSpent.toString(), customer.lastOrder, customer.status]);
    });
    const csvString = csv.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div style={{ backgroundColor: "var(--wl-bg-base)" }}>
      <Header
        title="Customer Management"
        subtitle="Manage all customers across all stores"
        actions={
          <Button variant="primary" size="sm" onClick={handleExport}>
            <Download style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Export
          </Button>
        }
      />

      <main style={{ flex: 1, padding: "var(--wl-space-6)", maxWidth: "1400px", margin: "0 auto" }}>
        <StatsBar customers={mockCustomers} />

        <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)", marginBottom: "var(--wl-space-6)" }}>
          <CardContent style={{ padding: "var(--wl-space-4)" }}>
            {/* Search */}
            <div style={{ marginBottom: "var(--wl-space-4)", position: "relative" }}>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--wl-space-2) var(--wl-space-3) var(--wl-space-2) var(--wl-space-8)",
                  backgroundColor: "var(--wl-bg-base)",
                  color: "var(--wl-text-primary)",
                  border: "1px solid var(--wl-border-subtle)",
                  borderRadius: "var(--wl-radius-md)",
                  fontSize: "var(--wl-text-sm)",
                }}
              />
              <Search style={{ position: "absolute", left: "var(--wl-space-2)", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--wl-text-secondary)", pointerEvents: "none" }} />
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "var(--wl-space-3)", flexWrap: "wrap", marginBottom: "var(--wl-space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <Filter style={{ width: "16px", height: "16px", color: "var(--wl-text-secondary)" }} />
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                  Store:
                </span>
              </div>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                style={{
                  padding: "4px 12px",
                  background: "var(--wl-bg-base)",
                  color: "var(--wl-text-primary)",
                  border: "1px solid var(--wl-border-subtle)",
                  borderRadius: "var(--wl-radius-md)",
                  fontSize: "var(--wl-text-xs)",
                  cursor: "pointer",
                }}
              >
                {stores.map((store) => (
                  <option key={store} value={store}>
                    {store === "all" ? "All Stores" : store}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "var(--wl-space-3)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                <span style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                  Status:
                </span>
              </div>
              {(["all", "active", "inactive", "vip"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: "4px 12px",
                    background: statusFilter === status ? "var(--wl-brand-primary)" : "var(--wl-bg-base)",
                    color: statusFilter === status ? "white" : "var(--wl-text-primary)",
                    border: `1px solid ${statusFilter === status ? "var(--wl-brand-primary)" : "var(--wl-border-subtle)"}`,
                    borderRadius: "var(--wl-radius-md)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card style={{ backgroundColor: "var(--wl-bg-surface)", borderColor: "var(--wl-border-subtle)" }}>
          {filteredCustomers.length > 0 ? (
            <>
              <div
                style={{
                  padding: "var(--wl-space-3) var(--wl-space-4)",
                  borderBottom: "1px solid var(--wl-border-subtle)",
                  fontSize: "var(--wl-text-xs)",
                  color: "var(--wl-text-secondary)",
                }}
              >
                Showing {filteredCustomers.length} of {mockCustomers.length} customers
              </div>
              <CardContent style={{ padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "var(--wl-text-sm)",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--wl-border-subtle)", backgroundColor: "var(--wl-bg-base)" }}>
                        {["Name", "Email", "Phone", "Store", "Orders", "Total Spent", "Last Order", "Status", "Actions"].map((header) => (
                          <th
                            key={header}
                            style={{
                              padding: "var(--wl-space-3)",
                              textAlign: header === "Actions" ? "center" : "left",
                              color: "var(--wl-text-secondary)",
                              fontWeight: 600,
                              fontSize: "var(--wl-text-xs)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer, idx) => (
                        <tr
                          key={customer.id}
                          style={{
                            borderBottom: "1px solid var(--wl-border-subtle)",
                            backgroundColor: idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)",
                            transition: "all 0.2s",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--wl-bg-surface)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)";
                          }}
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                            {customer.name}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {customer.email}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {customer.phone}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-primary)", fontSize: "var(--wl-text-sm)" }}>
                            {customer.store}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                            {customer.ordersCount}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-brand-primary)", fontWeight: 600 }}>
                            ${customer.totalSpent.toLocaleString()}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)", color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-xs)" }}>
                            {customer.lastOrder}
                          </td>
                          <td style={{ padding: "var(--wl-space-3)" }}>
                            <Badge variant={getStatusBadgeVariant(customer.status)} style={{ fontSize: "var(--wl-text-xs)", textTransform: "capitalize" }}>
                              {customer.status}
                            </Badge>
                          </td>
                          <td
                            style={{
                              padding: "var(--wl-space-3)",
                              textAlign: "center",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--wl-text-secondary)",
                                cursor: "pointer",
                                padding: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-primary)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "var(--wl-text-secondary)";
                              }}
                            >
                              <MoreVertical style={{ width: "16px", height: "16px" }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent
              style={{
                padding: "var(--wl-space-12)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle style={{ width: "48px", height: "48px", color: "var(--wl-text-secondary)", marginBottom: "var(--wl-space-3)", opacity: 0.3 }} />
              <p style={{ color: "var(--wl-text-primary)", fontWeight: 500, margin: 0, marginBottom: "4px" }}>
                No customers found
              </p>
              <p style={{ color: "var(--wl-text-secondary)", fontSize: "var(--wl-text-sm)", margin: 0 }}>
                Try adjusting your filters
              </p>
            </CardContent>
          )}
        </Card>
      </main>

      <CustomerDetailModal customer={selectedCustomer} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
