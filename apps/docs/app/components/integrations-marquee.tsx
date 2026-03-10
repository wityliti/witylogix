'use client';

import { integrations } from './integrations-grid';

function LogoTile({ integration, idx }: { integration: typeof integrations[0]; idx: number }) {
  return (
    <a
      key={`${integration.name}-${idx}`}
      href={integration.comingSoon ? undefined : (integration.docsUrl || '/docs/integrations')}
      className={`flex-shrink-0 group flex flex-col items-center justify-center gap-2.5 w-[120px] h-[100px] rounded-xl border border-[var(--forge-border)] bg-[var(--forge-surface)] transition-all hover:border-[var(--teal)] hover:shadow-[0_0_0_1px_rgba(42,157,143,0.1),0_4px_16px_rgba(42,157,143,0.08)] ${
        integration.comingSoon ? 'opacity-40' : ''
      }`}
    >
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white p-1.5">
        <img
          src={integration.logo}
          alt={integration.name}
          width={28}
          height={28}
          className="object-contain w-6 h-6"
          loading="lazy"
        />
      </div>
      <span className="text-[11px] font-medium text-[var(--sand-dim)] group-hover:text-[var(--sand)] transition-colors whitespace-nowrap">
        {integration.name}
      </span>
    </a>
  );
}

export function IntegrationsMarquee() {
  const all = integrations;
  // Split into two rows
  const half = Math.ceil(all.length / 2);
  const row1 = all.slice(0, half);
  const row2 = all.slice(half);

  // Duplicate each row for seamless loop
  const row1Doubled = [...row1, ...row1, ...row1];
  const row2Doubled = [...row2, ...row2, ...row2];

  return (
    <div className="relative overflow-hidden space-y-4 py-4">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-[var(--forge-bg)] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-[var(--forge-bg)] to-transparent" />

      {/* Row 1 — scrolls left */}
      <div className="flex gap-4 animate-marquee hover:[animation-play-state:paused]">
        {row1Doubled.map((integration, idx) => (
          <LogoTile key={`r1-${idx}`} integration={integration} idx={idx} />
        ))}
      </div>

      {/* Row 2 — scrolls right (reverse) */}
      <div className="flex gap-4 animate-marquee-reverse hover:[animation-play-state:paused]">
        {row2Doubled.map((integration, idx) => (
          <LogoTile key={`r2-${idx}`} integration={integration} idx={idx} />
        ))}
      </div>
    </div>
  );
}
