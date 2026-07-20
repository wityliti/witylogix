'use client';

export function PageHeader() {
  return (
    <div className="border-b border-wl-border-default">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">
          Design System
        </h1>
        <p className="text-wl-neutral-300 max-w-2xl">
          Witylogix component library. All components use Tailwind CSS v3.4 with
          design tokens (--wl-*) for consistent styling across the platform.
        </p>
      </div>
    </div>
  );
}
