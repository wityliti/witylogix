'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Copy,
  Eye,
  Edit,
  Trash2,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Clock,
  Plus,
  FileText,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION TEMPLATES — real API-backed list
   ═══════════════════════════════════════════════════════════ */

interface ApiTemplate {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'WEBHOOK';
  eventType: string;
  subject?: string | null;
  version: number;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="w-4 h-4" />,
  SMS: <MessageSquare className="w-4 h-4" />,
  WHATSAPP: <MessageSquare className="w-4 h-4" />,
  PUSH: <Bell className="w-4 h-4" />,
  WEBHOOK: <Smartphone className="w-4 h-4" />,
};

function formatEventType(et: string) {
  return et.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationTemplatesPage() {
  const { items: templates, loading, error, refetch } = useApiList<ApiTemplate>(
    '/api/v4/notification-templates',
    { limit: 100 },
  );

  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const eventTypes = useMemo(() => {
    const types = Array.from(new Set(templates.map((t) => t.eventType))).sort();
    return ['all', ...types];
  }, [templates]);

  const filteredTemplates =
    selectedEvent === 'all'
      ? templates
      : templates.filter((t) => t.eventType === selectedEvent);

  const handleDelete = async (id: string) => {
    setActionInProgress(id);
    try {
      await api.delete(`/api/v4/notification-templates/${id}`);
      refetch();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    setActionInProgress(id);
    try {
      await api.patch(`/api/v4/notification-templates/${id}`, { isActive: !isActive });
      refetch();
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      <Header
        title="Notification Templates"
        subtitle="Manage and customize notification templates"
        actions={
          <Link href="/settings/notifications/templates/new">
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: templates.length, color: 'text-wl-text-primary' },
            { label: 'Active', value: templates.filter((t) => t.isActive).length, color: 'text-wl-success-400' },
            { label: 'Inactive', value: templates.filter((t) => !t.isActive).length, color: 'text-wl-warning-400' },
            { label: 'Event Types', value: eventTypes.length - 1, color: 'text-wl-info-400' },
          ].map((s) => (
            <Card key={s.label} className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs font-semibold text-wl-text-muted uppercase tracking-wide mb-1">
                  {s.label}
                </p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Bar */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-wl-text-muted uppercase tracking-wide mb-3">
              Filter by Event
            </p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((eventType) => (
                <button
                  key={eventType}
                  onClick={() => setSelectedEvent(eventType)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    selectedEvent === eventType
                      ? 'bg-wl-primary text-white'
                      : 'bg-wl-bg-overlay text-wl-text-muted hover:text-wl-text-primary border border-wl-border-default',
                  )}
                >
                  {eventType === 'all' ? 'All Events' : formatEventType(eventType)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>
              {filteredTemplates.length} Template{filteredTemplates.length !== 1 ? 's' : ''}
            </CardTitle>
            <CardDescription>
              {selectedEvent === 'all'
                ? 'All notification templates'
                : `Templates for ${formatEventType(selectedEvent)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-wl-text-muted mx-auto mb-3" />
                <p className="text-sm font-semibold text-wl-text-primary mb-1">
                  {templates.length === 0 ? 'No templates yet' : 'No templates match this filter'}
                </p>
                <p className="text-xs text-wl-text-muted">
                  {templates.length === 0
                    ? 'Create your first notification template to get started.'
                    : 'Try selecting a different event type.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Name & Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <span className="text-sm font-medium text-wl-text-primary">
                            {formatEventType(template.eventType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-wl-text-muted">
                              {CHANNEL_ICONS[template.channel] ?? <Bell className="w-4 h-4" />}
                            </span>
                            <span className="text-sm capitalize text-wl-text-primary">
                              {template.channel.toLowerCase()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-wl-text-primary">
                              {template.name}
                            </p>
                            {template.subject && (
                              <p className="text-xs text-wl-text-muted mt-0.5 truncate max-w-xs">
                                {template.subject}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? 'success' : 'warning'} dot>
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-wl-text-muted">
                            <Clock className="w-3 h-3" />
                            {new Date(template.updatedAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Link href={`/settings/notifications/templates/${template.id}`}>
                              <button className="p-2 hover:bg-wl-bg-overlay rounded-lg transition-colors" aria-label="Edit">
                                <Edit className="w-4 h-4 text-wl-text-muted" />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleToggleStatus(template.id, template.isActive)}
                              disabled={actionInProgress === template.id}
                              className="p-2 hover:bg-wl-bg-overlay rounded-lg transition-colors disabled:opacity-40"
                              aria-label={template.isActive ? 'Deactivate' : 'Activate'}
                              title={template.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Eye className="w-4 h-4 text-wl-text-muted" />
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
                              disabled={actionInProgress === template.id}
                              className="p-2 hover:bg-wl-danger-500/10 rounded-lg transition-colors disabled:opacity-40"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-wl-danger-400" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
