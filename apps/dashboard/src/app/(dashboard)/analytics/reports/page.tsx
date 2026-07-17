'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useApiList, useApiMutation } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { FileText, Plus, Trash2, Clock } from 'lucide-react';

interface Report {
  id: string;
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'oneTime';
  format: 'pdf' | 'csv' | 'xlsx';
  lastGenerated: string | null;
  nextGenerated: string | null;
  owner: string;
  recipients: string[];
  status: 'active' | 'inactive' | 'failed';
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  oneTime: 'One-time',
};

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'oneTime'>('weekly');
  const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('csv');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const { execute, loading, error } = useApiMutation<Report>('POST', '/api/v4/analytics/reports');

  function addRecipient() {
    const email = recipientInput.trim();
    if (email && /\S+@\S+\.\S+/.test(email) && !recipients.includes(email)) {
      setRecipients((r) => [...r, email]);
      setRecipientInput('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await execute({ name: name.trim(), description: description.trim(), frequency, format, recipients });
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 bg-wl-bg-elevated border-wl-border-default">
        <h2 className="text-lg font-semibold text-wl-text-primary mb-4">New Scheduled Report</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-wl-text-secondary mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Delivery Summary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-wl-text-secondary mb-1">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-wl-text-secondary mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="w-full rounded-lg bg-wl-bg-surface border border-wl-border-default text-wl-text-primary text-sm px-3 py-2 focus:outline-none focus:border-wl-primary-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="oneTime">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-wl-text-secondary mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full rounded-lg bg-wl-bg-surface border border-wl-border-default text-wl-text-primary text-sm px-3 py-2 focus:outline-none focus:border-wl-primary-500"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-wl-text-secondary mb-1">Recipients</label>
            <div className="flex gap-2">
              <Input
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                placeholder="email@example.com"
                type="email"
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addRecipient}>Add</Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipients.map((r) => (
                  <span key={r} className="flex items-center gap-1 text-xs bg-wl-bg-overlay text-wl-text-secondary px-2 py-0.5 rounded-full">
                    {r}
                    <button type="button" onClick={() => setRecipients((rs) => rs.filter((x) => x !== r))} className="hover:text-wl-danger-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-wl-danger-400">{error.message}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating…' : 'Create Report'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const { items: reports, loading, error, refetch } = useApiList<Report>('/api/v4/analytics/reports');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/api/v4/analytics/reports/${id}`);
      refetch();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error?.message ?? 'Failed to load reports'} onRetry={refetch} />;

  return (
    <>
      {showCreate && <CreateReportModal onClose={() => setShowCreate(false)} onCreated={refetch} />}

      <div className="flex flex-col min-h-screen bg-wl-bg-root">
        <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-wl-text-primary">Reports</h1>
                <p className="text-sm text-wl-text-secondary mt-1">Scheduled analytics reports</p>
              </div>
              <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
                New Report
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4 max-w-5xl">
            {reports.length === 0 ? (
              <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
                <FileText className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
                <p className="text-wl-text-primary font-medium mb-1">No reports yet</p>
                <p className="text-sm text-wl-text-secondary mb-4">Schedule automated reports to keep your team informed.</p>
                <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4" />
                  Create first report
                </Button>
              </Card>
            ) : (
              reports.map((report) => (
                <Card
                  key={report.id}
                  className="p-5 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-semibold text-wl-text-primary truncate">{report.name}</h3>
                        <Badge variant={report.status === 'active' ? 'success' : report.status === 'failed' ? 'danger' : 'info'}>
                          {report.status}
                        </Badge>
                      </div>
                      {report.description && (
                        <p className="text-sm text-wl-text-secondary mb-3 line-clamp-1">{report.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-wl-text-tertiary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {FREQUENCY_LABELS[report.frequency] ?? report.frequency}
                        </span>
                        <span className="font-medium uppercase">{report.format}</span>
                        {report.recipients.length > 0 && (
                          <span>{report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}</span>
                        )}
                        {report.nextGenerated && (
                          <span>Next: {new Date(report.nextGenerated).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        className={cn(
                          'p-1.5 rounded hover:bg-wl-danger-500/15 hover:text-wl-danger-400 text-wl-text-tertiary transition-colors',
                          deletingId === report.id && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
