'use client';

import { cn } from '@/lib/utils';

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
}

interface TemplateListProps {
  templates: EmailTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TemplateList({
  templates,
  selectedId,
  onSelect,
}: TemplateListProps) {
  return (
    <div className="space-y-2">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.id)}
          className={cn(
            'w-full text-left p-4 rounded-lg border transition-all',
            selectedId === template.id
              ? 'bg-blue-500/10 border-blue-500'
              : 'bg-[#1a1a2e] border-[#1e1e2e] hover:border-blue-500/50'
          )}
        >
          <div className="font-medium text-white">{template.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            {template.type.replace(/_/g, ' ')}
          </div>
        </button>
      ))}
    </div>
  );
}
