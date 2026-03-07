/**
 * DeliveryTimeline — Vertical timeline component for delivery status tracking.
 *
 * Displays a series of events in chronological order with status indicators,
 * timestamps, and messages. Current step is highlighted, future steps are grayed.
 */

interface TimelineEvent {
  status: string;
  timestamp: string;
  message?: string;
  actor?: string;
}

interface DeliveryTimelineProps {
  events: TimelineEvent[];
  currentStatus: string;
}

const STATUS_COLOR_CONFIG: Record<
  string,
  { color: string; lightBg: string }
> = {
  PENDING: { color: "#7a4c00", lightBg: "#fff8e5" },
  PROCESSING: { color: "#1a3a6e", lightBg: "#e8f0fe" },
  LABEL_CREATED: { color: "#004a5c", lightBg: "#e1f3f6" },
  PICKED_UP: { color: "#003b73", lightBg: "#e0f0ff" },
  IN_TRANSIT: { color: "#3d2e66", lightBg: "#ede8ff" },
  OUT_FOR_DELIVERY: { color: "#1a3a6e", lightBg: "#e8f0fe" },
  DELIVERED: { color: "#005c35", lightBg: "#ccf1e2" },
  ATTEMPTED: { color: "#8b4513", lightBg: "#ffe5cc" },
  FAILED: { color: "#8c0000", lightBg: "#fce5e5" },
  RETURNED: { color: "#4b2d8e", lightBg: "#f5f0ff" },
  CANCELLED: { color: "#6d7175", lightBg: "#f1f2f3" },
};

export function DeliveryTimeline({
  events,
  currentStatus,
}: DeliveryTimelineProps) {
  const currentIndex = events.findIndex((e) => e.status === currentStatus);

  const getStatusConfig = (status: string) => {
    return STATUS_COLOR_CONFIG[status] ?? { color: "#6d7175", lightBg: "#f1f2f3" };
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #d9dcde",
      }}
    >
      <h3
        style={{
          margin: "0 0 16px 0",
          fontSize: "16px",
          fontWeight: 600,
          color: "#202223",
        }}
      >
        Delivery Timeline
      </h3>

      <div
        style={{
          position: "relative",
          paddingLeft: "28px",
        }}
      >
        {events.map((event, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const config = getStatusConfig(event.status);

          return (
            <div key={index} style={{ marginBottom: index < events.length - 1 ? "20px" : "0" }}>
              {/* Connector line */}
              {index < events.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "24px",
                    width: "2px",
                    height: "calc(100% - 24px + 20px)",
                    backgroundColor: isCompleted || isCurrent ? config.color : "#d9dcde",
                    opacity: isCompleted || isCurrent ? 1 : 0.4,
                  }}
                />
              )}

              {/* Dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-8px",
                  top: "0px",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: config.lightBg,
                  border: `2px solid ${config.color}`,
                  opacity: isCompleted || isCurrent ? 1 : 0.4,
                }}
              />

              {/* Content */}
              <div style={{ marginLeft: "0px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: isCompleted || isCurrent ? config.color : "#6d7175",
                      opacity: isCompleted || isCurrent ? 1 : 0.6,
                    }}
                  >
                    {event.status.replace(/_/g, " ")}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#6d7175",
                      opacity: isCompleted || isCurrent ? 1 : 0.6,
                    }}
                  >
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                {event.message && (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#6d7175",
                      marginBottom: "4px",
                      opacity: isCompleted || isCurrent ? 1 : 0.6,
                    }}
                  >
                    {event.message}
                  </div>
                )}

                {event.actor && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9c9da0",
                      opacity: isCompleted || isCurrent ? 1 : 0.6,
                    }}
                  >
                    by {event.actor}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
