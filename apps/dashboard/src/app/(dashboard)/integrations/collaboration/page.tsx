'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import Link from 'next/link';
import {
  Slack,
  MessageSquare,
  Send,
  Activity,
  Users,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plug,
  Settings,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { useApiList, useApiQuery } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════
   COLLABORATION INTEGRATIONS PAGE — real API data
   Providers:  /api/v4/integrations/connections (messaging/collaboration category)
   Team:       /api/v4/settings/team
   Stats:      /api/v4/notifications/stats?days=30
   ═══════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────

interface Connection {
  id: string;
  providerName: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

interface TeamMember {
  id: string;
  name?: string;
  email: string;
  role: string;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  channels: Record<string, { sent: number; delivered: number; failed: number }>;
}

// ── Helpers ──────────────────────────────────────────────────

function providerIcon(name: string): React.ReactNode {
  const n = name.toLowerCase();
  if (n.includes('slack')) return <Slack className="w-5 h-5" />;
  if (n.includes('teams') || n.includes('microsoft')) return <MessageSquare className="w-5 h-5" />;
  if (n.includes('pusher')) return <Send className="w-5 h-5" />;
  if (n.includes('track') || n.includes('pod')) return <Activity className="w-5 h-5" />;
  return <MessageCircle className="w-5 h-5" />;
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'default' {
  if (s === 'connected') return 'success';
  if (s === 'error') return 'danger';
  if (s === 'pending') return 'warning';
  return 'default';
}

function statusIcon(s: string) {
  if (s === 'connected') return <CheckCircle2 className="w-4 h-4 text-wl-success-400" />;
  if (s === 'error') return <AlertCircle className="w-4 h-4 text-wl-danger-400" />;
  return <Clock className="w-4 h-4 text-wl-text-tertiary" />;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtSync = (iso?: string) => {
  if (!iso) return 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const MESSAGING_KEYWORDS = ['slack', 'teams', 'microsoft', 'pusher', 'track', 'workwave', 'podium', 'dispatch'];
const MESSAGING_CATEGORIES = new Set(['messaging', 'collaboration', 'communication', 'chat', 'notifications']);

function isMessagingConnection(c: Connection): boolean {
  return (
    MESSAGING_CATEGORIES.has(c.category) ||
    MESSAGING_KEYWORDS.some((k) => c.providerName.toLowerCase().includes(k))
  );
}

// ── Providers Section ────────────────────────────────────────

function ProvidersSection({
  connections,
  loading,
  error,
}: {
  connections: Connection[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  const messagingConnections = connections.filter(isMessagingConnection);

  if (messagingConnections.length === 0) {
    return (
      <Card className="p-12 text-center bg-wl-bg-surface border-wl-border-default">
        <div className="w-12 h-12 rounded-full bg-wl-bg-overlay flex items-center justify-center mx-auto mb-4">
          <Plug className="w-6 h-6 text-wl-text-tertiary" />
        </div>
        <p className="text-sm font-medium text-wl-text-secondary mb-1">
          No collaboration integrations connected
        </p>
        <p className="text-xs text-wl-text-tertiary mb-4">
          Connect Slack, Microsoft Teams, or other messaging platforms to receive real-time logistics alerts.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => (window.location.href = '/integrations/catalog')}
        >
          Browse Integrations
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {messagingConnections.map((c) => (
        <Card
          key={c.id}
          className="p-5 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong transition-colors"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-wl-bg-overlay flex items-center justify-center text-wl-text-secondary">
                {providerIcon(c.providerName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {statusIcon(c.status)}
                  <p className="text-sm font-semibold text-wl-text-primary">{c.providerName}</p>
                </div>
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  Synced {fmtSync(c.lastSyncTime)}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant(c.status)} dot>
              {c.status}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-wl-border-subtle pt-4">
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-wl-text-primary">
                {c.apiCallsCount.toLocaleString()}
              </p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">Events</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  'text-lg font-bold font-mono',
                  c.errorCount > 0 ? 'text-wl-danger-400' : 'text-wl-success-400',
                )}
              >
                {c.errorCount}
              </p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">Errors</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold font-mono text-wl-text-primary">{c.uptime}%</p>
              <p className="text-xs text-wl-text-tertiary mt-0.5">Uptime</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Team Section ─────────────────────────────────────────────

function TeamSection({
  members,
  loading,
  error,
}: {
  members: TeamMember[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  if (members.length === 0) {
    return (
      <Card className="p-8 text-center bg-wl-bg-surface border-wl-border-default">
        <Users className="w-8 h-8 text-wl-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-wl-text-secondary">No team members yet</p>
        <Link href="/settings/team">
          <Button variant="ghost" size="sm" className="mt-3">
            Manage Team
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.map((m) => (
        <Card
          key={m.id}
          className="p-4 bg-wl-bg-surface border-wl-border-default"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-wl-primary-500/10 flex items-center justify-center text-wl-primary-400 font-semibold text-sm shrink-0">
              {(m.name ?? m.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-wl-text-primary truncate">
                {m.name || m.email}
              </p>
              {m.name && (
                <p className="text-xs text-wl-text-tertiary truncate">{m.email}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className="text-[10px] py-0">
                  {m.role}
                </Badge>
                <span className="text-[10px] text-wl-text-tertiary">
                  Since {fmtDate(m.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Delivery Stats Section ────────────────────────────────────

function DeliveryStatsSection({
  stats,
  loading,
  error,
}: {
  stats: NotificationStats | null;
  loading: boolean;
  error: Error | null;
}) {
  if (loading) return <LoadingSkeleton />;
  if (error || !stats) {
    return (
      <Card className="p-8 text-center bg-wl-bg-surface border-wl-border-default">
        <p className="text-sm text-wl-text-secondary">No delivery stats available</p>
      </Card>
    );
  }

  const channels = Object.entries(stats.channels ?? {});

  if (channels.length === 0) {
    return (
      <Card className="p-8 text-center bg-wl-bg-surface border-wl-border-default">
        <p className="text-sm text-wl-text-secondary">No notifications sent yet</p>
        <p className="text-xs text-wl-text-tertiary mt-1">
          Stats will appear once notifications have been dispatched.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {channels.map(([channel, data]) => {
        const successRate =
          data.sent > 0 ? ((data.delivered / data.sent) * 100).toFixed(1) : '0';
        return (
          <Card
            key={channel}
            className="p-5 bg-wl-bg-surface border-wl-border-default"
          >
            <p className="text-sm font-semibold text-wl-text-primary mb-4 uppercase tracking-wide text-xs">
              {channel}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold font-mono text-wl-text-primary">
                  {data.sent.toLocaleString()}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">Sent</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono text-wl-success-400">
                  {data.delivered.toLocaleString()}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">Delivered</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-lg font-bold font-mono',
                    data.failed > 0 ? 'text-wl-danger-400' : 'text-wl-text-tertiary',
                  )}
                >
                  {data.failed}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">Failed</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-wl-text-tertiary">Success Rate</span>
                <span className="text-xs font-semibold text-wl-success-400">{successRate}%</span>
              </div>
              <div className="w-full h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                <div
                  className="h-full bg-wl-success-500 rounded-full"
                  style={{ width: `${successRate}%` }}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function CollaborationPage() {
  const [activeSection, setActiveSection] = useState<
    'providers' | 'team' | 'stats' | 'routes'
  >('providers');

  const {
    items: connections,
    loading: connLoading,
    error: connError,
  } = useApiList<Connection>('/api/v4/integrations/connections');

  const {
    items: teamMembers,
    loading: teamLoading,
    error: teamError,
  } = useApiList<TeamMember>('/api/v4/settings/team');

  const {
    data: notifStats,
    loading: statsLoading,
    error: statsError,
  } = useApiQuery<NotificationStats>('/api/v4/notifications/stats?days=30');

  const messagingCount = useMemo(
    () => connections.filter(isMessagingConnection).length,
    [connections],
  );

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  const SECTIONS = [
    { id: 'providers' as const, label: `Providers (${messagingCount})`, icon: Plug },
    { id: 'team' as const, label: `Team (${teamMembers.length})`, icon: Users },
    { id: 'stats' as const, label: 'Delivery Stats', icon: Activity },
    { id: 'routes' as const, label: 'Message Routes', icon: Send },
  ];

  return (
    <>
      <Header
        title="Collaboration Integrations"
        subtitle={`${connectedCount} integrations active · ${teamMembers.length} team members`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/settings/notifications">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-1.5" />
                Notification Settings
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              onClick={() => (window.location.href = '/integrations/catalog')}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Integration
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Section tabs */}
        <div className="flex gap-1 p-1 bg-wl-bg-elevated rounded-lg border border-wl-border-subtle w-fit flex-wrap">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeSection === id
                  ? 'bg-wl-bg-overlay text-wl-text-primary shadow-sm'
                  : 'text-wl-text-tertiary hover:text-wl-text-secondary',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {activeSection === 'providers' && (
          <ProvidersSection
            connections={connections}
            loading={connLoading}
            error={connError}
          />
        )}

        {activeSection === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-wl-text-primary">Team Members</p>
              <Link href="/settings/team">
                <Button variant="ghost" size="sm">
                  Manage Team
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
            <TeamSection
              members={teamMembers}
              loading={teamLoading}
              error={teamError}
            />
          </div>
        )}

        {activeSection === 'stats' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-wl-text-primary">
              Notification Delivery (last 30 days)
            </p>
            <DeliveryStatsSection
              stats={notifStats}
              loading={statsLoading}
              error={statsError}
            />
          </div>
        )}

        {activeSection === 'routes' && (
          <Card className="p-12 text-center bg-wl-bg-surface border-wl-border-default">
            <div className="w-12 h-12 rounded-full bg-wl-bg-overlay flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-wl-text-tertiary" />
            </div>
            <p className="text-sm font-medium text-wl-text-secondary mb-1">
              Message routing coming soon
            </p>
            <p className="text-xs text-wl-text-tertiary mb-4">
              Route logistics events (delivery updates, driver alerts, exceptions) to specific channels and teams.
            </p>
            <Link href="/settings/notifications">
              <Button variant="ghost" size="sm">
                Configure Notification Preferences
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}
