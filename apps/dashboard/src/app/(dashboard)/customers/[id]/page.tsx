'use client';

import { use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCustomer, useCustomerOrders, customerName, type CustomerAddress } from '@/hooks/use-customers';

const fmt = (n: string | number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'info' | 'primary'> = {
  DELIVERED: 'success',
  IN_TRANSIT: 'info',
  PENDING: 'warning',
  CANCELLED: 'default',
  FAILED: 'default',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1e1e2e] last:border-0">
      <span className="text-xs text-gray-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-200 flex-1">{value || '—'}</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-[#1e1e2e] rounded animate-pulse', className)} />;
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: customer, loading, error, refetch } = useCustomer(id);
  const { data: ordersData, loading: ordersLoading } = useCustomerOrders(id);

  const addresses = (customer?.addresses ?? []) as CustomerAddress[];
  const orders = ordersData?.orders ?? [];

  if (error) {
    return (
      <>
        <Header title="Customer" subtitle="Not found" />
        <div className="p-6">
          <Card className="p-8 text-center">
            <div className="text-4xl mb-4">⚠</div>
            <p className="text-gray-300 font-medium">Failed to load customer</p>
            <p className="text-gray-500 text-sm mt-1">{error.message}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
              <Link href="/customers">
                <Button variant="ghost" size="sm">← Back to Customers</Button>
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={loading ? 'Loading…' : customerName(customer!)}
        subtitle={
          loading ? '' : [customer?.email, customer?.source].filter(Boolean).join(' · ')
        }
        actions={
          <Link href="/customers">
            <Button variant="secondary" size="md">← Back</Button>
          </Link>
        }
      />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile card */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-5">
              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : customer ? (
                <>
                  <div className="flex items-center gap-4 mb-5">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6366f1 0%,#818cf8 100%)', color: '#fff' }}
                    >
                      {(customer.firstName?.[0] ?? customer.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate">
                        {customerName(customer)}
                      </h2>
                      <p className="text-xs text-gray-400 truncate">{customer.email ?? 'No email'}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {customer.marketingConsent && (
                          <Badge variant="success" className="text-xs">Marketing</Badge>
                        )}
                        {customer.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="default" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <InfoRow label="Email" value={customer.email} />
                    <InfoRow label="Phone" value={customer.phone} />
                    <InfoRow label="Source" value={customer.source} />
                    <InfoRow label="External ID" value={
                      <span className="font-mono text-xs text-gray-400">{customer.externalCustomerId}</span>
                    } />
                    <InfoRow label="Orders" value={
                      <span className="font-semibold text-white">{customer.ordersCount}</span>
                    } />
                    <InfoRow label="Total Spent" value={
                      <span className="font-semibold text-white">{fmt(customer.totalSpent)}</span>
                    } />
                    <InfoRow label="Last Sync" value={fmtDate(customer.lastSyncAt)} />
                    <InfoRow label="Customer since" value={fmtDate(customer.createdAt)} />
                    {customer.notes && (
                      <InfoRow label="Notes" value={
                        <span className="text-gray-400 text-xs">{customer.notes}</span>
                      } />
                    )}
                  </div>
                </>
              ) : null}
            </Card>

            {/* Addresses */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Addresses</h3>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : addresses.length === 0 ? (
                <p className="text-xs text-gray-500">No addresses on file</p>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-lg border text-xs',
                        addr.default
                          ? 'border-[#6366f1]/40 bg-[#6366f1]/5'
                          : 'border-[#1e1e2e] bg-[#1a1a2e]'
                      )}
                    >
                      {addr.default && (
                        <Badge variant="primary" className="text-xs mb-1">Default</Badge>
                      )}
                      <div className="text-gray-300 leading-relaxed">
                        {addr.address1 && <div>{addr.address1}</div>}
                        <div>
                          {[addr.city, addr.province, addr.zip].filter(Boolean).join(', ')}
                        </div>
                        {addr.country && <div>{addr.country}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Orders history */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden p-0">
              <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Order History</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ordersLoading ? 'Loading…' : `${orders.length} orders`}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e] bg-[#1a1a2e]">
                      <th className="p-3 px-4 text-left font-semibold text-gray-300"># Order</th>
                      <th className="p-3 px-4 text-left font-semibold text-gray-300">Status</th>
                      <th className="p-3 px-4 text-right font-semibold text-gray-300">Value</th>
                      <th className="p-3 px-4 text-left font-semibold text-gray-300">City</th>
                      <th className="p-3 px-4 text-left font-semibold text-gray-300">Driver</th>
                      <th className="p-3 px-4 text-left font-semibold text-gray-300">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-[#1e1e2e]">
                          <td colSpan={6} className="px-4 py-3 h-12">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                          <div className="text-2xl mb-2">📦</div>
                          <p className="text-sm">No orders found for this customer</p>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e]/60 transition-colors"
                        >
                          <td className="p-3 px-4 text-white font-mono text-xs">
                            {order.externalOrderNumber ? `#${order.externalOrderNumber}` : order.id.slice(0, 8)}
                          </td>
                          <td className="p-3 px-4">
                            <Badge variant={STATUS_VARIANT[order.status] ?? 'default'}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="p-3 px-4 text-right text-white font-semibold">
                            {fmt(order.totalPrice)}
                          </td>
                          <td className="p-3 px-4 text-gray-300 text-xs">{order.city ?? '—'}</td>
                          <td className="p-3 px-4 text-gray-300 text-xs">
                            {order.driver?.name ?? '—'}
                          </td>
                          <td className="p-3 px-4 text-gray-400 text-xs">{fmtDate(order.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
