/**
 * Validates required environment variables at startup.
 * Called from root loader to fail fast if config is missing.
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
    "DATABASE_URL",
  ];

  const recommended = [
    "SHOPIFY_WEBHOOK_SECRET",
    "API_BASE_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);
  const missingRecommended = recommended.filter((key) => !process.env[key]);

  if (missingRecommended.length > 0) {
    console.warn(`[env] Missing recommended env vars: ${missingRecommended.join(", ")}`);
  }

  if (missing.length > 0) {
    console.error(`[env] Missing REQUIRED env vars: ${missing.join(", ")}`);
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}
