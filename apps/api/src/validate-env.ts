/**
 * API Startup Environment Variable Validation
 *
 * Called once at server startup (before buildServer).
 * - CRITICAL vars: DATABASE_URL, JWT_SECRET — process.exit(1) if missing
 * - REQUIRED vars: CORS_ORIGINS — exit in production if missing
 * - PORT: has a default (8000), warn if explicitly unset
 * - OPTIONAL integration vars: warn to console, never block startup
 */

const CRITICAL_VARS = ["DATABASE_URL", "JWT_SECRET"] as const;

const OPTIONAL_INTEGRATION_VARS = [
  "EASYPOST_API_KEY",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "SQUARE_ACCESS_TOKEN",
  "SHIPSTATION_API_KEY",
  "SHIPSTATION_API_SECRET",
  "QB_CLIENT_ID",
  "QB_CLIENT_SECRET",
  "XERO_CLIENT_ID",
  "XERO_CLIENT_SECRET",
  "SALESFORCE_ENV",
] as const;

export function validateStartupEnv(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProd = nodeEnv === "production";

  const missing: string[] = [];
  for (const v of CRITICAL_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  if (missing.length > 0) {
    console.error(
      `\n[startup] FATAL: Missing critical environment variable(s):\n` +
        missing.map((v) => `  • ${v}`).join("\n") +
        `\nServer cannot start. Set these variables and try again.\n`,
    );
    process.exit(1);
  }

  if (isProd && !process.env.CORS_ORIGINS) {
    console.error(
      `\n[startup] FATAL: CORS_ORIGINS is required in production.\n` +
        `  Set it to a comma-separated list of allowed origins (e.g. https://app.example.com).\n`,
    );
    process.exit(1);
  }

  if (!process.env.CORS_ORIGINS) {
    console.warn(
      `[startup] WARNING: CORS_ORIGINS is not set — all origins will be allowed in development.`,
    );
  }

  const missingIntegrations = OPTIONAL_INTEGRATION_VARS.filter(
    (v) => !process.env[v],
  );
  if (missingIntegrations.length > 0) {
    console.warn(
      `[startup] INFO: Optional integration vars not configured: ${missingIntegrations.join(", ")}`,
    );
  }
}
