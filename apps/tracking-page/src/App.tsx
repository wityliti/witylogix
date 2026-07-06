import { useState, useEffect } from "react";
import type {
  TrackingData,
  LocationUpdate,
  StatusUpdate,
  OrderStatus,
} from "./types";
import { fetchTrackingData } from "./lib/api";
import {
  initializeSocket,
  onLocationUpdate,
  onStatusUpdate,
  disconnectSocket,
} from "./lib/socket";
import { TrackingLandingPage } from "./components/TrackingLandingPage";
import { TrackingResultPage } from "./components/TrackingResultPage";
import { DeliveryPreferencesPage } from "./components/DeliveryPreferencesPage";

const BRAND_BLUE = "#005bd3";
const BG_COLOR = "#f6f6f7";

interface RouteState {
  view: "landing" | "tracking" | "preferences";
  trackingToken?: string;
}

function parseHash(): RouteState {
  const hash = window.location.hash.slice(1) || "/";

  if (hash.startsWith("/track/")) {
    return { view: "tracking", trackingToken: hash.replace("/track/", "") };
  }

  if (hash.startsWith("/preferences/")) {
    return {
      view: "preferences",
      trackingToken: hash.replace("/preferences/", ""),
    };
  }

  return { view: "landing" };
}

function navigateTo(path: string) {
  window.location.hash = path;
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(parseHash());
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── Hash-based routing ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash());
      setError(null);
      setTrackingData(null);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // ── Fetch real tracking data ───────────────────────────────────────────────

  useEffect(() => {
    if (route.view !== "tracking" || !route.trackingToken) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTrackingData(null);

    fetchTrackingData(route.trackingToken)
      .then((data) => {
        if (cancelled) return;
        setTrackingData(data);

        // Join real-time socket room when driver is en-route
        const status = data.response.status;
        if (["OUT_FOR_DELIVERY", "ARRIVED"].includes(status)) {
          const apiUrl =
            (import.meta as unknown as { env: Record<string, string> }).env
              .VITE_API_URL || "http://localhost:3000";
          initializeSocket(apiUrl);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load tracking information";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [route.view, route.trackingToken]);

  // ── Real-time socket overlays ──────────────────────────────────────────────

  useEffect(() => {
    if (!trackingData) return;

    const unsubscribeLocation = onLocationUpdate((update: LocationUpdate) => {
      setTrackingData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          liveDriverLocation: {
            latitude: update.latitude,
            longitude: update.longitude,
            updatedAt: new Date(update.timestamp).toISOString(),
          },
        };
      });
    });

    const unsubscribeStatus = onStatusUpdate((update: StatusUpdate) => {
      setTrackingData((prev) => {
        if (!prev) return prev;
        const updatedTimeline = prev.response.timeline.map((step) => ({
          ...step,
          completed: step.completed || step.status === update.status,
          current: step.status === update.status,
        }));
        return {
          ...prev,
          response: {
            ...prev.response,
            status: update.status as OrderStatus,
            timeline: updatedTimeline,
          },
        };
      });
    });

    return () => {
      unsubscribeLocation?.();
      unsubscribeStatus?.();
    };
  }, [trackingData]);

  // ── Responsive helper ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // ── Routing ────────────────────────────────────────────────────────────────

  if (route.view === "landing") {
    return <TrackingLandingPage onNavigate={navigateTo} />;
  }

  if (route.view === "preferences") {
    return (
      <DeliveryPreferencesPage
        trackingToken={route.trackingToken || ""}
        onBack={() => navigateTo("/")}
      />
    );
  }

  // Tracking view
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: BG_COLOR,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid #e5e7eb",
              borderTop: `4px solid ${BRAND_BLUE}`,
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ color: "#6b7280", margin: 0, fontSize: "15px" }}>
            Loading tracking information...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error.toLowerCase().includes("not found");
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: BG_COLOR,
          padding: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "48px 40px",
            borderRadius: "16px",
            textAlign: "center",
            maxWidth: "420px",
            width: "100%",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "52px", marginBottom: "20px" }}>
            {isNotFound ? "🔍" : "⚠️"}
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "700",
              color: "#1f2937",
              margin: "0 0 10px 0",
            }}
          >
            {isNotFound
              ? "Tracking Number Not Found"
              : "Unable to Load Tracking"}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              margin: "0 0 28px 0",
              lineHeight: 1.6,
            }}
          >
            {error}
          </p>
          <button
            onClick={() => navigateTo("/")}
            style={{
              backgroundColor: BRAND_BLUE,
              color: "white",
              padding: "12px 28px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!trackingData) {
    return null;
  }

  return (
    <TrackingResultPage
      trackingData={trackingData}
      isMobile={isMobile}
      onPreferences={() =>
        navigateTo(`/preferences/${trackingData.trackingToken}`)
      }
      onHome={() => navigateTo("/")}
    />
  );
}
