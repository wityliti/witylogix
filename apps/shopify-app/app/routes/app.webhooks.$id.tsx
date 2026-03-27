/**
 * Webhook Detail & Edit Page
 *
 * View and manage a specific webhook endpoint:
 *   - Edit URL and subscribed events
 *   - View delivery history
 *   - Send test events
 *   - Rotate API secret
 *   - Delete webhook
 *
 * Route: /app/webhooks/:id
 */

import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  useLoaderData,
  useActionData,
  useNavigate,
  useParams,
  data as json,
  redirect,
} from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Text,
  Badge,
  DataTable,
  Modal,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import {
  DeleteIcon,
  RefreshIcon,
  SendIcon,
} from "@shopify/polaris-icons";
import { WebhookEventPicker } from "~/components/WebhookEventPicker";
import { authenticate } from "~/lib/shopify.server";
import { createApiClientFromRequest } from "~/lib/api.server";

// ─── Types ────────────────────────────────────────────────

interface WebhookDetail {
  id: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "circuit_open";
  secret: string;
  createdAt: Date;
  updatedAt: Date;
  deliveryCount: number;
  failureCount: number;
  lastDeliveryAt?: Date;
  lastFailureAt?: Date;
}

interface WebhookDeliveryDetail {
  id: string;
  event: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  error?: string;
}

