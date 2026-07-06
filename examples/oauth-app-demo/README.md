# Witylogix OAuth App Demo

A minimal, runnable reference implementation of a third-party Witylogix app. It
demonstrates the full OAuth2 Authorization Code + PKCE flow, an authenticated
API call, a webhook registration, a webhook receiver with HMAC verification,
and an Operations transition driven by the app.

This example is the companion to
[`docs/guides/oauth-app-developer-guide.md`](../../docs/guides/oauth-app-developer-guide.md).
Start there for the conceptual walkthrough; come back here when you want a
working server to copy from.

## Layout

```
examples/oauth-app-demo/
├── package.json
├── .env.example
├── README.md
└── src/
    └── server.mjs
```

There are no runtime dependencies — the server uses only Node 20+ built-ins
(`node:http`, `node:crypto`, `fetch`). This is intentional: it keeps the
example focused on the protocol, not on a framework.

## Prerequisites

- Node.js 20 or later.
- A Witylogix API running somewhere you can reach (local dev, staging, etc.).
- An OAuth client registered on that API via
  `POST /api/v4/oauth/clients`. The client's `redirectUris` must include the
  URL this demo listens on (default `http://localhost:4001/oauth/callback`),
  and its `allowedScopes` must include every scope you plan to request.

## Configure

```bash
cd examples/oauth-app-demo
cp .env.example .env
# Edit .env and fill in OAUTH_CLIENT_ID (and OAUTH_CLIENT_SECRET if confidential).
```

Key variables:

| Variable              | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `WITYLOGIX_API_URL`   | Base URL of the Witylogix API, no trailing slash.                 |
| `OAUTH_CLIENT_ID`     | Client ID returned by `POST /api/v4/oauth/clients`.               |
| `OAUTH_CLIENT_SECRET` | Required for confidential clients; leave blank for public.        |
| `APP_BASE_URL`        | Where this demo listens.                                          |
| `OAUTH_REDIRECT_URI`  | Must exactly match one of the client's `redirectUris`.            |
| `OAUTH_SCOPES`        | Space-separated subset of the client's `allowedScopes`.           |
| `PUBLIC_WEBHOOK_URL`  | Optional. Public URL that forwards to `/hooks/witylogix`.         |
| `WEBHOOK_SECRET`      | Optional. Must equal the secret returned by `POST /api/webhooks`. |

## Run

```bash
node src/server.mjs
```

Then open <http://localhost:4001> and click **Install to Witylogix**.

You will be redirected to the Witylogix consent screen. On approval the API
redirects back to `/oauth/callback`, the demo exchanges the code for tokens
(using PKCE + optional client secret), and the home page flips to
`installed`.

## What to try once installed

- **List shipments:** visit `/shipments`. Uses the `shipments:read` scope.
- **Register a webhook:** visit `/register-webhook` after setting
  `PUBLIC_WEBHOOK_URL`. The demo subscribes to
  `shipment.stage_changed` and `order.stage_changed`.
- **Receive a webhook:** when Witylogix delivers an event, the server logs the
  raw body to stdout. If `WEBHOOK_SECRET` is set, the HMAC signature header
  `X-Witylogix-Signature` is verified before acceptance.
- **Advance a shipment:** `curl -X POST
'http://localhost:4001/transition?id=SHIPMENT_ID&toStage=STAGE_KEY'`.
  Uses the `shipments:transition` scope and calls
  `POST /api/v4/operations/shipments/:id/transition`.

## What this example deliberately skips

- Persistent token storage — tokens live in memory for the process lifetime.
  A real app should encrypt and store them per install in its own database.
- Multi-tenant install handling — the demo treats a single install as a
  singleton. Production apps should key tokens by `installationId`.
- Error UX — errors are surfaced as plain-text responses. A real app should
  re-run the install flow on `invalid_token` and log for observability.

See the developer guide for the full checklist.
