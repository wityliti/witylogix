/**
 * Sentry error tracking — server-side initialization.
 * Only active when SENTRY_DSN is set.
 */

let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized || !process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      release: process.env.npm_package_version || "1.0.0",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        return event;
      },
    });
    initialized = true;
    console.log("[sentry] Initialized");
  } catch {
    console.warn("[sentry] @sentry/node not installed, skipping");
  }
}

export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/node");
    if (context) {
      Sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, value);
        }
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch {
    // Sentry not available
  }
}
