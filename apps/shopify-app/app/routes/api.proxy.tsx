/**
 * App Proxy Handler
 *
 * Handles requests from Shopify's App Proxy feature.
 * Storefront pages can make authenticated requests to:
 *   https://shop.myshopify.com/apps/witylogix/...
 *
 * which Shopify forwards to:
 *   ${SHOPIFY_APP_URL}/api/proxy/...
 *
 * Use cases:
 *   - Tracking page embed on storefront
 *   - Delivery date picker data for storefront
 *   - Customer self-service delivery rescheduling
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import crypto from "node:crypto";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

/**
 * Validate the Shopify app proxy signature.
 * Shopify signs proxy requests with the app's shared secret.
 */
function validateProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const params = new URLSearchParams(url.search);
  const signature = params.get("signature");
  if (!signature) return false;

  // Remove signature from params for validation
  params.delete("signature");

  // Sort parameters and build query string
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(sortedParams)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (!validateProxySignature(url)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const shop = url.searchParams.get("shop") || "";
  const path = url.searchParams.get("path") || "";

  // Forward to API with shop context
  try {
    const apiUrl = `${API_BASE}/api/v4/proxy/${path}`;
    const response = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Shop-Domain": shop,
      },
    });

    const data = await response.json();
    return Response.json(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/liquid",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);

  if (!validateProxySignature(url)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const shop = url.searchParams.get("shop") || "";
  const body = await request.text();

  try {
    const apiUrl = `${API_BASE}/api/v4/proxy`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Shop-Domain": shop,
      },
      body,
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
}
