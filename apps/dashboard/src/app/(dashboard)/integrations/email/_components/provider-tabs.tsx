'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface EmailProvider {
  id: string;
  name: string;
  icon: string;
  status: 'active' | 'inactive' | 'error';
}

interface ProviderTabsProps {
  providers: EmailProvider[];
  activeProvider: string;
  onSelectProvider: (id: string) => void;
}

export function ProviderTabs({
  providers,
  activeProvider,
  onSelectProvider,
}: ProviderTabsProps) {
  return (
    <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
      {providers.map((provider) => (
        <button
          key={provider.id}
          onClick={() => onSelectProvider(provider.id)}
          className={cn(
            'px-4 py-2 rounded-lg border transition-all whitespace-nowrap flex items-center gap-2',
            activeProvider === provider.id
              ? 'bg-blue-500 text-white border-blue-600'
              : 'border-wl-border-default text-wl-text-secondary hover:border-blue-500/50'
          )}
        >
          <span className="text-lg">{provider.icon}</span>
          {provider.name}
          {provider.status === 'active' && (
            <CheckCircle className="w-4 h-4 ml-1" />
          )}
        </button>
      ))}
    </div>
  );
}
