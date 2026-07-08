# Railway Environment Variables

Deployment checklist and reference for all Railway services. Audited from source (`process.env.*` and `import.meta.env.*` references across all apps and packages).

---

## Services Overview

| Service         | Railway App            | Internal Port | Health Check |
| --------------- | ---------------------- | ------------- | ------------ |
| API             | `apps/api`             | 3000          | `/health`    |
| Dashboard       | `apps/dashboard`       | 3000          | `/`          |
| Customer Portal | `apps/customer-portal` | 3000          | `/`          |
| Shopify App     | `apps/shopify-app`     | 3000          | `/health`    |
| Tracking Page   | `apps/tracking-page`   | 3000          | `/`          |

---

## API (`apps/api`)

### Required

| Variable       | Description                           | Railway Source                                |
| -------------- | ------------------------------------- | --------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | Railway PostgreSQL plugin → Service Reference |
| `JWT_SECRET`   | Secret for signing JWT tokens         | Shared Variable or Secret                     |
| `REDIS_URL`    | Redis connection string               | Railway Redis plugin → Service Reference      |
| `PORT`         | Server listen port (defaults to 3000) | Set to `3000` or omit                         |

### Required for CORS / OAuth callbacks

| Variable        | Description                                                                                           | Railway Source               |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| `CORS_ORIGINS`  | Comma-separated allowed origins (e.g. `https://dashboard.witylogix.app,https://portal.witylogix.app`) | Shared Variable              |
| `API_URL`       | Public URL of this API service (used in OAuth redirect URIs)                                          | Railway-generated public URL |
| `API_BASE_URL`  | Alias used by some routes (same as `API_URL`)                                                         | Same as `API_URL`            |
| `FRONTEND_URL`  | Dashboard public URL (used for OAuth post-redirect)                                                   | Dashboard service URL        |
| `DASHBOARD_URL` | Dashboard public URL (used by Google OAuth callback)                                                  | Dashboard service URL        |

### Optional — Auth

| Variable                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `AUTH_BYOK`             | `"true"` to enable bring-your-own-key auth mode               |
| `AUTH_PROVIDER`         | Auth provider type: `"local"` (default), or SSO provider slug |
| `JWT_SIGNING_KEY`       | Signing key override (defaults to `JWT_SECRET`)               |
| `ENCRYPTION_MASTER_KEY` | Master encryption key for at-rest encryption                  |

### Optional — Notifications

| Variable             | Description                                       |
| -------------------- | ------------------------------------------------- |
| `SENDGRID_API_KEY`   | SendGrid API key for email delivery               |
| `NOTIFICATIONS_BYOK` | `"true"` to use tenant-supplied notification keys |

### Optional — Shipping Carriers

| Variable                 | Description               |
| ------------------------ | ------------------------- |
| `SHIPSTATION_API_KEY`    | ShipStation API key       |
| `SHIPSTATION_API_SECRET` | ShipStation API secret    |
| `EASYPOST_API_KEY`       | EasyPost API key          |
| `UPS_CLIENT_ID`          | UPS OAuth client ID       |
| `UPS_CLIENT_SECRET`      | UPS OAuth client secret   |
| `UPS_ACCOUNT_NUMBER`     | UPS account number        |
| `FEDEX_CLIENT_ID`        | FedEx OAuth client ID     |
| `FEDEX_CLIENT_SECRET`    | FedEx OAuth client secret |
| `FEDEX_ACCOUNT_NUMBER`   | FedEx account number      |
| `FEDEX_METER_NUMBER`     | FedEx meter number        |
| `DHL_API_KEY`            | DHL API key               |
| `DHL_CLIENT_ID`          | DHL client ID             |

### Optional — Routing Providers (one required for route optimization)

| Variable              | Description                                    |
| --------------------- | ---------------------------------------------- |
| `MAPBOX_ACCESS_TOKEN` | Mapbox routing/maps token                      |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key                            |
| `HERE_API_KEY`        | HERE Maps API key                              |
| `GRAPHHOPPER_API_KEY` | GraphHopper API key                            |
| `TOMTOM_API_KEY`      | TomTom API key                                 |
| `OSRM_BASE_URL`       | Self-hosted OSRM base URL                      |
| `ROUTING_PROVIDER`    | Active routing provider slug (e.g. `"mapbox"`) |

### Optional — CRM Integrations

| Variable                     | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `SALESFORCE_ENV`             | `"sandbox"` or `"production"`                     |
| `GOOGLE_OAUTH_CLIENT_ID`     | Google OAuth client ID (for calendar integration) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret                        |

### Optional — Accounting Integrations

| Variable             | Description                    |
| -------------------- | ------------------------------ |
| `QB_CLIENT_ID`       | QuickBooks OAuth client ID     |
| `QB_CLIENT_SECRET`   | QuickBooks OAuth client secret |
| `XERO_CLIENT_ID`     | Xero OAuth client ID           |
| `XERO_CLIENT_SECRET` | Xero OAuth client secret       |

### Optional — Payment Providers

| Variable                       | Description                        |
| ------------------------------ | ---------------------------------- |
| `PAYPAL_ENABLED`               | `"true"` to enable PayPal          |
| `PAYPAL_CLIENT_ID`             | PayPal client ID                   |
| `PAYPAL_CLIENT_SECRET`         | PayPal client secret               |
| `PAYPAL_WEBHOOK_ID`            | PayPal webhook ID for verification |
| `SQUARE_ENABLED`               | `"true"` to enable Square          |
| `SQUARE_ACCESS_TOKEN`          | Square access token                |
| `SQUARE_LOCATION_ID`           | Square location ID                 |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square webhook signature key       |

### Optional — Shopify (API service webhook receiver)

