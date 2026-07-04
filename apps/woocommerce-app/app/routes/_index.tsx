/**
 * WooCommerce Merchant Onboarding — Connect your store.
 *
 * GET  /?shopId=<uuid>         Show the credential entry form.
 * POST /?shopId=<uuid>         Validate credentials → save connection → redirect to /connected.
 *
 * Authentication: HTTP Basic Auth (Consumer Key + Consumer Secret) sent to
 * GET /wp-json/wc/v3/system_status. No OAuth redirect flow is needed —
 * WooCommerce uses static pre-generated API keys.
 */

import { useState } from "react";
import { useActionData, useNavigation, Form, redirect } from "react-router";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  verifyWooCommerceCredentials,
  saveWooCommerceConnection,
} from "~/lib/woocommerce.server";

// ─── Meta ─────────────────────────────────────────────────────

export const meta: MetaFunction = () => [
  { title: "Connect WooCommerce — Witylogix" },
];

// ─── Loader ──────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");
  if (!shopId) {
    throw new Response("Missing shopId query parameter", { status: 400 });
  }
  return { shopId };
}

// ─── Action ──────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");

  if (!shopId) {
    return {
      error: "Missing shopId. Please reload from the Witylogix dashboard.",
    };
  }

  const formData = await request.formData();
  const storeUrl = String(formData.get("storeUrl") ?? "").trim();
  const consumerKey = String(formData.get("consumerKey") ?? "").trim();
  const consumerSecret = String(formData.get("consumerSecret") ?? "").trim();

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return { error: "All fields are required." };
  }

  try {
    const status = await verifyWooCommerceCredentials(
      storeUrl,
      consumerKey,
      consumerSecret,
    );
    const result = await saveWooCommerceConnection(
      { shopId, storeUrl, consumerKey, consumerSecret },
      status,
    );

    const successUrl = new URL("/connected", url.origin);
    successUrl.searchParams.set("storeName", result.storeName);
    successUrl.searchParams.set("currency", result.currency);
    return redirect(successUrl.toString());
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error. Please try again.";
    return { error: message };
  }
}

// ─── Component ───────────────────────────────────────────────

export default function ConnectPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showSecret, setShowSecret] = useState<boolean>(false);

  return (
    <div className="card">
      <div className="logo">
        <div
          style={{
            width: 32,
            height: 32,
            background: "#6366f1",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="logo-text">Witylogix</span>
      </div>

      <h1>Connect WooCommerce</h1>
      <p className="subtitle">
        Enter your WooCommerce REST API credentials to link your store. You can
        generate keys in{" "}
        <strong>WP Admin → WooCommerce → Settings → Advanced → REST API</strong>
        .
      </p>

      {actionData?.error && (
        <div className="error-banner" role="alert">
          {actionData.error}
        </div>
      )}

      <Form method="post">
        <div className="field">
          <label htmlFor="storeUrl">Store URL</label>
          <input
            id="storeUrl"
            name="storeUrl"
            type="url"
            placeholder="https://mystore.com"
            required
            autoComplete="off"
            spellCheck={false}
          />
          <div className="hint">
            The root URL of your WordPress / WooCommerce site.
          </div>
        </div>

        <div className="field">
          <label htmlFor="consumerKey">Consumer Key</label>
          <input
            id="consumerKey"
            name="consumerKey"
            type="text"
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="consumerSecret">Consumer Secret</label>
          <div style={{ position: "relative" }}>
            <input
              id="consumerSecret"
              name="consumerSecret"
              type={showSecret ? "text" : "password"}
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
              autoComplete="off"
              spellCheck={false}
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v: boolean) => !v)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: 12,
                padding: "2px 4px",
              }}
              aria-label={showSecret ? "Hide secret" : "Show secret"}
            >
              {showSecret ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? "Verifying…" : "Connect Store"}
        </button>
      </Form>
    </div>
  );
}
