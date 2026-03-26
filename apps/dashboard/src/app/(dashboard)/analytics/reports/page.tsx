'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { FileText, Plus, Download } from 'lucide-react';

interface Report {
  id: string;
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'oneTime';
  format: 'pdf' | 'csv' | 'xlsx';
  lastGenerated: string;
  nextGenerated: string;
  owner: string;
  recipients: string[];
  status: 'active' | 'inactive' | 'failed';
}

/**
 * Analytics Reports Page
 *
 * Schedule, manage, and track analytics reports
 */
export default function ReportsPage() {
  const { items: reports, loading, error } = useApiList<Report>(
    '/api/v4/analytics?view=reports'
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error?.message ?? 'Failed to load reports'} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Reports</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Scheduled analytics reports</p>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Report
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-5xl">
          {reports.length === 0 ? (
            <Card className="p-12 bg-wl-bg-surface border-wl-border-default text-center">
              <FileText className="w-12 h-12 text-wl-text-tertiary mx-auto mb-4" />
              <p className="text-wl-text-secondary">No reports yet</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="p-6 bg-wl-bg-surface border-wl-border-default hover:border-wl-border-strong cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-wl-text-primary">{report.name}</h3>
                        <Badge variant={report.status === 'active' ? 'success' : report.status === 'failed' ? 'danger' : 'info'}>
                          {report.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-wl-text-secondary mb-3">{report.description}</p>
                      <div className="flex items-center gap-4 text-sm text-wl-text-tertiary">
                        <span>{report.frequency}</span>
                        <span>{report.format.toUpperCase()}</span>
                        <span>{report.recipients.length} recipients</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
