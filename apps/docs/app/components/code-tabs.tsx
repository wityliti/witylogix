'use client';

import { useState } from 'react';

interface CodeTabsProps {
  tabs: {
    label: string;
    icon?: string;
    code: string;
    filename?: string;
  }[];
}

export function CodeTabs({ tabs }: CodeTabsProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="rounded-xl border border-[var(--forge-border)] overflow-hidden my-6 bg-[var(--forge-surface)]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[var(--forge-border)] bg-[var(--forge-elevated)]">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${i === active
                ? 'text-[var(--teal)] border-[var(--teal)] bg-[var(--forge-surface)]'
                : 'text-[var(--sand-dim)] border-transparent hover:text-[var(--sand-muted)] hover:bg-[var(--forge-raised)]'
              }
            `}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
        {tabs[active].filename && (
          <span className="ml-auto pr-4 text-xs text-[var(--sand-dim)] font-mono">
            {tabs[active].filename}
          </span>
        )}
      </div>
      {/* Code content */}
      <pre className="!rounded-none !border-0 !m-0 overflow-x-auto text-sm leading-relaxed">
        <code>{tabs[active].code}</code>
      </pre>
    </div>
  );
}
