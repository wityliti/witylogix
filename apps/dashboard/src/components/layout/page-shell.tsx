"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageShell — the shared page-body shell for the Integrations section.
 *
 * Renders inside the `(dashboard)/integrations/layout.tsx` content area, after
 * the global Header, breadcrumb, and tab navigation. Every category and tools
 * sub-page should wrap its body in this shell so the section reads as one
 * surface with one primary accent, one KPI band, and one page-body grammar.
 *
 * Design contract (frozen — see docs/superpowers/specs/
 * 2026-04-19-integrations-ux-cognitive-load-design.md §3.1):
 * - Exactly one `primaryAction`. Sub-pages that want two actions must pick
 *   the most important and push the rest into `secondaryActions`.
 * - `kpis` is a single-slot passthrough intended for a <KpiRow /> with <= 4
 *   cards. Additional stats belong in the page body as secondary sections.
 * - Vertical rhythm is fixed (`space-y-8`). Sub-pages do not tweak it.
 * - Colors/typography come from wl-* tokens only; no raw Tailwind colors.
 */
export interface PageShellProps {
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  kpis?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell ({
  title,
  description,
  primaryAction,
  secondaryActions,
  kpis,
  children,
  className,
}: PageShellProps) {
  const hasActions = Boolean(primaryAction) || Boolean(secondaryActions);

  return (
    <section
      className={cn("space-y-8", className)}
      aria-label={title}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-wl-text-primary m-0">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-wl-text-tertiary max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {hasActions && (
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:shrink-0">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </header>

      {kpis && <div>{kpis}</div>}

      {children}
    </section>
  );
}
