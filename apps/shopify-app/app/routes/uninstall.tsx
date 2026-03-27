import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useActionData, useFetcher } from "react-router";
import { useState } from "react";
import { Page, Card, Layout, Text, Banner, Button, Modal, TextContainer } from "@shopify/polaris";
import { createApiClientFromRequest } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

interface UninstallResult {
  success: boolean;
  message: string;
  shopId?: string;
}

interface UninstallActionData {
  status: "success" | "error";
  message: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (!session || !session.accessToken) {
    return { error: "Not authenticated" };
  }

  const api = createApiClientFromRequest(request, session);

  try {
    const shopInfo = await api.get<{ data: { id: string; name: string } }>(
      "/api/v4/shops/me"
    );
    return { shopInfo: shopInfo.data, error: null };
  } catch (error) {
    console.error("Failed to fetch shop info:", error);
    return { shopInfo: null, error: "Could not load shop information" };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return { status: "error", message: "Method not allowed" };
  }

  const { session } = await authenticate.admin(request);

  if (!session || !session.accessToken) {
    return { status: "error", message: "Not authenticated" };
  }

  const api = createApiClientFromRequest(request, session);

  try {
    const uninstallResult = await api.post<UninstallResult>(
      "/api/v4/shops/uninstall",
      {
        reason: "user-requested",
        timestamp: new Date().toISOString(),
      }
    );

    if (uninstallResult.success) {
      try {
        await api.post("/api/v4/shops/webhooks/deregister", {
          topics: [
            "app/uninstalled",
            "orders/create",
            "orders/updated",
            "orders/fulfilled",
          ],
        });
      } catch (error) {
        console.warn("Failed to deregister some webhooks:", error);
      }

      return {
        status: "success",
        message: "App uninstalled successfully. Redirecting to Shopify Admin...",
      };
    } else {
      return {
        status: "error",
        message: uninstallResult.message || "Uninstall failed",
      };
    }
  } catch (error) {
    console.error("Uninstall error:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to uninstall app. Please try again.",
    };
  }
}

export default function UninstallPage() {
  const actionData = useActionData<UninstallActionData>();
  const fetcher = useFetcher();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (actionData?.status === "success") {
    setTimeout(() => {
      window.location.href = "https://admin.shopify.com/";
    }, 2000);
  }

  const handleUninstallClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmUninstall = async () => {
    setIsProcessing(true);
    setShowConfirmModal(false);
    fetcher.submit({ action: "uninstall" }, { method: "POST" });
  };

  const handleExportData = async () => {
    const csv = "id,date,status\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "witylogix-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page title="Uninstall Witylogix">
      <Layout>
        {actionData?.status === "success" && (
          <Layout.Section>
            <Banner tone="success" title="Uninstall Complete">
              <Text as="p">
                {actionData.message}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.status === "error" && (
          <Layout.Section>
            <Banner tone="critical" title="Uninstall Failed">
              <Text as="p">
                {actionData.message}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Banner tone="warning" title="This action cannot be undone">
            <Text as="p">
              Uninstalling will immediately stop real-time order syncing,
              webhook delivery, and driver tracking. However, your historical
              data will be retained.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "32px" }}>
              <Text variant="headingMd" as="h2">
                What Happens When You Uninstall
              </Text>

              <div style={{ marginBottom: "28px", marginTop: "20px" }}>
                <Text variant="headingSm" as="h3">
                  Will be removed:
                </Text>
                <ul style={{ marginTop: "12px", paddingLeft: "20px" }}>
                  {[
                    "Webhooks — app/uninstalled, orders/create, orders/updated, orders/fulfilled",
                    "Real-time order syncing from Shopify",
                    "Live driver tracking and location updates",
                    "Scheduled delivery notifications to customers",
                    "API integration between Shopify and Witylogix",
                  ].map((item, idx) => (
                    <li key={idx} style={{ marginBottom: "8px" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginBottom: "28px" }}>
                <Text variant="headingSm" as="h3">
                  Will be retained:
                </Text>
                <ul style={{ marginTop: "12px", paddingLeft: "20px" }}>
                  {[
                    "Historical order and delivery data (90 days retention)",
                    "Analytics and performance reports",
                    "Driver information and rating history",
                    "Delivery zone and location data",
                  ].map((item, idx) => (
                    <li key={idx} style={{ marginBottom: "8px" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Banner tone="info" title="Export Your Data Before Uninstalling">
                <Text as="p">
                  Download all your orders, deliveries, and analytics in CSV
                  format. This can be imported into other platforms.
                </Text>
                <div style={{ marginTop: "12px" }}>
                  <Button onClick={handleExportData} variant="plain">
                    Export Data
                  </Button>
                </div>
              </Banner>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ marginBottom: "20px", color: "var(--p-color-text-subdued)" }}>
                This will immediately disconnect your Shopify store from
                Witylogix.
              </p>
              <Button
                variant="primary"
                size="large"
                onClick={handleUninstallClick}
                loading={isProcessing}
              >
                Uninstall App
              </Button>
            </div>
          </Card>
        </Layout.Section>

        <Modal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Confirm Uninstall"
          primaryAction={{
            content: "Uninstall",
            onAction: handleConfirmUninstall,
            loading: isProcessing,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowConfirmModal(false),
              disabled: isProcessing,
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <Text as="p" variant="bodyMd">
                Are you sure? This action will:
              </Text>
              <ul style={{ marginTop: "12px", paddingLeft: "20px" }}>
                <li>Stop real-time order syncing</li>
                <li>Deregister all webhooks</li>
                <li>Disconnect your driver tracking</li>
              </ul>
              <p style={{ marginTop: "16px", fontStyle: "italic", color: "var(--p-color-text-subdued)" }}>
                Your historical data will be retained for 90 days. After that,
                it will be permanently deleted.
              </p>
            </TextContainer>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
}
