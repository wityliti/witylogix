import { useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface CarrierEvent {
  status: string;
  timestamp: string;
  location?: string;
}

export interface MultiCarrierStatusProps {
  carrier: string;
  trackingNumber: string;
  externalTrackingUrl?: string;
  status: string;
  events: CarrierEvent[];
}

const BRAND_BLUE = "#005bd3";
const BRAND_GREEN = "#008060";
const BG_COLOR = "#f6f6f7";

export function MultiCarrierStatus({
  carrier,
  trackingNumber,
  externalTrackingUrl,
  status: _unused,
  events,
}: MultiCarrierStatusProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = new Date(events[events.length - 1].timestamp);
      const now = new Date();
      const diff = now.getTime() - lastEvent.getTime();

      if (diff < 60000) {
        setLastUpdate("Just now");
      } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        setLastUpdate(`${minutes}m ago`);
      } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        setLastUpdate(`${hours}h ago`);
      } else {
        const days = Math.floor(diff / 86400000);
        setLastUpdate(`${days}d ago`);
      }
    }
  }, [events]);

  const getCarrierLogo = (carrierName: string): ReactNode => {
    const carrierLogos: Record<string, ReactNode> = {
      FedEx: (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#4D148C",
            backgroundColor: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "2px solid #4D148C",
          }}
        >
          FedEx
        </div>
      ),
      UPS: (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#FFB81C",
            backgroundColor: "#00297B",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          UPS
        </div>
      ),
      USPS: (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#fff",
            backgroundColor: "#00297B",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          USPS
        </div>
      ),
      DHL: (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#FFCC00",
            backgroundColor: "#D40511",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          DHL
        </div>
      ),
      Local: (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "700",
            color: "#fff",
            backgroundColor: BRAND_GREEN,
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          Local
        </div>
      ),
    };

    return carrierLogos[carrierName] || <span>{carrierName}</span>;
  };

  const getEventIcon = (eventStatus: string): string => {
    const lowerStatus = eventStatus.toLowerCase();
    if (lowerStatus.includes("picked")) return "📦";
    if (lowerStatus.includes("transit")) return "🚚";
    if (lowerStatus.includes("delivery")) return "🏠";
    if (lowerStatus.includes("delivered")) return "✓";
    if (lowerStatus.includes("out")) return "📍";
    if (lowerStatus.includes("arrival") || lowerStatus.includes("arrived"))
      return "🔔";
    return "•";
  };

  const formatEventTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();

    // Same day
    if (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    ) {
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }

    // Different day
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${month} ${day} ${hours}:${minutes}`;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Carrier Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {getCarrierLogo(carrier)}
          <div>
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "0 0 2px 0",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Tracking Number
            </p>
            <code
              style={{
                fontSize: "13px",
                fontFamily: "monospace",
                color: "#1f2937",
                fontWeight: "500",
              }}
            >
              {trackingNumber}
            </code>
          </div>
        </div>

        {/* External Tracking Link */}
        {externalTrackingUrl && (
          <a
            href={externalTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: BRAND_BLUE,
              color: "white",
              padding: "8px 12px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: "600",
              transition: "background-color 0.2s ease",
              cursor: "pointer",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                "#004ba3";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                BRAND_BLUE;
            }}
          >
            {carrier} Tracking
            <span style={{ fontSize: "10px" }}>→</span>
          </a>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#e5e7eb" }} />

      {/* Event Timeline */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#1f2937",
              margin: "0",
            }}
          >
            Tracking History
          </h3>
          {lastUpdate && (
            <span
              style={{
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              Updated {lastUpdate}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            position: "relative",
            paddingLeft: isMobile ? "20px" : "24px",
          }}
        >
          {/* Timeline line */}
          <div
            style={{
              position: "absolute",
              left: "6px",
              top: "16px",
              bottom: "-12px",
              width: "2px",
              backgroundColor: "#e5e7eb",
            }}
          />

          {events.length > 0 ? (
            events.map((event, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "12px",
                  position: "relative",
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    position: "absolute",
                    left: "-22px",
                    top: "2px",
                    width: "14px",
                    height: "14px",
                    backgroundColor: index === 0 ? BRAND_GREEN : "white",
                    border: `2px solid ${index === 0 ? BRAND_GREEN : "#d1d5db"}`,
                    borderRadius: "50%",
                    zIndex: 1,
                  }}
                />

                {/* Content */}
                <div
                  style={{
                    backgroundColor: BG_COLOR,
                    padding: "10px 12px",
                    borderRadius: "6px",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>
                      {getEventIcon(event.status)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: isMobile ? "13px" : "14px",
                          fontWeight: index === 0 ? "600" : "500",
                          color: "#1f2937",
                          margin: "0 0 2px 0",
                        }}
                      >
                        {event.status}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        <span>{formatEventTime(event.timestamp)}</span>
                        {event.location && (
                          <span style={{ textAlign: "right" }}>
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px",
                backgroundColor: BG_COLOR,
                borderRadius: "6px",
                color: "#6b7280",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              No tracking events available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
