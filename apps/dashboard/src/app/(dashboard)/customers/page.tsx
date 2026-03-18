'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomers, Customer as ApiCustomer } from '@/hooks/use-customers';

/* ═══════════════════════════════════════════════════════════
   CUSTOMERS PAGE — Customer management with Shopify sync
   ═══════════════════════════════════════════════════════════ */

const MOCK_CUSTOMERS: ApiCustomer[] = [
  {
    id: "cust-001",
    shopifyId: "gid://shopify/Customer/123456789",
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "+1 (555) 234-5601",
    ordersCount: 15,
    totalSpent: 3240.50,
    lastOrderDate: "2026-03-05",
    status: "active",
    syncedAt: "2026-03-06T08:30:00Z",
    segment: "vip",
  },
  {
    id: "cust-002",
    shopifyId: "gid://shopify/Customer/987654321",
    name: "Michael Torres",
    email: "m.torres@email.com",
    phone: "+1 (555) 345-6712",
    ordersCount: 12,
    totalSpent: 2890.75,
    lastOrderDate: "2026-03-04",
    status: "active",
    syncedAt: "2026-03-06T08:15:00Z",
    segment: "vip",
  },
  {
    id: "cust-003",
    shopifyId: "gid://shopify/Customer/456789123",
    name: "Emma Rodriguez",
    email: "emma.r@email.com",
    phone: "+1 (555) 456-7823",
    ordersCount: 8,
    totalSpent: 1950.00,
    lastOrderDate: "2026-03-03",
    status: "active",
    syncedAt: "2026-03-06T08:45:00Z",
    segment: "regular",
  },
  {
    id: "cust-004",
    shopifyId: "gid://shopify/Customer/789123456",
    name: "James Liu",
    email: "james.liu@email.com",
    phone: "+1 (555) 567-8934",
    ordersCount: 5,
    totalSpent: 1240.25,
    lastOrderDate: "2026-02-28",
    status: "active",
    syncedAt: "2026-03-06T07:20:00Z",
    segment: "regular",
  },
  {
    id: "cust-005",
    shopifyId: "gid://shopify/Customer/321654987",
    name: "Olivia Martinez",
    email: "o.martinez@email.com",
    phone: "+1 (555) 678-9045",
    ordersCount: 3,
    totalSpent: 680.50,
    lastOrderDate: "2026-02-15",
    status: "active",
    syncedAt: "2026-03-06T08:00:00Z",
    segment: "new",
  },
  {
    id: "cust-006",
    shopifyId: "gid://shopify/Customer/654987321",
    name: "David Kim",
    email: "d.kim@email.com",
    phone: "+1 (555) 789-0156",
    ordersCount: 2,
    totalSpent: 425.75,
    lastOrderDate: "2026-02-20",
    status: "active",
    syncedAt: "2026-03-06T08:30:00Z",
    segment: "new",
  },
  {
    id: "cust-007",
    shopifyId: "gid://shopify/Customer/147258369",
    name: "Jessica Williams",
    email: "j.williams@email.com",
    phone: "+1 (555) 890-1267",
    ordersCount: 0,
    totalSpent: 0,
    lastOrderDate: "",
    status: "inactive",
    syncedAt: "2026-03-05T14:10:00Z",
    segment: "inactive",
  },
  {
    id: "cust-008",
    shopifyId: "gid://shopify/Customer/258369147",
    name: "Robert Anderson",
    email: "r.anderson@email.com",
    phone: "+1 (555) 901-2378",
    ordersCount: 0,
    totalSpent: 0,
    lastOrderDate: "",
    status: "inactive",
    syncedAt: "2026-03-04T11:45:00Z",
    segment: "inactive",
  },
  {
    id: "cust-009",
    shopifyId: "gid://shopify/Customer/369147258",
    name: "Lisa Zhang",
    email: "lisa.zhang@email.com",
    phone: "+1 (555) 012-3489",
    ordersCount: 11,
    totalSpent: 2750.00,
    lastOrderDate: "2026-03-05",
    status: "active",
    syncedAt: "2026-03-06T08:25:00Z",
    segment: "vip",
  },
  {
    id: "cust-010",
    shopifyId: "gid://shopify/Customer/159753852",
    name: "Carlos Nunez",
    email: "c.nunez@email.com",
    phone: "+1 (555) 123-4590",
    ordersCount: 6,
    totalSpent: 1580.00,
    lastOrderDate: "2026-02-28",
    status: "active",
    syncedAt: "2026-03-06T07:55:00Z",
    segment: "regular",
  },
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDateTime = (isoStr: string): string => {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getSegmentColor = (segment: string): "primary" | "success" | "warning" | "info" | "default" => {
  const map: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
    vip: "primary",
    regular: "success",
    new: "info",
    inactive: "default",
  };
  return map[segment] ?? "default";
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getSegmentColor = (tier: string): 'primary' | 'success' | 'warning' | 'info' | 'default' => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'default'> = {
    enterprise: 'primary',
    premium: 'success',
    standard: 'info',
    inactive: 'default',
  };
  return map[tier.toLowerCase()] ?? 'default';
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'totalSpent' | 'totalOrders' | 'lastOrderDate'>('name');
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;

  // Fetch customers from API
  const { items: customers, loading, error, refetch, pagination } = useCustomers({
    search: search || undefined,
    limit: pageSize,
  });

  // Filter customer client-side
  const filtered = useMemo(() => {
    let result = customers;

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'totalSpent':
          return b.totalSpent - a.totalSpent;
        case 'totalOrders':
          return b.totalOrders - a.totalOrders;
        case 'lastOrderDate':
          return (new Date(b.lastOrderDate || 0).getTime() - new Date(a.lastOrderDate || 0).getTime());
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [customers, statusFilter, sortBy]);

  const paginatedItems = filtered.slice(0, pageSize);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pageSize));

  // Calculate stats
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const avgOrders =
    customers.length > 0 ? (customers.reduce((sum, c) => sum + c.totalOrders, 0) / customers.length).toFixed(1) : '0';
  const topSpender = customers.length > 0 ? Math.max(...customers.map((c) => c.totalSpent)) : 0;

  return (
    <>
      <Header
        title="Customers"
        subtitle={`${activeCustomers} active · ${pagination.total} total`}
        actions={
          <Button variant="primary" size="md">
            + Sync from Shopify
          </Button>
        }
      />

      <div className="p-6">
        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-wl-danger-500/10 border border-wl-danger-500/20 rounded-lg">
            <p className="text-sm text-wl-danger-400 flex items-center justify-between">
              <span>Failed to load customers</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-wl-danger-400">
                Retry
              </Button>
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Customers"
            value={pagination.total}
            change={{ value: 5.2, label: 'vs last month' }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Customers"
            value={activeCustomers}
            change={{ value: 12.8, label: 'vs last month' }}
            accentColor="var(--wl-info-400)"
            index={1}
          />
          <StatCard
            label="Average Orders"
            value={avgOrders}
            change={{ value: 2.3, label: 'per customer' }}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Top Spender"
            value={formatCurrency(topSpender)}
            change={{ value: 15.1, label: 'vs avg' }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Filters Bar */}
        <div className="flex gap-4 mb-5 items-center flex-wrap">
          {/* Search */}
          <div className="flex-1 flex-grow-0 w-[300px] max-w-96">
            <input
              type="text"
              placeholder="Search customers, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setCurrentPage(1);
                }}
                className={cn(
                  'p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer font-sans transition-all duration-fast',
                  statusFilter === status
                    ? 'bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500'
                    : 'bg-transparent text-wl-text-tertiary border-wl-border-default',
                  'capitalize'
                )}
              >
                {status === 'all' ? 'All Statuses' : status}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setCurrentPage(1);
            }}
            className="p-1 px-3 bg-wl-bg-elevated border border-wl-border-default rounded-md text-wl-text-primary text-sm font-sans cursor-pointer outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="totalSpent">Sort by Total Spent</option>
            <option value="totalOrders">Sort by Orders</option>
            <option value="lastOrderDate">Sort by Last Order</option>
          </select>
        </div>

        {/* Tiers Overview */}
        <Card className="mb-5 p-4">
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <h3 className="m-0 text-sm font-semibold text-wl-text-primary">Customer Tiers</h3>
            </div>
            {(['standard', 'premium', 'enterprise'] as const).map((tier) => {
              const count = customers.filter((c) => c.tier === tier).length;
              return (
                <button
                  key={tier}
                  className={cn(
                    'p-2 px-3 rounded-md border text-xs font-semibold cursor-pointer font-sans capitalize',
                    'bg-transparent text-wl-text-secondary border-wl-border-subtle'
                  )}
                >
                  {tier} <span className="ml-1.5 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Customers Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Name</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Email</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Phone</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Orders</th>
                  <th className="p-3 px-4 text-right font-semibold text-wl-text-secondary">Total Spent</th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">Tier</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Status</th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-wl-border-subtle">
                      <td colSpan={8} className="px-4 py-3 h-12 bg-wl-bg-overlay/50 animate-pulse" />
                    </tr>
                  ))
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-wl-text-tertiary">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((customer, idx) => (
                    <tr
                      key={customer.id}
                      className={cn(
                        'border-b border-wl-border-subtle transition-colors duration-fast',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-wl-bg-overlay'
                      )}
                    >
                      <td className="p-3 px-4 text-wl-text-primary font-semibold">{customer.name}</td>
                      <td className="p-3 px-4 text-wl-text-secondary">{customer.email}</td>
                      <td className="p-3 px-4 text-wl-text-secondary">{customer.phone}</td>
                      <td className="p-3 px-4 text-center text-wl-text-primary font-semibold">
                        {customer.totalOrders}
                      </td>
                      <td className="p-3 px-4 text-right text-wl-text-primary font-semibold">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="p-3 px-4 text-left">
                        <Badge variant={getSegmentColor(customer.tier)}>{customer.tier}</Badge>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                          {customer.status}
                        </Badge>
                      </td>
                      <td className="p-3 px-4 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="secondary" size="sm">
                            View
                          </Button>
                          <Button variant="secondary" size="sm">
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-wl-border-subtle bg-wl-bg-overlay text-sm text-wl-text-secondary">
            <div>
              Showing {paginatedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
