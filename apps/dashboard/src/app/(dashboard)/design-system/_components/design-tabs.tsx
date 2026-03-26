'use client';

import { cn } from '@/lib/utils';

interface DesignTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  'buttons',
  'badges',
  'colors',
  'inputs',
  'selects',
  'cards',
  'modals',
  'tables',
  'typography',
  'forms',
  'a11y',
];

export function DesignTabs({ activeTab, onTabChange }: DesignTabsProps) {
  return (
    <div className="border-b border-[#1e1e2e] sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                'text-sm font-medium py-4 px-1 border-b-2 transition-all duration-fast whitespace-nowrap',
                activeTab === tab
                  ? 'text-blue-500 border-b-blue-500'
                  : 'text-gray-300 border-b-transparent hover:text-white'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
