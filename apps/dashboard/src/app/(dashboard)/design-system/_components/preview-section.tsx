'use client';

import { useState } from 'react';
import { Eye, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';

interface PreviewSectionProps {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}

export function PreviewSection({
  title,
  description,
  preview,
  code,
}: PreviewSectionProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">
          {title}
        </h4>
        <p className="text-xs text-wl-text-secondary">{description}</p>
      </div>

      <div className="bg-wl-bg-surface border border-wl-border-default rounded-md p-6 flex items-center justify-center min-h-24">
        {preview}
      </div>

      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-2 text-xs font-medium text-wl-text-secondary hover:text-wl-text-primary transition-colors"
      >
        {showCode ? (
          <>
            <Eye className="w-3 h-3" /> Hide Code
          </>
        ) : (
          <>
            <Code className="w-3 h-3" /> Show Code
          </>
        )}
      </button>

      {showCode && <CodeBlock code={code} />}
    </div>
  );
}
