'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Workflow, Trash2, Star } from 'lucide-react';

interface ActivityFlow {
  id: string;
  shopId: string;
  entityType: 'SHIPMENT' | 'ORDER';
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  version: number;
  graph: { stages: Array<{ key: string }> };
  updatedAt: string;
}

type EntityFilter = 'ALL' | 'SHIPMENT' | 'ORDER';

export default function ActivityFlowsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<EntityFilter>('ALL');
  const path =
    filter === 'ALL'
      ? '/api/v4/operations/flows'
      : `/api/v4/operations/flows?entityType=${filter}`;
  const { items: flows, loading, error, refetch } = useApiList<ActivityFlow>(path);

  const counts = useMemo(() => {
    const result = { SHIPMENT: 0, ORDER: 0 };
    for (const f of flows ?? []) result[f.entityType]++;
    return result;
  }, [flows]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Delete this activity flow? Entities using it will fall back to the default flow.',
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/v4/operations/flows/${id}`);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete flow');
    }
  };

  return (
    <div>
      <Header
        title="Activity Flows"
        subtitle="Define how shipments and orders move through your operation."
        actions={
          <Link href="/operations/flows/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New flow
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          {(['ALL', 'SHIPMENT', 'ORDER'] as EntityFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-wl-bg-elevated border border-wl-border-default text-wl-text-primary'
                  : 'px-3 py-1.5 rounded-md text-sm text-wl-text-tertiary hover:text-wl-text-primary hover:bg-wl-bg-elevated'
              }
            >
              {f === 'ALL'
                ? 'All'
                : f === 'SHIPMENT'
                  ? `Shipments (${counts.SHIPMENT})`
                  : `Orders (${counts.ORDER})`}
            </button>
          ))}
        </div>

        {loading && <TableSkeleton rows={4} />}
        {error && <ErrorState message={error.message} onRetry={refetch} />}

        {!loading && !error && flows.length === 0 && (
          <EmptyState
            icon={<Workflow className="w-10 h-10" />}
            title="No activity flows yet"
            description="Build your first flow to control how shipments or orders progress through your operation."
            action={{
              label: 'Create a flow',
              onClick: () => router.push('/operations/flows/new'),
            }}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flows?.map((flow) => (
            <Card
              key={flow.id}
              className="hover:border-wl-border-strong transition-colors"
            >
              <CardHeader className="flex-row justify-between items-start gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <span className="truncate">{flow.name}</span>
                    {flow.isDefault && (
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500 shrink-0" />
                    )}
                  </CardTitle>
                  <CardDescription className="truncate">
                    <code className="text-xs">{flow.key}</code> ·{' '}
                    {flow.entityType.toLowerCase()}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    flow.status === 'ACTIVE'
                      ? 'success'
                      : flow.status === 'DRAFT'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {flow.status.toLowerCase()}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {flow.description && (
                  <p className="text-sm text-wl-text-secondary line-clamp-2">
                    {flow.description}
                  </p>
                )}
                <div className="text-xs text-wl-text-tertiary">
                  {flow.graph?.stages?.length ?? 0} stages · v{flow.version}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/operations/flows/${flow.id}`}
                    className="flex-1"
                  >
                    <Button variant="secondary" className="w-full">
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(flow.id)}
                    aria-label="Delete flow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
