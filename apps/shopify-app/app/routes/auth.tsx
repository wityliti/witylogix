/**
 * Shopify OAuth Initiation — Route for starting the OAuth flow.
 *
 * Flow:
 *   1. User arrives at /auth with ?shop=example.myshopify.com
 *   2. Validates shop parameter format
 *   3. Builds OAuth authorization URL with required scopes
 *   4. Redirects user to Shopify's OAuth endpoint
 *
 * Scopes:
 *   - read_orders, write_orders: order management
 *   - read_products: product access for delivery mapping
 *   - read_customers: customer data
 *   - read_shipping, write_shipping: carrier + fulfillment API
 *
 * Error handling: missing/invalid shop redirects to error page
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Page, Card, Layout, Text, Banner, Button } from "@shopify/polaris";
import { login } from "~/lib/shopify.server";

// ─── Constants ─────────────────────────────────────────────

const REQUIRED_SCOPES = [
  "read_orders",
  "write_orders",
  "read_products",
  "read_customers",
  "read_shipping",
  "write_shipping",
];

// ─── Loader ────────────────────────────────────────────────

/**
 * OAuth initiation: validates shop and redirects to Shopify
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // Validate shop parameter exists and has valid format
  if (!shop) {
    return {
      error: "Missing shop parameter",
      shop: null,
    };
  }

  // Validate shop domain format (must end with .myshopify.com)
  if (!shop.endsWith(".myshopify.com") && !shop.includes(".")) {
    return {
      error:
        "Invalid shop domain. Must be in format: example.myshopify.com or custom.shopify.com",
      shop,
    };
  }

  // Initiate Shopify OAuth flow
  // This redirects to: https://[shop]/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...
  try {
    return await login(request);
  } catch (error) {
    console.error("OAuth initiation error:", error);
    return {
      error: "Failed to initiate OAuth flow. Please try again.",
      shop,
    };
  }
}

// ─── Component ─────────────────────────────────────────────

/**
 * Error page shown if OAuth cannot be initiated
 */
export default function AuthRoute() {
  // If loader returns an error object instead of redirecting,
  // this component renders the error state
  return (
    <Page title="Initializing Installation...">
      <Layout>
        <Layout.Section>
          <Card>
            <div
              style={{
                padding: "24px",
                textAlign: "center",
              }}
            >
              <Text variant="headingLg" as="h1">
                Setting up your store connection
              </Text>
              <div style={{ marginTop: "16px" }}>
                <Text as="p" tone="subdued">
                  Redirecting to Shopify authorization...
                </Text>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
