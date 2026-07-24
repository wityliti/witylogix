import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Card, Layout, Text, Button, Banner } from "@shopify/polaris";
import { createApiClientFromRequest } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

interface InstallPageData {
  isInstalled: boolean;
  shopName?: string;
  installDate?: string;
  trialDaysRemaining?: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "example.myshopify.com";

  let isInstalled = false;
  let shopName = undefined;
  let installDate = undefined;
  let trialDaysRemaining = undefined;

  try {
    const { session } = await authenticate.admin(request);
    if (session && session.accessToken) {
      const api = createApiClientFromRequest(request, session);
      const response = await api.get<{
        data: {
          isInstalled: boolean;
          name: string;
          installDate: string;
          trialDaysRemaining: number;
        };
      }>("/api/v4/shops/me");

      if (response.data) {
        isInstalled = response.data.isInstalled;
        shopName = response.data.name;
        installDate = response.data.installDate;
        trialDaysRemaining = response.data.trialDaysRemaining;
      }
    }
  } catch (error) {
    console.debug("Installation check skipped:", error);
  }

  return { isInstalled, shopName, installDate, trialDaysRemaining };
}

export default function InstallPage() {
  const { isInstalled, shopName, trialDaysRemaining } =
    useLoaderData<InstallPageData>();

  const handleInstall = () => {
    const shop = new URLSearchParams(window.location.search).get("shop");
    if (shop) {
      window.location.href = `/auth?shop=${encodeURIComponent(shop)}`;
    }
  };

  return (
    <Page>
      <Layout>
        {isInstalled && (
          <Layout.Section>
            <Banner tone="success" title="App Installed">
              <Text as="span">
                Witylogix is active on {shopName}. You're on a trial plan with{" "}
                <strong>{trialDaysRemaining} days remaining</strong>.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <div style={{ padding: "40px 32px", textAlign: "center" }}>
              <Text variant="headingXl" as="h1">
                Same-Day & Next-Day Delivery at Scale
              </Text>
              <p
                style={{
                  marginTop: "12px",
                  fontSize: "18px",
                  color: "var(--p-color-text-subdued)",
                }}
              >
                Witylogix powers fast, affordable fulfillment for D2C brands.
                Manage deliveries, track in real-time, and delight customers.
              </p>

              {!isInstalled && (
                <div style={{ marginTop: "24px" }}>
                  <Button
                    variant="primary"
                    size="large"
                    onClick={handleInstall}
                  >
                    Install App
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "32px" }}>
              <Text variant="headingMd" as="h2">
                Key Features
              </Text>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "24px",
                  marginTop: "20px",
                }}
              >
                {[
                  {
                    title: "Real-Time Order Sync",
                    description:
                      "Orders sync automatically from Shopify. Assignments and tracking update in real-time.",
                  },
                  {
                    title: "Driver Management",
                    description:
                      "Manage your driver fleet, track locations, and optimize routes.",
                  },
                  {
                    title: "Delivery Zones",
                    description:
                      "Define service areas, set delivery fees, and manage cutoff times.",
                  },
                  {
                    title: "Customer Tracking",
                    description:
                      "Customers see live tracking, estimated arrival, and driver contact.",
                  },
                  {
                    title: "Analytics Dashboard",
                    description:
                      "Monitor delivery success rates, costs, and performance metrics.",
                  },
                  {
                    title: "Webhook Integration",
                    description:
                      "Seamless webhooks for order creation, fulfillment, and returns.",
                  },
                ].map((feature, idx) => (
                  <div key={idx} style={{ paddingBottom: "16px" }}>
                    <Text variant="headingSm" as="h3">
                      {feature.title}
                    </Text>
                    <p
                      style={{
                        marginTop: "8px",
                        color: "var(--p-color-text-subdued)",
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "32px" }}>
              <Text variant="headingMd" as="h2">
                What We Access
              </Text>

              <div style={{ marginTop: "20px" }}>
                <p
                  style={{
                    marginBottom: "16px",
                    color: "var(--p-color-text-subdued)",
                  }}
                >
                  Witylogix requests permission to:
                </p>

                <ul
                  style={{
                    listStylePosition: "inside",
                    paddingLeft: "0",
                    margin: "0",
                  }}
                >
                  {[
                    "Read and write orders — for sync and fulfillment",
                    "Read products — to categorize and weight shipments",
                    "Read customer data — for delivery confirmation",
                    "Read and write shipping settings — for carrier integration",
                    "Register webhooks — for real-time updates",
                  ].map((permission, idx) => (
                    <li key={idx} style={{ marginBottom: "12px" }}>
                      {permission}
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: "20px" }}>
                  <Banner tone="info" title="Data Security">
                    <Text as="p">
                      Your access token is encrypted and stored securely.
                      Witylogix never shares your data with third parties.
                    </Text>
                  </Banner>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "32px" }}>
              <Text variant="headingMd" as="h2">
                FAQ
              </Text>

              <div style={{ marginTop: "24px" }}>
                {[
                  {
                    question: "How much does Witylogix cost?",
                    answer:
                      "We offer a 30-day free trial. After that, pricing is based on deliveries completed. No setup fees.",
                  },
                  {
                    question: "Can I export my data?",
                    answer:
                      "Yes. You can export all historical order and delivery data at any time from Settings > Data Export.",
                  },
                  {
                    question: "What if I uninstall the app?",
                    answer:
                      "Historical data and analytics are retained for 90 days. Webhooks and real-time sync will stop immediately.",
                  },
                  {
                    question: "How do I contact support?",
                    answer:
                      "Email support@witylogix.com or use the in-app Help button. Response time: < 2 hours during business hours.",
                  },
                  {
                    question: "Is there a setup wizard?",
                    answer:
                      "Yes! After installation, you'll be guided through delivery zone setup, carrier integration, and tracking configuration.",
                  },
                ].map((faq, idx) => (
                  <div key={idx} style={{ marginBottom: "24px" }}>
                    <Text variant="headingSm" as="h3">
                      {faq.question}
                    </Text>
                    <p
                      style={{
                        marginTop: "8px",
                        color: "var(--p-color-text-subdued)",
                      }}
                    >
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Layout.Section>

        {!isInstalled && (
          <Layout.Section>
            <Card>
              <div style={{ padding: "32px", textAlign: "center" }}>
                <Text variant="headingMd" as="h2">
                  Ready to start?
                </Text>
                <div style={{ marginTop: "16px" }}>
                  <Button
                    variant="primary"
                    size="large"
                    onClick={handleInstall}
                  >
                    Install Witylogix Now
                  </Button>
                </div>
              </div>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
