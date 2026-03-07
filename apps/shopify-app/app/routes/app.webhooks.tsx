/**
 * Webhook Management Dashboard
 *
 * Allows Shopify merchants to:
 *   1. View and manage outbound webhook endpoints
 *   2. Configure which Shopify events trigger Witylogix workflows
 *   3. View recent webhook delivery logs with request/response details
 *
 * Sections:
 *   - Outbound Webhooks: CRUD operations on custom webhook destinations
 *   - Shopify Workflow Triggers: Toggle which Shopify events fire workflows
 *   - Delivery Log: Historical view of recent webhook deliveries
 */

import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigate, json } from "react-router";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  DataTable,
  Modal,
  TextField,
  Checkbox,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";
import { authenticate } from "~/lib/shopify.server";
import { createApiClient } from "~/lib/api.server";

// ─── Types ────────────────────────────────────────────────

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "circuit_open";
  lastDeliveryAt?: Date;
  failureCount: number;
  secret: string;
}

interface WebhookTrigger {
  shopifyEvent: string;
  workflowName: string;
  enabled: boolean;
}

interface WebhookDelivery {
  id: string;
  event: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
}

interface WebhookPageData {
  endpoints: WebhookEndpoint[];
  triggers: WebhookTrigger[];
  deliveries: WebhookDelivery[];
}

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  try {
    // Fetch webhook endpoints, triggers, and delivery logs in parallel
    const [endpointsRes, triggersRes, deliveriesRes] = await Promise.allSettled(
      [
        api.get<{ data: WebhookEndpoint[] }>(
          "/api/v4/shops/me/webhooks/endpoints"
        ),
        api.get<{ data: WebhookTrigger[] }>(
          "/api/v4/shops/me/webhooks/triggers"
        ),
        api.get<{ data: WebhookDelivery[] }>(
          "/api/v4/shops/me/webhooks/deliveries",
          { limit: 50 }
        ),
      ]
    );

    const endpoints: WebhookEndpoint[] =
      endpointsRes.status === "fulfilled" ? endpointsRes.value.data : [];
    const triggers: WebhookTrigger[] =
      triggersRes.status === "fulfilled" ? triggersRes.value.data : [];
    const deliveries: WebhookDelivery[] =
      deliveriesRes.status === "fulfilled" ? deliveriesRes.value.data : [];

    return json<WebhookPageData>({ endpoints, triggers, deliveries });
  } catch (error) {
    console.error("Failed to load webhook data", error);
    return json<WebhookPageData>(
      {
        endpoints: [],
        triggers: [],
        deliveries: [],
      },
      { status: 500 }
    );
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  if (request.method === "POST") {
    const formData = await request.formData();
    const action = formData.get("_action");

    try {
      if (action === "add-endpoint") {
        const url = formData.get("url") as string;
        const events = JSON.parse(formData.get("events") as string);

        await api.post("/api/v4/shops/me/webhooks/endpoints", { url, events });
        return json({ success: true });
      }

      if (action === "delete-endpoint") {
        const id = formData.get("id") as string;
        await api.delete(`/api/v4/shops/me/webhooks/endpoints/${id}`);
        return json({ success: true });
      }

      if (action === "update-trigger") {
        const shopifyEvent = formData.get("event") as string;
        const enabled = formData.get("enabled") === "true";

        await api.patch(`/api/v4/shops/me/webhooks/triggers/${shopifyEvent}`, {
          enabled,
        });
        return json({ success: true });
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

export default function WebhooksPage() {
  const { endpoints, triggers, deliveries } =
    useLoaderData<WebhookPageData>();
  const actionData = useActionData<{
    success?: boolean;
    error?: string;
  }>();
  const navigate = useNavigate();

  const [addModalActive, setAddModalActive] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(
    null
  );

  const handleAddWebhook = useCallback(async () => {
    const formData = new FormData();
    formData.set("_action", "add-endpoint");
    formData.set("url", newUrl);
    formData.set("events", JSON.stringify(selectedEvents));

    const response = await fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setAddModalActive(false);
      setNewUrl("");
      setSelectedEvents([]);
      window.location.reload();
    }
  }, [newUrl, selectedEvents]);

  const handleDeleteWebhook = useCallback((id: string) => {
    if (!confirm("Are you sure you want to delete this webhook endpoint?")) {
      return;
    }

    const formData = new FormData();
    formData.set("_action", "delete-endpoint");
    formData.set("id", id);

    fetch(window.location.pathname, {
      method: "POST",
      body: formData,
    }).then(() => {
      window.location.reload();
    });
  }, []);

  const handleToggleTrigger = useCallback(
    async (event: string, enabled: boolean) => {
      const formData = new FormData();
      formData.set("_action", "update-trigger");
      formData.set("event", event);
      formData.set("enabled", String(!enabled));

      await fetch(window.location.pathname, {
        method: "POST",
        body: formData,
      });

      window.location.reload();
    },
    []
  );

  return (
    <Page title="Webhooks" subtitle="Manage webhook endpoints and workflow triggers">
      <Layout>
        {/* Info Banner */}
        <Layout.Section>
          <Banner>
            <p>
              Configure where Shopify events are sent and which events trigger
              Witylogix workflows.
            </p>
          </Banner>
        </Layout.Section>

        {/* Outbound Webhooks Section */}
        <Layout.Section>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <Text as="h2" variant="headingLg">
                  Outbound Webhooks
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Custom endpoints that receive Shopify events
                </Text>
              </div>
              <Button onClick={() => setAddModalActive(true)}>
                Add Webhook
              </Button>
            </div>

            {endpoints.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  No webhook endpoints configured yet
                </Text>
              </div>
            ) : (
              <IndexTable
                resourceName={{
                  singular: "webhook",
                  plural: "webhooks",
                }}
                itemCount={endpoints.length}
                headings={[
                  { title: "URL" },
                  { title: "Events" },
                  { title: "Status" },
                  { title: "Last Delivery" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {endpoints.map((endpoint, index) => (
                  <IndexTable.Row key={endpoint.id} position={index}>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodyMd" truncate>
                        {endpoint.url}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {endpoint.events.map((event) => (
                          <Badge key={event} tone="info">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge
                        tone={
                          endpoint.status === "active"
                            ? "success"
                            : endpoint.status === "paused"
                              ? "warning"
                              : "critical"
                        }
                      >
                        {endpoint.status}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {endpoint.lastDeliveryAt
                          ? new Date(endpoint.lastDeliveryAt).toLocaleDateString()
                          : "Never"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          icon={EditIcon}
                          variant="plain"
                          onClick={() =>
                            navigate(`/app/webhooks/${endpoint.id}`)
                          }
                        />
                        <Button
                          icon={DeleteIcon}
                          variant="plain"
                          tone="critical"
                          onClick={() => handleDeleteWebhook(endpoint.id)}
                        />
                      </div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        {/* Workflow Triggers Section */}
        <Layout.Section>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Text as="h2" variant="headingLg">
                Shopify Workflow Triggers
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Choose which Shopify events automatically trigger Witylogix workflows
              </Text>
            </div>

            {triggers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  No workflow triggers configured
                </Text>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {triggers.map((trigger) => (
                  <div
                    key={trigger.shopifyEvent}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: "var(--p-color-bg-surface-secondary)",
                    }}
                  >
                    <div>
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {trigger.shopifyEvent}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Triggers: {trigger.workflowName}
                      </Text>
                    </div>
                    <Checkbox
                      label=""
                      checked={trigger.enabled}
                      onChange={() =>
                        handleToggleTrigger(
                          trigger.shopifyEvent,
                          trigger.enabled
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Layout.Section>

        {/* Delivery Log Section */}
        <Layout.Section>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Text as="h2" variant="headingLg">
                Delivery Log
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Recent webhook deliveries and their status
              </Text>
            </div>

            {deliveries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  No deliveries yet
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={[
                  "Event",
                  "Endpoint",
                  "Status",
                  "Duration",
                  "Timestamp",
                ]}
                rows={deliveries.map((delivery) => [
                  delivery.event,
                  delivery.endpoint,
                  String(delivery.statusCode),
                  `${delivery.duration}ms`,
                  new Date(delivery.timestamp).toLocaleString(),
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* Add Webhook Modal */}
      <Modal
        open={addModalActive}
        onClose={() => setAddModalActive(false)}
        title="Add Webhook Endpoint"
        primaryAction={{
          content: "Add",
          onAction: handleAddWebhook,
          disabled: !newUrl || selectedEvents.length === 0,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setAddModalActive(false),
          },
        ]}
      >
        <Modal.Section>
          <TextField
            label="Endpoint URL"
            value={newUrl}
            onChange={setNewUrl}
            placeholder="https://example.com/webhooks/shopify"
            autoComplete="off"
            error={newUrl && !isValidUrl(newUrl) ? "Invalid URL" : undefined}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// ─── Helper Functions ──────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
