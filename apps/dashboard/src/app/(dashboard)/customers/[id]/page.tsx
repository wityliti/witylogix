'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  ShoppingBag,
  DollarSign,
  Star,
  Calendar,
  Package,
  MapPin,
  ChevronRight,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WLMap } from '@/components/map/wl-map';
import { PinLayer, type Pin } from '@/components/map/pin-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { useCustomer, useCustomerOrders, type CustomerOrder } from '@/hooks/use-customers';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [0, 20];

const TIER_VARIANT: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'default'> = {
  enterprise: 'primary',
  premium: 'success',
  standard: 'info',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active: 'success',
  inactive: 'default',
  blocked: 'danger',
};

const ORDER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DELIVERED: 'success',
  OUT_FOR_DELIVERY: 'info',
  IN_TRANSIT: 'info',
  ASSIGNED: 'warning',
  PENDING: 'warning',
  CONFIRMED: 'info',
  CANCELLED: 'danger',
  FAILED: 'danger',
  RETURNED: 'default',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: string | number | null): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Map inner component (must be inside WLMap) ───────────────────────────────

interface DeliveryPinsInnerProps {
  pins: Pin[];
}

function DeliveryPinsInner({ pins }: DeliveryPinsInnerProps) {
  const map = useWLMap();
  useFitBounds(map, pins, 60);
  return <PinLayer pins={pins} />;
}

// ─── Customer Map View ────────────────────────────────────────────────────────

interface CustomerMapViewProps {
  orders: CustomerOrder[];
}

function CustomerMapView({ orders }: CustomerMapViewProps) {
  const pins = useMemo<Pin[]>(() => {
    const result: Pin[] = [];
    orders.forEach((o) => {
      const loc = o.deliveryLocation as { lat?: number; lng?: number } | null;
      if (loc?.lat && loc?.lng) {
        result.push({
          id: o.id,
          lat: loc.lat,
          lng: loc.lng,
          status:
            o.status === 'DELIVERED'
              ? 'in_transit'
              : o.status === 'CANCELLED' || o.status === 'FAILED'
              ? 'delayed'
              : o.status === 'PENDING' || o.status === 'CONFIRMED'
              ? 'open'
              : 'assigned',
          label: o.externalOrderNumber ?? o.id.slice(-6),
        });
      }
    });
    return result;
  }, [orders]);

  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return DEFAULT_CENTER;
    const avgLng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    return [avgLng, avgLat];
  }, [pins]);

  if (pins.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/30">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">No delivery locations on record</p>
      </div>
    );
  }

  return (
    <WLMap center={center} zoom={10} className="w-full h-full">
      <DeliveryPinsInner pins={pins} />
    </WLMap>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-white/[0.06]', className)} />;
}

function CustomerDetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-32 h-5" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 bg-wl-bg-elevated border-wl-border-subtle">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-5 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-4 w-1/2 mx-auto mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4 bg-wl-bg-elevated border-wl-border-subtle">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-20" />
              </Card>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-wl-bg-elevated border-wl-border-subtle overflow-hidden" style={{ height: 320 }}>
            <Skeleton className="w-full h-full" />
          </Card>
          <Card className="bg-wl-bg-elevated border-wl-border-subtle p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, loading: customerLoading, error: customerError } = useCustomer(id ?? null);
  const { data: ordersData, loading: ordersLoading, error: ordersError } = useCustomerOrders(id ?? null);

  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData]);

  // Derived stats
  const avgOrderValue = useMemo(() => {
    if (!customer || customer.totalOrders === 0) return 0;
    return customer.totalSpent / customer.totalOrders;
  }, [customer]);

  const lastOrder = useMemo(() => {
    if (orders.length === 0) return null;
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [orders]);

  // ── Loading state ────────────────────────────────────────────
  if (customerLoading) return <CustomerDetailSkeleton />;

  // ── Error state ──────────────────────────────────────────────
  if (customerError || !customer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Package className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-1">
            {customerError?.message?.includes('404') ? 'Customer not found' : 'Failed to load customer'}
          </h2>
          <p className="text-sm text-white/40">
            {customerError?.message ?? 'The customer you are looking for does not exist.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/customers')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Button>
      </div>
    );
  }

  // ── Avatar initials ──────────────────────────────────────────
  const initials = customer.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarBg = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#ef4444', '#3b82f6',
  ][customer.name.charCodeAt(0) % 8];

  return (
    <div className="min-h-screen bg-[var(--wl-bg-root,#0a0a0f)]">
      {/* ── Back nav ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-wl-bg-root/90 backdrop-blur border-b border-white/[0.06] px-6 py-3">
        <button
          onClick={() => router.push('/customers')}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Customers
        </button>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: Profile + Stats ───────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Profile card */}
            <Card className="p-6 bg-wl-bg-surface border border-white/[0.06] text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4"
                style={{ backgroundColor: avatarBg }}
              >
                {initials}
              </div>
              <h1 className="text-lg font-bold text-white mb-1">{customer.name}</h1>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant={TIER_VARIANT[customer.tier] ?? 'default'}>
                  <Star className="w-3 h-3 mr-1" />
                  {customer.tier}
                </Badge>
                <Badge variant={STATUS_VARIANT[customer.status] ?? 'default'}>
                  {customer.status}
                </Badge>
              </div>

              {/* Contact */}
              <div className="space-y-2.5 text-left">
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded bg-white/[0.05] flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5 text-white/40" />
                    </div>
                    <span className="text-white/60 truncate">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded bg-white/[0.05] flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5 text-white/40" />
                    </div>
                    <span className="text-white/60">{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded bg-white/[0.05] flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-white/40" />
                  </div>
                  <span className="text-white/40">
                    Member since {fmtDate(customer.createdAt)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Total Orders"
                value={customer.totalOrders}
                icon={ShoppingBag}
                accent="#6366f1"
              />
              <StatTile
                label="Total Spent"
                value={fmt(customer.totalSpent)}
                icon={DollarSign}
                accent="#10b981"
              />
              <StatTile
                label="Avg Order Value"
                value={fmt(avgOrderValue)}
                icon={TrendingUp}
                accent="#f59e0b"
              />
              <StatTile
                label="Last Order"
                value={fmtRelative(lastOrder?.createdAt)}
                icon={Clock}
                accent="#06b6d4"
              />
            </div>

            {/* Tags */}
            {customer.addresses && customer.addresses.length > 0 && (
              <Card className="p-4 bg-wl-bg-surface border border-white/[0.06]">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Saved Addresses
                </h3>
                <div className="space-y-2">
                  {customer.addresses.slice(0, 3).map((addr, i) => (
                    <div key={addr.id ?? i} className="flex items-start gap-2 text-xs text-white/50">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-white/30" />
                      <span>{[addr.address1, addr.city, addr.province, addr.country].filter(Boolean).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* ── Right column: Map + Orders ──────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Map: delivery pin locations */}
            <Card className="overflow-hidden border border-white/[0.06] bg-wl-bg-surface" style={{ height: 340 }}>
              <CardHeader className="px-4 py-3 border-b border-white/[0.06]">
                <CardTitle className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery Locations
                  {orders.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-white/30">
                      {orders.filter((o) => {
                        const loc = o.deliveryLocation as { lat?: number; lng?: number } | null;
                        return loc?.lat && loc?.lng;
                      }).length} pinned
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <div className="h-[calc(100%-48px)]">
                {ordersLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                  </div>
                ) : (
                  <CustomerMapView orders={orders} />
                )}
              </div>
            </Card>

            {/* Order history */}
            <Card className="bg-wl-bg-surface border border-white/[0.06]">
              <CardHeader className="px-5 py-4 border-b border-white/[0.06]">
                <CardTitle className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Order History
                  <Badge variant="default" className="ml-auto">
                    {orders.length} orders
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ordersLoading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-white/[0.04]" />
                    ))}
                  </div>
                ) : ordersError ? (
                  <div className="p-8 text-center text-white/30 text-sm">
                    Failed to load orders
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-12 flex flex-col items-center gap-3 text-white/30">
                    <ShoppingBag className="w-8 h-8" />
                    <p className="text-sm">No orders yet</p>
                    <p className="text-xs">This customer has not placed any orders.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="px-5 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Order
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Items
                            </th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                              Driver
                            </th>
                            <th className="px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <tr
                              key={order.id}
                              className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            >
                              <td className="px-5 py-3 font-mono text-xs text-white/70">
                                {order.externalOrderNumber ?? `#${order.id.slice(-6)}`}
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'default'}>
                                  {order.status.replace(/_/g, ' ').toLowerCase()}
                                </Badge>
                              </td>
                              <td className="px-5 py-3 text-white/50 text-xs">
                                {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                              </td>
                              <td className="px-5 py-3 text-right font-semibold text-white/80 tabular-nums">
                                {fmt(order.totalPrice)}
                              </td>
                              <td className="px-5 py-3 text-white/40 text-xs">
                                {fmtRelative(order.createdAt)}
                              </td>
                              <td className="px-5 py-3 text-white/40 text-xs">
                                {order.driver?.name ?? '—'}
                              </td>
                              <td className="px-2 py-3">
                                <ChevronRight className="w-4 h-4 text-white/20" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {orders.length >= 20 && (
                      <div className="px-5 py-3 border-t border-white/[0.06] text-center">
                        <span className="text-xs text-white/30">Showing most recent 20 orders</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="p-4 bg-wl-bg-surface border border-white/[0.06] relative overflow-hidden group hover:border-white/[0.10] transition-colors">
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{ background: `linear-gradient(90deg, ${accent}60, transparent)` }}
      />
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-medium text-white/35 uppercase tracking-wider">{label}</span>
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-base font-bold text-white/85 leading-none">{value}</p>
    </Card>
  );
}
