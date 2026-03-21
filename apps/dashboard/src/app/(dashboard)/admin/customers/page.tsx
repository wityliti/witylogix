'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { LoadingSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
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
      return "info";
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
      <div className="flex flex-col gap-4">
        {/* Overview Section */}
        <div className="border-b border-[#1e1e2e] pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("overview")
                  ? expandedSections.filter((s) => s !== "overview")
                  : [...expandedSections, "overview"]
              )
            }
            className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer flex items-center gap-2 p-2"
          >
            {expandedSections.includes("overview") ? <ChevronUp /> : <ChevronDown />}
            Overview
          </button>
          {expandedSections.includes("overview") && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Name
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {customer.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Status
                </p>
                <Badge variant={getStatusBadgeVariant(customer.status)} className="text-xs capitalize">
                  {customer.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Email
                </p>
                <a href={`mailto:${customer.email}`} className="text-blue-500 no-underline text-sm font-medium">
                  {customer.email}
                </a>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Phone
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {customer.phone}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Store
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {customer.store}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Joined
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {customer.joined}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Order History Section */}
        <div className="border-b border-[#1e1e2e] pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("orders")
                  ? expandedSections.filter((s) => s !== "orders")
                  : [...expandedSections, "orders"]
              )
            }
            className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer flex items-center gap-2 p-2"
          >
            {expandedSections.includes("orders") ? <ChevronUp /> : <ChevronDown />}
            Order History
          </button>
          {expandedSections.includes("orders") && (
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Total Orders
                </p>
                <p className="text-white text-lg font-bold m-0">
                  {customer.ordersCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Total Spent
                </p>
                <p className="text-blue-500 text-lg font-bold m-0">
                  ${customer.totalSpent.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                  Last Order
                </p>
                <p className="text-white text-sm font-medium m-0">
                  {customer.lastOrder}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Addresses Section */}
        <div className="border-b border-[#1e1e2e] pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("addresses")
                  ? expandedSections.filter((s) => s !== "addresses")
                  : [...expandedSections, "addresses"]
              )
            }
            className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer flex items-center gap-2 p-2"
          >
            {expandedSections.includes("addresses") ? <ChevronUp /> : <ChevronDown />}
            Addresses ({customer.addresses.length})
          </button>
          {expandedSections.includes("addresses") && (
            <div className="flex flex-col gap-3 mt-3">
              {customer.addresses.map((addr, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0a0a0f] min-h-screen rounded-md border border-[#1e1e2e]"
                >
                  <p className="text-xs text-gray-400 m-0 font-semibold uppercase mb-1">
                    {addr.type}
                  </p>
                  <p className="text-white text-sm m-0">
                    {addr.address}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="border-b border-[#1e1e2e] pb-3">
          <button
            onClick={() =>
              setExpandedSections(
                expandedSections.includes("tags")
                  ? expandedSections.filter((s) => s !== "tags")
                  : [...expandedSections, "tags"]
              )
            }
            className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer flex items-center gap-2 p-2"
          >
            {expandedSections.includes("tags") ? <ChevronUp /> : <ChevronDown />}
            Tags ({customer.tags.length})
          </button>
          {expandedSections.includes("tags") && (
            <div className="flex flex-wrap gap-2 mt-3">
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="info" className="text-xs capitalize">
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
            className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer flex items-center gap-2 p-2"
          >
            {expandedSections.includes("notes") ? <ChevronUp /> : <ChevronDown />}
            Notes
          </button>
          {expandedSections.includes("notes") && (
            <p className="text-gray-400 text-sm m-2 p-3 bg-[#0a0a0f] min-h-screen rounded-md border border-[#1e1e2e]">
              {customer.notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 border-t border-[#1e1e2e] pt-4">
          <Button variant="secondary" size="sm">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Add Note
          </Button>
          <Button variant="ghost" size="sm">
            <GitMerge className="w-3.5 h-3.5 mr-1" />
            Merge Duplicates
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Stats Bar
const StatsBar = ({ customers, loading }: { customers: Customer[]; loading: boolean }) => {
  if (loading) return <TableSkeleton rows={1} columns={4} />;
  const activeCustomers = customers.filter((c) => c.status !== 'inactive').length;
  const vipCustomers = customers.filter((c) => c.status === 'vip').length;
  const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrders = Math.round(customers.reduce((sum, c) => sum + c.ordersCount, 0) / customers.length);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-6">
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
            className="bg-[#12121a] border-[#1e1e2e] animate-in"
            style={{
              animationDelay: `${idx * 50}ms`,
            }}
          >
            <CardContent className="p-4 flex gap-3 items-start">
              <div
                className="p-2 rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: stat.color + "15",
                }}
              >
                <Icon style={{ color: stat.color }} className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-gray-400 text-xs font-semibold m-0 uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-white text-lg font-bold m-0 mt-1">
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
  const { items: customers, loading, error, refetch } = useApiList<Customer>('/api/v4/customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'vip'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm);

      const matchesStore = storeFilter === 'all' || customer.store === storeFilter;
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;

      return matchesSearch && matchesStore && matchesStatus;
    });
  }, [searchTerm, storeFilter, statusFilter, customers]);

  const stores = ['all', ...new Set(customers.map((c) => c.store))];

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

  if (loading && customers.length === 0) return <LoadingSkeleton />;
  if (error && customers.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <Header
        title="Customer Management"
        subtitle="Manage all customers across all stores"
        actions={
          <Button variant="primary" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export
          </Button>
        }
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto">
        <StatsBar customers={customers} loading={loading} />

        <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
          <CardContent className="p-4">
            {/* Search */}
            <div className="mb-4 relative">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 pl-8 bg-[#0a0a0f] min-h-screen text-white border border-[#1e1e2e] rounded-md text-sm"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400 font-semibold uppercase">
                  Store:
                </span>
              </div>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-3 py-1 bg-[#0a0a0f] min-h-screen text-white border border-[#1e1e2e] rounded-md text-xs cursor-pointer"
              >
                {stores.map((store) => (
                  <option key={store} value={store}>
                    {store === "all" ? "All Stores" : store}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold uppercase">
                  Status:
                </span>
              </div>
              {(["all", "active", "inactive", "vip"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1 border rounded-md text-xs font-semibold cursor-pointer transition-all capitalize",
                    statusFilter === status
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-[#0a0a0f] min-h-screen text-white border-[#1e1e2e]"
                  )}
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          {filteredCustomers.length > 0 ? (
            <>
              <div className="p-3 border-b border-[#1e1e2e] text-xs text-gray-400">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e] bg-[#0a0a0f] min-h-screen">
                        {["Name", "Email", "Phone", "Store", "Orders", "Total Spent", "Last Order", "Status", "Actions"].map((header) => (
                          <th
                            key={header}
                            className={cn(
                              "p-3 text-left text-gray-400 font-semibold text-xs uppercase tracking-wide",
                              header === "Actions" && "text-center"
                            )}
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
                          className={cn(
                            "border-b border-[#1e1e2e] transition-all cursor-pointer",
                            idx % 2 === 0 ? "bg-[#0a0a0f] min-h-screen" : "bg-[#12121a]"
                          )}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#12121a";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "#0a0a0f" : "#12121a";
                          }}
                          onClick={() => handleCustomerClick(customer)}
                        >
                          <td className="p-3 text-white font-medium">
                            {customer.name}
                          </td>
                          <td className="p-3 text-gray-400 text-xs">
                            {customer.email}
                          </td>
                          <td className="p-3 text-gray-400 text-xs">
                            {customer.phone}
                          </td>
                          <td className="p-3 text-white text-sm">
                            {customer.store}
                          </td>
                          <td className="p-3 text-white font-medium">
                            {customer.ordersCount}
                          </td>
                          <td className="p-3 text-blue-500 font-semibold">
                            ${customer.totalSpent.toLocaleString()}
                          </td>
                          <td className="p-3 text-gray-400 text-xs">
                            {customer.lastOrder}
                          </td>
                          <td className="p-3">
                            <Badge variant={getStatusBadgeVariant(customer.status)} className="text-xs capitalize">
                              {customer.status}
                            </Badge>
                          </td>
                          <td
                            className="p-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button className="bg-transparent border-none text-gray-400 cursor-pointer p-1 inline-flex items-center justify-center transition-all hover:text-white">
                              <MoreVertical />
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
            <CardContent className="p-12 text-center flex flex-col items-center justify-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mb-3 opacity-30" />
              <p className="text-white font-medium m-0 mb-1">
                No customers found
              </p>
              <p className="text-gray-400 text-sm m-0">
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
