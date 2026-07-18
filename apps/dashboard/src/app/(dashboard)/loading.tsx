import { cn } from '@/lib/utils';

/**
 * Dashboard-level loading skeleton
 * Displayed while dashboard content is loading
 */
export default function DashboardLoading() {
  return (
    <div className={cn('min-h-screen bg-wl-bg-root p-6')}>
      <main className={cn('flex-1')}>
        {/* Header skeleton */}
        <div className="mb-8 space-y-3 animate-pulse">
          <div className="h-8 bg-wl-bg-primary rounded w-1/3" />
          <div className="h-4 bg-wl-bg-primary rounded w-1/2" />
        </div>

        {/* Tabs/Navigation skeleton */}
        <div className="mb-6 flex gap-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 bg-wl-bg-primary rounded px-4 w-24"
            />
          ))}
        </div>

        {/* Filter/Control bar skeleton */}
        <div className="mb-6 flex gap-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-wl-bg-primary rounded px-3 flex-1"
            />
          ))}
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5',
                'animate-pulse'
              )}
            >
              <div className="h-4 bg-wl-bg-primary rounded w-1/2 mb-3" />
              <div className="h-8 bg-wl-bg-primary rounded w-2/3 mb-2" />
              <div className="h-3 bg-wl-bg-primary rounded w-1/3" />
            </div>
          ))}
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content area */}
          <div className="lg:col-span-2">
            {/* Chart/Large card skeleton */}
            <div
              className={cn(
                'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5',
                'animate-pulse mb-6',
                'min-h-96'
              )}
            >
              <div className="h-4 bg-wl-bg-primary rounded w-1/4 mb-6" />
              <div className="space-y-2">
                {[90, 75, 85, 65, 80].map((w, i) => (
                  <div
                    key={i}
                    className="h-2 bg-wl-bg-primary rounded"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Table skeleton */}
            <div
              className={cn(
                'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5',
                'animate-pulse'
              )}
            >
              <div className="h-5 bg-wl-bg-primary rounded w-1/4 mb-4" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-3 border-b border-wl-border-subtle last:border-b-0"
                >
                  <div className="w-4 h-4 bg-wl-bg-primary rounded" />
                  <div className="h-4 bg-wl-bg-primary rounded flex-1" />
                  <div className="h-4 bg-wl-bg-primary rounded w-1/4" />
                  <div className="h-4 bg-wl-bg-primary rounded w-1/5" />
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div>
            {/* Activity/Recent section */}
            <div
              className={cn(
                'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5',
                'animate-pulse'
              )}
            >
              <div className="h-5 bg-wl-bg-primary rounded w-1/3 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 bg-wl-bg-primary rounded w-full" />
                    <div className="h-2 bg-wl-bg-primary rounded w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
