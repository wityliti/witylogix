/**
 * StatusTimeline — Vertical timeline of status change events.
 *
 * Shows chronological events with timestamps, actors, and descriptions.
 * Used on order detail pages, activity feeds, and driver history.
 */

interface TimelineEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface StatusTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
}

export function StatusTimeline({ events, loading = false }: StatusTimelineProps) {
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={skeletonCircle} />
            <div>
              <div style={skeletonLine(180, 14)} />
              <div style={{ ...skeletonLine(120, 12), marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--p-color-text-subdued, #6d7175)", fontSize: 13 }}>
        No events yet.
      </div>
    );
  }

  return (
    <div style={{ padding: "0 4px" }}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <div
            key={event.id}
            style={{
              display: "flex",
              gap: 12,
              position: "relative",
              paddingBottom: isLast ? 0 : 20,
            }}
          >
            {/* Timeline line + dot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor:
                    index === 0
                      ? "var(--p-color-bg-fill-brand, #005bd3)"
                      : "var(--p-color-border, #c9cccf)",
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    backgroundColor: "var(--p-color-border-subdued, #e1e3e5)",
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--p-color-text, #202223)" }}>
                {event.message}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 2,
                  fontSize: 12,
                  color: "var(--p-color-text-subdued, #6d7175)",
                }}
              >
                <span>{formatTimestamp(event.timestamp)}</span>
                {event.actor && (
                  <>
                    <span>&middot;</span>
                    <span>{event.actor}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const skeletonCircle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
  marginTop: 4,
  flexShrink: 0,
};

function skeletonLine(width: number, height: number): React.CSSProperties {
  return {
    width,
    height,
    backgroundColor: "var(--p-color-bg-surface-hover, #f1f2f3)",
    borderRadius: 4,
  };
}
