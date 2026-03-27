/**
 * Shopify OAuth initiation — **only** for the exact path `/auth`.
 *
 * This file must be `auth._index.tsx`, not `auth.tsx`. A parent `auth.tsx`
 * layout would run this loader for every `/auth/*` child (`/auth/session-token`,
 * `/auth/callback`, …) and call `login()`, which breaks embedded session-token
 * handling and surfaces as 404 in the admin iframe.
 */

import type { LoaderFunctionArgs } from "react-router";
import { Page, Card, Layout, Text } from "@shopify/polaris";
import { login } from "~/lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return {
      error: "Missing shop parameter",
      shop: null,
    };
  }

  if (!shop.endsWith(".myshopify.com") && !shop.includes(".")) {
    return {
      error:
        "Invalid shop domain. Must be in format: example.myshopify.com or custom.shopify.com",
      shop,
    };
  }

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

export default function AuthRoute() {
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
