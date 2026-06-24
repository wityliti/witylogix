'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Send, Edit2 } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preview: string;
  variables: string[];
}

interface TemplatePreviewProps {
  template: EmailTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const [showTestEmail, setShowTestEmail] = useState(false);

  return (
    <Card className="bg-wl-bg-elevated border-wl-border-default">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{template.name}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTestEmail(!showTestEmail)}
            >
              <Send className="w-4 h-4 mr-1" />
              Send Test
            </Button>
            <Button variant="ghost" size="sm">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject Line */}
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Subject
          </label>
          <div className="text-sm text-white mt-2 p-3 bg-wl-bg-surface rounded border border-wl-border-default font-mono">
            {template.subject}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Preview
          </label>
          <div className="text-sm text-gray-400 mt-2 p-4 bg-wl-bg-surface rounded border border-wl-border-default">
            {template.preview}
          </div>
        </div>

        {/* Variables */}
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Available Variables
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {template.variables.map((v) => (
              <Badge key={v} variant="info">
                {v}
              </Badge>
            ))}
          </div>
        </div>

        {/* Test Email Form */}
        {showTestEmail && (
          <div className="p-4 bg-wl-bg-surface rounded border border-blue-500/30 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold block mb-2">
                Recipient Email
              </label>
              <input
                type="email"
                placeholder="test@example.com"
                className="w-full px-3 py-2 bg-wl-bg-root border border-wl-border-default rounded text-sm text-white placeholder-wl-text-tertiary"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm">
                Send Test Email
              </Button>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
