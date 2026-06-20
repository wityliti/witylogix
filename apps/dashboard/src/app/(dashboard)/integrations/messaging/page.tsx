'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { MessageSquare, CheckCircle2, AlertCircle, Bell, RefreshCw, Plus } from 'lucide-react';

interface IntegrationConnection {
  id: string;
  providerName: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

const SMS_SLUGS = new Set(['twilio', 'vonage', 'aws_sns', 'messagebird', 'plivo']);
const PUSH_SLUGS = new Set(['firebase', 'onesignal', 'expo_push']);
const MESSAGING_SLUGS = new Set([...SMS_SLUGS, ...PUSH_SLUGS]);

function statusVariant(s: string): 'success' | 'danger' | 'warning' | 'default' {
  if (s === 'connected') return 'success';
  if (s === 'error') return 'danger';
  if (s === 'pending') return 'warning';
  return 'default';
}

function timeSince(iso?: string) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MessagingIntegrationsPage() {
  const { items: allComm, loading, error, refetch } = useApiList<IntegrationConnection>(
    '/api/v4/integrations/connections?category=communication',
    { limit: 100 },
  );

  const providers = useMemo(
    () => allComm.filter((c) => MESSAGING_SLUGS.has(c.id.toLowerCase())),
    [allComm],
  );

  const stats = useMemo(() => ({
    sms: providers.filter((p) => SMS_SLUGS.has(p.id.toLowerCase())).length,
    push: providers.filter((p) => PUSH_SLUGS.has(p.id.toLowerCase())).length,
    healthy: providers.filter((p) => p.status === 'connected').length,
    errors: providers.filter((p) => p.status === 'error').length,
  }), [providers]);

  if (loading && allComm.length === 0) return <LoadingSkeleton />;
  if (error && allComm.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Messaging Integrations"
        subtitle="Manage SMS, push notification, and chat providers"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Link href="/integrations/marketplace?category=COMMUNICATION">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add Provider
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'SMS Providers', value: stats.sms, icon: MessageSquare, color: 'text-blue-400' },
            { label: 'Push Providers', value: stats.push, icon: Bell, color: 'text-violet-400' },
            { label: 'Healthy', value: stats.healthy, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'With Errors', value: stats.errors, icon: AlertCircle, color: 'text-red-400' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={cn('w-5 h-5 shrink-0', s.color)} />
                  <div>
                    <p className="text-xs text-wl-text-muted">{s.label}</p>
                    <p className="text-xl font-bold text-wl-text-primary">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>Messaging Providers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {providers.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
                <p className="text-wl-text-secondary mb-1">No messaging providers configured</p>
                <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                  Connect Twilio, Vonage, Firebase Cloud Messaging, OneSignal, and more to send
                  SMS, push notifications, and in-app messages.
                </p>
                <Link href="/integrations/marketplace?category=COMMUNICATION">
                  <Button variant="primary">Browse Marketplace</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-wl-border-default">
                {providers.map((conn) => {
                  const type = SMS_SLUGS.has(conn.id.toLowerCase()) ? 'SMS' : 'Push';
                  return (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-wl-bg-overlay transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-wl-bg-overlay flex items-center justify-center text-xs font-bold text-wl-text-secondary uppercase">
                          {conn.providerName.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-wl-text-primary">{conn.providerName}</p>
                          <p className="text-xs text-wl-text-muted">
                            {type} · Last used: {timeSince(conn.lastSyncTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-wl-text-muted hidden sm:block">
                          {conn.apiCallsCount.toLocaleString()} calls
                        </span>
                        <Badge variant={statusVariant(conn.status)} dot>
                          {conn.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
