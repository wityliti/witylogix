import { cn } from "@/lib/utils";

export default function RootLoading() {
  return (
    <html lang="en">
      <body className="wl-noise">
        <div className={cn("flex min-h-screen")}>
          {/* Sidebar skeleton */}
          <aside
            className={cn(
              "w-64 bg-wl-bg-elevated border-r border-wl-border-subtle",
              "hidden lg:flex flex-col p-4 gap-4",
            )}
            style={{
              width: "var(--wl-sidebar-width)",
            }}
          >
            {/* Logo skeleton */}
            <div className="flex items-center gap-2 mb-8 animate-pulse">
              <div className="w-10 h-10 bg-wl-bg-primary rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-wl-bg-primary rounded w-20" />
              </div>
            </div>

            {/* Navigation items skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 bg-wl-bg-primary rounded" />
                <div className="h-4 bg-wl-bg-primary rounded flex-1" />
              </div>
            ))}
          </aside>

          {/* Main content skeleton */}
          <main
            className={cn("flex-1 min-h-screen bg-wl-bg-root p-6")}
            style={{
              marginLeft: "var(--wl-sidebar-width)",
            }}
          >
            {/* Header skeleton */}
            <div className="mb-8 space-y-2 animate-pulse">
              <div className="h-8 bg-wl-bg-primary rounded w-1/3" />
              <div className="h-4 bg-wl-bg-primary rounded w-1/2" />
            </div>

            {/* Content cards skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
                    "animate-pulse",
                  )}
                >
                  <div className="h-4 bg-wl-bg-primary rounded w-1/2 mb-4" />
                  <div className="h-10 bg-wl-bg-primary rounded mb-2" />
                  <div className="h-4 bg-wl-bg-primary rounded w-3/4" />
                </div>
              ))}
            </div>

            {/* Table skeleton */}
            <div
              className={cn(
                "bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-5",
                "animate-pulse",
              )}
            >
              <div className="h-6 bg-wl-bg-primary rounded w-1/4 mb-4" />
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
          </main>
        </div>
      </body>
    </html>
  );
}