| Variable                 | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `SHOPIFY_API_SECRET`     | Shopify app secret (webhook HMAC verification) |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify webhook signing secret                 |

### Optional — Misc

| Variable      | Description                                     |
| ------------- | ----------------------------------------------- |
| `APP_VERSION` | App version string (exposed in health endpoint) |
| `API_VERSION` | API version string                              |
| `SENTRY_DSN`  | Sentry DSN for error tracking                   |

---

## Dashboard (`apps/dashboard`)

### Required

| Variable              | Description                   | Railway Source  |
| --------------------- | ----------------------------- | --------------- |
| `NEXT_PUBLIC_API_URL` | Public URL of the API service | API service URL |

### Optional

| Variable                    | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_REALTIME_URL`  | WebSocket/realtime server URL (defaults to API)                    |
| `NEXT_PUBLIC_SHOP_DOMAIN`   | Default shop domain (demo fallback)                                |
| `NEXT_PUBLIC_CRM_CLIENT_ID` | CRM OAuth client ID for browser-side OAuth flows                   |
| `REACT_APP_WS_URL`          | WebSocket URL override (legacy; prefer `NEXT_PUBLIC_REALTIME_URL`) |

---

## Customer Portal (`apps/customer-portal`)

### Required

| Variable              | Description                   | Railway Source  |
| --------------------- | ----------------------------- | --------------- |
| `NEXT_PUBLIC_API_URL` | Public URL of the API service | API service URL |

> No additional environment variables detected beyond what Next.js injects at build time.

---

## Shopify App (`apps/shopify-app`)

### Required

| Variable             | Description                                           | Railway Source                                |
| -------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `SHOPIFY_API_KEY`    | Shopify app API key                                   | Shopify Partners dashboard                    |
| `SHOPIFY_API_SECRET` | Shopify app API secret                                | Shopify Partners dashboard                    |
| `SHOPIFY_APP_URL`    | Public URL of this Shopify app service                | Railway-generated public URL                  |
| `DATABASE_URL`       | PostgreSQL connection string (Prisma session storage) | Railway PostgreSQL plugin → Service Reference |

### Optional

| Variable                 | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `SHOPIFY_SCOPES`         | Comma-separated OAuth scopes (defaults defined in `shopify.server.ts`) |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret (can match `SHOPIFY_API_SECRET`)                |
| `API_BASE_URL`           | Witylogix API base URL for proxying requests to the API service        |
| `SENTRY_DSN`             | Sentry DSN for error tracking                                          |

---

## Tracking Page (`apps/tracking-page`)

### Required

| Variable       | Description                                              | Railway Source  |
| -------------- | -------------------------------------------------------- | --------------- |
| `VITE_API_URL` | Public URL of the API service (Vite build-time variable) | API service URL |

> This is a Vite SPA. Variables must be prefixed `VITE_` to be embedded at build time. Set them as Railway build variables.

---

## Railway Shared Variables (recommended)

These variables are used by multiple services. Use Railway's **Shared Variables** feature (or a reference service) to define them once:

| Variable       | Used By          |
| -------------- | ---------------- |
| `DATABASE_URL` | API, Shopify App |
| `JWT_SECRET`   | API              |
| `REDIS_URL`    | API              |
| `NODE_ENV`     | All services     |

---

## Railway Service References (recommended)

Use Railway's **Service References** to inject one service's URL into another without hard-coding:

| Target Service  | Variable                         | Source Service                            |
| --------------- | -------------------------------- | ----------------------------------------- |
| Dashboard       | `NEXT_PUBLIC_API_URL`            | API → Public URL                          |
| Customer Portal | `NEXT_PUBLIC_API_URL`            | API → Public URL                          |
| Shopify App     | `API_BASE_URL`                   | API → Public URL                          |
| API             | `FRONTEND_URL` / `DASHBOARD_URL` | Dashboard → Public URL                    |
| API             | `CORS_ORIGINS`                   | Combine Dashboard + Portal + Shopify URLs |

---

## Variables NOT needed on Railway (build-time or test-only)

These appear in the codebase but are CI/test-only or managed outside Railway:

| Variable                            | Reason                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| `CI`                                | Set automatically by Railway/GitHub Actions            |
| `ANTHROPIC_API_KEY`                 | Only used by `apps/docs` AI search; not a core service |
| `TEAMS_*`, `SLACK_*`                | Per-tenant BYOK credentials, stored in DB not env      |
| `FCM_PROJECT_ID`, `FCM_PRIVATE_KEY` | Per-tenant push notification keys                      |
| `VAULT_ADDR`, `VAULT_TOKEN`         | External Vault integration (not Railway-native)        |
| `AWS_REGION`                        | Only referenced in health metrics labels               |
| `TEST_EMAIL`, `TEST_PASSWORD`, etc. | E2E test fixtures only                                 |

---

## Deployment Checklist

Before deploying to Railway, verify:

- [ ] `DATABASE_URL` points to the Railway PostgreSQL plugin (use service reference)
- [ ] `REDIS_URL` points to the Railway Redis plugin (use service reference)
- [ ] `JWT_SECRET` is a strong random secret (≥ 32 chars), set as Railway Secret
- [ ] `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` match the Shopify Partners app config
- [ ] `SHOPIFY_APP_URL` is set to the Railway-generated public domain for the Shopify App service
- [ ] `NEXT_PUBLIC_API_URL` (Dashboard + Customer Portal) and `VITE_API_URL` (Tracking Page) point to the API public URL
- [ ] `CORS_ORIGINS` includes all frontend service domains
- [ ] `API_URL` / `API_BASE_URL` on the API service is set to the API's own public Railway domain
- [ ] `NODE_ENV=production` is set on all services
