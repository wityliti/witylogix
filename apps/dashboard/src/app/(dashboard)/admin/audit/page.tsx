'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Package,
  Route,
  Settings,
  Trash2,
  Plus,
  Edit3,
  Eye,
  FileText,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';

// ── Types ────────────────────────────────────────────────────────

type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';

interface AuditEntry {
  id: string;
  shop_id: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}


// ── Helpers ──────────────────────────────────────────────────────

const ACTION_META: Record<AuditAction, { label: string; color: string; icon: typeof Plus }> = {
  CREATE: { label: 'Create', color: 'text-wl-success-400 bg-wl-success-400/10 border-wl-success-400/20', icon: Plus },
  READ:   { label: 'Read',   color: 'text-wl-info-400 bg-wl-info-400/10 border-wl-info-400/20',          icon: Eye },
  UPDATE: { label: 'Update', color: 'text-wl-warning-400 bg-wl-warning-400/10 border-wl-warning-400/20',        icon: Edit3 },
  DELETE: { label: 'Delete', color: 'text-wl-danger-400 bg-wl-danger-400/10 border-wl-danger-400/20',              icon: Trash2 },
  EXPORT: { label: 'Export', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',     icon: Download },
};

const RESOURCE_ICONS: Record<string, typeof User> = {
  order:    Package,
  route:    Route,
  driver:   User,
  user:     User,
  settings: Settings,
  billing:  FileText,
  zone:     Route,
  webhook:  RefreshCw,
  report:   FileText,
  audit:    ShieldCheck,
};

function resourceIcon(type: string) {
  return RESOURCE_ICONS[type.toLowerCase()] ?? FileText;
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
}

function ChangePill({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes) return null;
  const keys = Object.keys(changes);
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {keys.slice(0, 3).map((k) => {
        const val = changes[k] as [unknown, unknown] | undefined;
        return (
          <span key={k} className="text-[10px] font-mono bg-white/[0.04] border border-wl-border-subtle rounded px-1.5 py-0.5 text-wl-text-tertiary">
            {k}: {Array.isArray(val) ? `${String(val[0])} → ${String(val[1])}` : String(val)}
          </span>
        );
      })}
      {keys.length > 3 && <span className="text-[10px] text-wl-text-tertiary">+{keys.length - 3} more</span>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

const RESOURCE_TYPES = ['order', 'driver', 'route', 'user', 'settings', 'billing', 'zone', 'webhook', 'report'];
const PAGE_SIZE = 25;

export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const qs = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (actionFilter) params.set('action', actionFilter);
    if (resourceFilter) params.set('resource', resourceFilter);
    if (dateFrom) params.set('startDate', new Date(dateFrom).toISOString());
    if (dateTo) params.set('endDate', new Date(dateTo + 'T23:59:59').toISOString());
    return params.toString();
  }, [page, actionFilter, resourceFilter, dateFrom, dateTo]);

  const { data, loading, error, refetch } = useApiQuery<AuditResponse>(`/api/v4/audit?${qs}`);

  const entries: AuditEntry[] = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.resource_type.toLowerCase().includes(q) ||
        e.resource_id.toLowerCase().includes(q) ||
        (e.user_id ?? '').toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (resourceFilter) params.set('resource', resourceFilter);
    if (dateFrom) params.set('startDate', new Date(dateFrom).toISOString());
    if (dateTo) params.set('endDate', new Date(dateTo + 'T23:59:59').toISOString());
    return `/api/v4/audit/export?${params.toString()}`;
  }, [actionFilter, resourceFilter, dateFrom, dateTo]);

  const resetFilters = useCallback(() => {
    setActionFilter('');
    setResourceFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  }, []);

  const actionCounts = useMemo(() => {
    const counts: Partial<Record<AuditAction | 'total', number>> = { total: entries.length };
    for (const e of entries) counts[e.action] = (counts[e.action] ?? 0) + 1;
    return counts;
  }, [entries]);

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary tracking-tight">Audit Trail</h1>
              <p className="text-sm text-wl-text-tertiary mt-0.5">Compliance log of all admin and system actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-wl-text-tertiary hover:text-wl-text-secondary border border-wl-border-subtle rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <a
              href={exportUrl}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-wl-text-secondary hover:text-wl-text-primary bg-white/[0.04] border border-wl-border-default rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-4">
        {/* Action summary chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.entries(ACTION_META) as [AuditAction, typeof ACTION_META[AuditAction]][]).map(([action, meta]) => {
            const count = actionCounts[action] ?? 0;
            const IconC = meta.icon;
            return (
              <button
                key={action}
                onClick={() => { setActionFilter(actionFilter === action ? '' : action); setPage(1); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                  actionFilter === action ? meta.color : 'bg-white/[0.03] border-wl-border-subtle text-wl-text-tertiary hover:text-wl-text-secondary',
                )}
              >
                <IconC className="w-3 h-3" />
                {meta.label}
                <span className="font-mono opacity-60">{count}</span>
              </button>
            );
          })}
          {(actionFilter || resourceFilter || dateFrom || dateTo || search) && (
            <button onClick={resetFilters} className="text-xs text-wl-text-tertiary hover:text-wl-text-secondary px-2 py-1.5 transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
            <input
              type="text"
              placeholder="Search resource, ID, user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-wl-bg-surface border border-wl-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-wl-text-secondary placeholder:text-wl-text-tertiary focus:outline-none focus:border-wl-border-strong transition-colors"
            />
          </div>

          {/* Resource type */}
          <select
            value={resourceFilter}
            onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
            className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg px-3 py-2 text-sm text-wl-text-secondary focus:outline-none focus:border-wl-border-strong transition-colors"
          >
            <option value="">All resources</option>
            {RESOURCE_TYPES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-wl-text-tertiary" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg px-2.5 py-2 text-sm text-wl-text-secondary focus:outline-none focus:border-wl-border-strong transition-colors"
            />
            <span className="text-wl-text-tertiary text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-wl-bg-surface border border-wl-border-subtle rounded-lg px-2.5 py-2 text-sm text-wl-text-secondary focus:outline-none focus:border-wl-border-strong transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[7rem_1fr_7rem_9rem_9rem] gap-3 px-5 py-2.5 text-[10px] text-wl-text-tertiary font-medium uppercase tracking-wider border-b border-wl-border-subtle bg-white/[0.01]">
            <span>Action</span>
            <span>Resource</span>
            <span>User</span>
            <span>IP Address</span>
            <span className="text-right">Timestamp</span>
          </div>

          {loading ? (
            <div className="space-y-px p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.02] rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="w-10 h-10 text-wl-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-wl-text-tertiary">No audit entries match your filters</p>
            </div>
          ) : (
            <div>
              {filtered.map((entry) => {
                const actionMeta = ACTION_META[entry.action] ?? ACTION_META.READ;
                const ActionIcon = actionMeta.icon;
                const ResIcon = resourceIcon(entry.resource_type);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[7rem_1fr_7rem_9rem_9rem] gap-3 px-5 py-3 items-start border-b border-wl-border-subtle last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Action badge */}
                    <div>
                      <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border', actionMeta.color)}>
                        <ActionIcon className="w-3 h-3" />
                        {actionMeta.label}
                      </span>
                    </div>

                    {/* Resource */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ResIcon className="w-3.5 h-3.5 text-wl-text-tertiary shrink-0" />
                        <span className="text-sm text-wl-text-secondary capitalize font-medium">{entry.resource_type}</span>
                        <span className="text-[11px] font-mono text-wl-text-tertiary truncate">{entry.resource_id}</span>
                      </div>
                      <ChangePill changes={entry.changes} />
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div className="mt-1 text-[10px] text-wl-text-tertiary font-mono truncate">
                          {Object.entries(entry.metadata).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                        </div>
                      )}
                    </div>

                    {/* User */}
                    <div className="text-[11px] font-mono text-wl-text-tertiary truncate">
                      {entry.user_id ? entry.user_id.slice(-8) : 'system'}
                    </div>

                    {/* IP */}
                    <div className="text-[11px] font-mono text-wl-text-tertiary">
                      {entry.ip_address ?? '—'}
                    </div>

                    {/* Timestamp */}
                    <div className="text-[11px] font-mono text-wl-text-tertiary text-right">
                      {formatTs(entry.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-wl-text-tertiary">
          <span className="text-[12px]">
            {pagination.total.toLocaleString()} entries · page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-7 h-7 text-xs font-mono rounded transition-colors',
                  p === pagination.page ? 'bg-white/10 text-wl-text-secondary' : 'hover:bg-white/[0.05] text-wl-text-tertiary',
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={pagination.page >= pagination.pages}
              className="p-1.5 rounded hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
