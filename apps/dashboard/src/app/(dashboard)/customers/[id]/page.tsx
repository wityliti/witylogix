'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, ShoppingBag, DollarSign, Tag, Calendar, RefreshCw, MapPin, Globe } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useCustomer } from '@/hooks/use-customers';
import type { CustomerAddress, OrderSummary } from '@/hooks/use-customers';

// ─── Helpers ─────────────────────────────────────────────────

const fmtCurrency = (n: number | null) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const TIER_BADGE: Record<string, 'primary' | 'success' | 'info' | 'default'> = {
  enterprise: 'primary',
  premium: 'success',
  standard: 'info',
};

const ORDER_STATUS_BADGE: Record<string, 'success' | 'warning' | 'info' | 'default' | 'primary'> = {
  DELIVERED: 'success',
  PENDING: 'warning',
  IN_TRANSIT: 'info',
  CANCELLED: 'default',
  FAILED: 'default',
};

// ─── Address Display ──────────────────────────────────────────

function AddressCard({ address, index }: { address: CustomerAddress; index: number }) {
  const city = address.city;
  const state = address.province ?? address.state;
  const zip = address.zip ?? address.zipCode;
  const street = address.address1 ?? address.street;
  const country = address.country;

  return (
    <div className={cn(
      'p-3 rounded-lg border border-[#1e1e2e] text-sm',
      index === 0 ? 'border-blue-500/30 bg-blue-500/5' : 'bg-[#1a1a2e]/50'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="font-medium text-white text-xs">
          {index === 0 ? 'Default Address' : `Address ${index + 1}`}
        </span>
        {address.type && <Badge variant="default" className="text-xs">{address.type}</Badge>}
      </div>
      <div className="text-gray-400 text-xs leading-5 ml-5">
        {street && <div>{street}</div>}
        {(city || state || zip) && (
          <div>{[city, state, zip].filter(Boolean).join(', ')}</div>
        )}
        {country && <div className="flex items-center gap-1"><Globe className="w-3 h-3" />{country}</div>}
      </div>
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────

function OrderRow({ order }: { order: OrderSummary }) {
  const badgeVariant = ORDER_STATUS_BADGE[order.status] ?? 'default';
  return (
    <tr className="border-b border-[#1e1e2e] hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-sm text-white font-mono">
        {order.externalOrderNumber ? `#${order.externalOrderNumber}` : order.id.slice(0, 8)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={badgeVariant}>{order.status.replace(/_/g, ' ')}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {[order.city, order.country].filter(Boolean).join(', ') || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-white font-semibold text-right">
        {fmtCurrency(order.totalPrice)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 text-right">{fmtDate(order.createdAt)}</td>
    </tr>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#1e1e2e] rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="h-48 bg-[#1a1a2e] rounded-xl" />
          <div className="h-32 bg-[#1a1a2e] rounded-xl" />
        </div>
        <div className="lg:col-span-2 h-64 bg-[#1a1a2e] rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;

  const { data: customer, loading, error, refetch } = useCustomer(id);

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <Link href="/customers" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <ErrorState
          title="Failed to load customer"
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Link href="/customers" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <EmptyState
          title="Customer not found"
          description="This customer may have been removed or the link is invalid."
          action={{ label: 'Back to Customers', onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  const initials = customer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const addresses: CustomerAddress[] = customer.addresses ?? [];
  const orders: OrderSummary[] = customer.recentOrders ?? [];

  return (
    <div className="p-6">
      {/* Back Link */}
      <Link href="/customers" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile */}
          <Card className="p-6">
            <div className="flex items-start gap-4 mb-5 pb-5 border-b border-white/[0.06]">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white leading-tight">{customer.name}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant={TIER_BADGE[customer.tier] ?? 'default'}>{customer.tier}</Badge>
                  <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                    {customer.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <a href={`mailto:${customer.email}`} className="text-sm text-blue-400 hover:text-blue-300 truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <a href={`tel:${customer.phone}`} className="text-sm text-gray-300">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 bg-[#1e1e2e] rounded text-xs text-gray-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-400">Customer since {fmtDate(customer.createdAt)}</span>
              </div>
              {customer.lastSyncAt && (
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Synced {fmtDate(customer.lastSyncAt)}</span>
                </div>
              )}
            </div>

            {customer.notes && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="text-xs text-gray-500 mb-1">Notes</div>
                <p className="text-sm text-gray-300">{customer.notes}</p>
              </div>
            )}
          </Card>

          {/* Metrics */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Metrics</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Orders</div>
                  <div className="text-lg font-bold text-white">{customer.totalOrders.toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Lifetime Value</div>
                  <div className="text-lg font-bold text-white">{fmtCurrency(customer.totalSpent)}</div>
                </div>
              </div>
              {customer.totalOrders > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Avg Order Value</div>
                    <div className="text-lg font-bold text-white">
                      {fmtCurrency(customer.totalSpent / customer.totalOrders)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Addresses */}
          {addresses.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">
                Addresses ({addresses.length})
              </h2>
              <div className="space-y-2">
                {addresses.map((addr, i) => (
                  <AddressCard key={i} address={addr} index={i} />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Order History */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Order History
                {orders.length > 0 && (
                  <span className="ml-2 text-gray-500 font-normal">(last {orders.length})</span>
                )}
              </h2>
              {customer.email && (
                <span className="text-xs text-gray-500">{customer.email}</span>
              )}
            </div>

            {orders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-6 h-6" />}
                title="No orders found"
                description="This customer has no orders in the system yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Order</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-300">Location</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-300">Total</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Marketing Consent */}
          <div className="mt-4 flex items-center gap-3 px-1">
            <div className={cn(
              'w-2 h-2 rounded-full',
              customer.marketingConsent ? 'bg-green-400' : 'bg-gray-600'
            )} />
            <span className="text-xs text-gray-500">
              {customer.marketingConsent ? 'Opted in to marketing' : 'Not opted in to marketing'}
            </span>
            {customer.source && (
              <span className="ml-auto text-xs text-gray-600">Source: {customer.source}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
