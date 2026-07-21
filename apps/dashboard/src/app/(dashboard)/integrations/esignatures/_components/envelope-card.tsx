'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, DownloadCloud, Trash2, CheckCircle2, Send, Clock, AlertCircle } from 'lucide-react';

interface Signer {
  id: string;
  email: string;
  name: string;
  status: "pending" | "viewed" | "signed" | "declined";
  order: number;
}

interface EnvelopeWorkflow {
  id: string;
  documentName: string;
  status: "sent" | "viewed" | "signed" | "completed" | "voided" | "declined";
  signers: Signer[];
  createdAt: string;
  dueDate?: string;
  progress: number;
}

interface EnvelopeCardProps {
  envelope: EnvelopeWorkflow;
}

const getStatusBadgeVariant = (status: string): "success" | "warning" | "danger" | "info" | "default" | "primary" => {
  switch (status) {
    case "completed":
    case "signed":
      return "success";
    case "viewed":
      return "info";
    case "sent":
      return "default";
    case "pending":
      return "warning";
    case "declined":
    case "voided":
      return "danger";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
    case "signed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "viewed":
      return <Eye className="w-4 h-4" />;
    case "sent":
      return <Send className="w-4 h-4" />;
    case "pending":
      return <Clock className="w-4 h-4" />;
    case "declined":
    case "voided":
      return <AlertCircle className="w-4 h-4" />;
    default:
      return null;
  }
};

export function EnvelopeCard({ envelope }: EnvelopeCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-wl-text-primary">{envelope.documentName}</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Created {envelope.createdAt}
              {envelope.dueDate && ` • Due ${envelope.dueDate}`}
            </p>
          </div>
          <Badge
            variant={getStatusBadgeVariant(envelope.status)}
            className={cn(
              "capitalize flex items-center gap-1",
              envelope.status === "completed" || envelope.status === "signed"
                ? "bg-wl-success-500/20 text-wl-success-400"
                : envelope.status === "viewed"
                  ? "bg-wl-info-500/20 text-wl-info-400"
                  : envelope.status === "sent"
                    ? "bg-wl-neutral-500/20 text-wl-text-secondary"
                      : "bg-wl-danger-500/20 text-wl-danger-400"
            )}
          >
            {getStatusIcon(envelope.status)}
            {envelope.status}
          </Badge>
        </div>

        <div className="mb-6 pb-6 border-b border-wl-border-default">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Completion</p>
            <p className="text-sm font-bold text-white">{envelope.progress}%</p>
          </div>
          <div className="w-full h-2 bg-wl-bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-500/70" style={{ width: `${envelope.progress}%` }} />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium text-wl-text-tertiary uppercase mb-3">Signing Order</p>
          <div className="space-y-2">
            {envelope.signers.map((signer) => (
              <div key={signer.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-wl-bg-surface flex items-center justify-center text-xs font-semibold">
                    {signer.order}
                  </div>
                  <div>
                    <p className="font-medium text-white">{signer.name}</p>
                    <p className="text-xs text-wl-text-tertiary">{signer.email}</p>
                  </div>
                </div>
                <div className={cn("px-2 py-1 rounded text-xs font-semibold capitalize",
                  signer.status === "signed"
                    ? "bg-wl-success-500/20 text-wl-success-400"
                    : signer.status === "viewed"
                      ? "bg-wl-info-500/20 text-wl-info-400"
                      : signer.status === "declined"
                        ? "bg-wl-danger-500/20 text-wl-danger-400"
                        : "bg-wl-neutral-500/20 text-wl-text-secondary"
                )}>
                  {signer.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-wl-border-default">
          <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
            <Eye className="w-4 h-4 mr-2" />View
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
            <DownloadCloud className="w-4 h-4 mr-2" />Download
          </Button>
          {envelope.status === "sent" || envelope.status === "viewed" ? (
            <Button variant="danger" size="sm" className="flex-1 bg-wl-danger-500/10 text-wl-danger-400 hover:bg-wl-danger-500/20">
              <Trash2 className="w-4 h-4 mr-2" />Void
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
