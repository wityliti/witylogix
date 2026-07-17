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
import { PenLine, FileCheck, RefreshCw, Plus } from 'lucide-react';

interface SigningTemplate {
  id: string;
  name: string;
  status: string;
  provider?: string;
  createdAt?: string;
}

export default function ESignaturesIntegrationPage() {
  const { items: templates, pagination, loading, error, refetch } = useApiList<SigningTemplate>(
    '/api/v4/signing-templates',
    { limit: 50 },
  );

  const stats = useMemo(() => ({
    templates: pagination.total || templates.length,
    active: templates.filter((t) => t.status === 'active').length,
  }), [templates, pagination.total]);

  if (loading && templates.length === 0) return <LoadingSkeleton />;
  if (error && templates.length === 0) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="E-Signature Integrations"
        subtitle="Manage e-signature provider connections and document templates"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Link href="/integrations/marketplace">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add Provider
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          {[
            { label: 'Signing Templates', value: stats.templates, icon: FileCheck, color: 'text-wl-info-400' },
            { label: 'Active Templates', value: stats.active, icon: PenLine, color: 'text-wl-success-400' },
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
            <CardTitle>E-Signature Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-8 text-center">
              <PenLine className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
              <p className="text-wl-text-secondary mb-1">No e-signature providers connected</p>
              <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                Connect DocuSign, Adobe Sign, HelloSign, PandaDoc, and more to send, track,
                and manage e-signatures on contracts and agreements.
              </p>
              <Link href="/integrations/marketplace">
                <Button variant="primary">Browse Marketplace</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>Signing Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {templates.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-wl-text-muted">No signing templates yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-wl-border-default">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-wl-bg-overlay transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="w-4 h-4 text-wl-text-muted shrink-0" />
                      <p className="text-sm font-medium text-wl-text-primary">{tmpl.name}</p>
                    </div>
                    <Badge variant={tmpl.status === 'active' ? 'success' : 'default'} dot>
                      {tmpl.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
