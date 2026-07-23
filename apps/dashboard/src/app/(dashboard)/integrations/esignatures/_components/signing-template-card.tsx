'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';

interface SigningTemplate {
  id: string;
  name: string;
  provider: string;
  fields: number;
  signers: number;
  created: string;
  usage: number;
}

interface SigningTemplateCardProps {
  template: SigningTemplate;
}

export function SigningTemplateCard({ template }: SigningTemplateCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-wl-text-primary">{template.name}</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">
              {template.provider} • Created {template.created}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-wl-info-500">{template.usage}</p>
            <p className="text-xs text-wl-text-tertiary">times used</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-wl-border-default">
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Fields</p>
            <p className="text-lg font-bold text-wl-text-primary mt-1">{template.fields}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Signers</p>
            <p className="text-lg font-bold text-wl-text-primary mt-1">{template.signers}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Status</p>
            <Badge variant="success" className="mt-1 bg-wl-success-500/20 text-wl-success-400">
              Active
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" className="flex-1 bg-wl-info-500 hover:bg-wl-info-500">
            <Plus className="w-4 h-4 mr-2" />Use Template
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
            <Settings className="w-4 h-4 mr-2" />Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