interface WebhookDetailPageData {
  webhook: WebhookDetail;
  recentDeliveries: WebhookDeliveryDetail[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;
  if (!id) {
    throw new Error("Missing webhook ID");
  }

  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  try {
    const [webhookRes, deliveriesRes] = await Promise.allSettled([
      api.get<{ data: WebhookDetail }>(
        `/api/v4/shops/me/webhooks/endpoints/${id}`
      ),
      api.get<{ data: WebhookDeliveryDetail[] }>(
        `/api/v4/shops/me/webhooks/endpoints/${id}/deliveries`,
        { limit: 20 }
      ),
    ]);

    const webhook =
      webhookRes.status === "fulfilled"
        ? webhookRes.value.data
        : ({} as WebhookDetail);
    const recentDeliveries =
      deliveriesRes.status === "fulfilled"
        ? deliveriesRes.value.data
        : [];

    return json<WebhookDetailPageData>({
      webhook,
      recentDeliveries,
    });
  } catch (error) {
    console.error("Failed to load webhook", error);
    throw error;
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ params, request }: ActionFunctionArgs) {
  const { id } = params;
  if (!id) {
    return json({ error: "Missing webhook ID" }, { status: 400 });
  }

  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  if (request.method === "POST") {
    const formData = await request.formData();
    const action = formData.get("_action");

    try {
      if (action === "update") {
        const url = formData.get("url") as string;
        const events = JSON.parse(formData.get("events") as string);

        await api.patch(`/api/v4/shops/me/webhooks/endpoints/${id}`, {
          url,
          events,
        });

        return json({ success: true });
      }

      if (action === "rotate-secret") {
        await api.post(
          `/api/v4/shops/me/webhooks/endpoints/${id}/rotate-secret`,
          {}
        );
        return json({ success: true });
      }

      if (action === "test-event") {
        const event = formData.get("event") as string;
        await api.post(
          `/api/v4/shops/me/webhooks/endpoints/${id}/test`,
          { event }
        );
        return json({ success: true, message: "Test event sent" });
      }

      if (action === "delete") {
        await api.delete(`/api/v4/shops/me/webhooks/endpoints/${id}`);
        return redirect("/app/webhooks");
      }

      return json({ error: "Unknown action" }, { status: 400 });
    } catch (error) {
      console.error("Action failed", error);
      return json(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}

// ─── Component ─────────────────────────────────────────────

export default function WebhookDetailPage() {
  const { webhook, recentDeliveries } =
    useLoaderData<WebhookDetailPageData>();
  const actionData = useActionData<{
    success?: boolean;
    message?: string;
    error?: string;
  }>();
  const navigate = useNavigate();

  // Form state
  const [url, setUrl] = useState(webhook.url);
  const [events, setEvents] = useState(webhook.events);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [rotateModalActive, setRotateModalActive] = useState(false);
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(
    null
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("_action", "update");
    formData.set("url", url);
    formData.set("events", JSON.stringify(events));

    const response = await fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setIsEditing(false);
      window.location.reload();
    }
    setIsSaving(false);
  }, [url, events]);

  const handleRotateSecret = useCallback(async () => {
    const formData = new FormData();
    formData.set("_action", "rotate-secret");

    const response = await fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setRotateModalActive(false);
      window.location.reload();
    }
  }, []);

  const handleTestEvent = useCallback(async (event: string) => {
    const formData = new FormData();
    formData.set("_action", "test-event");
    formData.set("event", event);

    await fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    });
  }, []);

  const handleDelete = useCallback(async () => {
    const formData = new FormData();
    formData.set("_action", "delete");

    await fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    });
  }, []);

  const isValidUrl = (u: string) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Page
      title="Webhook Endpoint"
      breadcrumbs={[
        { content: "Webhooks", url: "/app/webhooks" },
      ]}
      primaryAction={
        isEditing
          ? {
              content: "Save",
              onAction: handleSave,
              loading: isSaving,
              disabled: !isValidUrl(url) || events.length === 0,
            }
          : {
              content: "Edit",
              onAction: () => setIsEditing(true),
            }
      }
    >
      <Layout>
        {/* Status & Info */}
        <Layout.Section>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <div>
                <Text as="h2" variant="headingLg">
                  {url}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Created {new Date(webhook.createdAt).toLocaleDateString()}
                </Text>
              </div>
              <Badge
                tone={
                  webhook.status === "active"
                    ? "success"
                    : webhook.status === "paused"
                      ? "warning"
                      : "critical"
                }
              >
                {webhook.status}
              </Badge>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <Text as="p" variant="bodySm" tone="subdued">
                  Deliveries
                </Text>
                <Text as="p" variant="headingMd">
                  {webhook.deliveryCount}
                </Text>
              </div>
              <div>
                <Text as="p" variant="bodySm" tone="subdued">
                  Failures
                </Text>
                <Text as="p" variant="headingMd" tone="critical">
                  {webhook.failureCount}
                </Text>
              </div>
              <div>
                <Text as="p" variant="bodySm" tone="subdued">
                  Last Delivery
                </Text>
                <Text as="p" variant="headingMd">
                  {webhook.lastDeliveryAt
                    ? new Date(webhook.lastDeliveryAt).toLocaleDateString()
                    : "Never"}
                </Text>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* URL & Events Edit */}
        <Layout.Section>
          <Card>
            <Text as="h3" variant="headingMd">
              Endpoint Configuration
            </Text>

            <div style={{ marginTop: 16 }}>
              <TextField
                label="Webhook URL"
                value={url}
                onChange={setUrl}
                disabled={!isEditing}
                autoComplete="off"
                error={
                  url && !isValidUrl(url)
                    ? "Please enter a valid URL"
                    : undefined
                }
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <Text as="h4" variant="headingMd">
                Subscribed Events
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {events.length} event{events.length !== 1 ? "s" : ""} selected
              </Text>
              {isEditing && (
                <div style={{ marginTop: 12 }}>
                  <WebhookEventPicker
                    selected={events}
                    onChange={setEvents}
                  />
                </div>
              )}
              {!isEditing && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "var(--p-color-bg-surface-secondary)",
                    marginTop: 12,
                  }}
                >
                  <Text as="p" variant="bodySm">
                    {events.map((e) => (
                      <Badge key={e}>{e}</Badge>
                    ))}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>

        {/* Secret & Danger Zone */}
        <Layout.Section>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <Text as="h3" variant="headingMd">
                  API Secret
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Use this to verify webhook signatures
                </Text>
              </div>
              <Button
                icon={RefreshIcon}
                variant="primary"
                onClick={() => setRotateModalActive(true)}
              >
                Rotate Secret
              </Button>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: "var(--p-color-bg-surface-secondary)",
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
                userSelect: "all",
              }}
            >
              {webhook.secret}
            </div>
          </Card>
        </Layout.Section>

        {/* Delivery History */}
        <Layout.Section>
          <Card>
            <Text as="h3" variant="headingMd">
              Recent Deliveries
            </Text>

            {recentDeliveries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Text as="p" variant="bodySm" tone="subdued">
                  No deliveries yet
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Event",
                  "Status",
                  "Duration",
                  "Timestamp",
                  "Details",
                ]}
                rows={recentDeliveries.map((delivery) => [
                  delivery.event,
                  String(delivery.statusCode),
                  `${delivery.duration}ms`,
                  new Date(delivery.timestamp).toLocaleString(),
                  expandedDelivery === delivery.id ? "Collapse" : "Expand",
                ])}
              />
            )}
          </Card>
        </Layout.Section>

        {/* Danger Zone */}
        <Layout.Section>
          <Card>
            <Text as="h3" variant="headingMd" tone="critical">
              Danger Zone
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Permanently delete this webhook endpoint
            </Text>
            <Button
              icon={DeleteIcon}
              variant="primary"
              tone="critical"
              onClick={() => setDeleteModalActive(true)}
              style={{ marginTop: 16 }}
            >
              Delete Webhook
            </Button>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Rotate Secret Modal */}
      <Modal
        open={rotateModalActive}
        onClose={() => setRotateModalActive(false)}
        title="Rotate API Secret"
        primaryAction={{
          content: "Rotate",
          onAction: handleRotateSecret,
          tone: "critical",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setRotateModalActive(false),
          },
        ]}
      >
        <Modal.Section>
          <Banner tone="warning">
            <p>
              This will generate a new API secret. Update your endpoint to use
              the new secret for HMAC validation.
            </p>
          </Banner>
        </Modal.Section>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteModalActive}
        onClose={() => setDeleteModalActive(false)}
        title="Delete Webhook"
        primaryAction={{
          content: "Delete",
          onAction: handleDelete,
          tone: "critical",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModalActive(false),
          },
        ]}
      >
        <Modal.Section>
          <Banner tone="critical">
            <p>
              This will permanently delete this webhook endpoint. Any events
              configured to use this endpoint will no longer be delivered.
            </p>
          </Banner>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
