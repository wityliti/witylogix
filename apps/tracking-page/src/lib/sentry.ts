/**
 * Sentry error tracking — client-side initialization.
 * Only active when VITE_SENTRY_DSN is set.
 */

let initialized = false;

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (initialized || !dsn) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "production",
      tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
    });
    initialized = true;
  } catch {
    // Sentry not available
  }
}
