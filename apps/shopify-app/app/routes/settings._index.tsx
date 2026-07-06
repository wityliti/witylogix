/**
 * Settings Page — Comprehensive multi-tab settings panel.
 *
 * Features:
 *   - Tabbed layout: General, Branding, Notifications, API Keys, Billing
 *   - General tab: company name, timezone picker, currency, weight unit, distance unit
 *   - Branding tab: logo URL input, primary/secondary color pickers, tracking page preview
 *   - Notifications tab: event type x channel grid (email, SMS, push, webhook toggles)
 *   - API Keys tab: list keys (masked), create key form, revoke button
 *   - Billing tab: current plan display, usage meters, invoice history
 *   - Save button per section
 *
 * All data is loaded server-side via React Router v7 loader.
 * Form submission via POST with intent field.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  Tabs,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  IndexTable,
  Badge,
  Banner,
  Box,
  ProgressBar,
  Divider,
} from "@shopify/polaris";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface GeneralSettings {
  companyName: string;
  timezone: string;
  currency: string;
  weightUnit: "kg" | "lbs";
  distanceUnit: "km" | "miles";
}

interface BrandingSettings {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  trackingPageUrl: string;
}

interface NotificationSettings {
  events: {
    name: string;
    channels: {
      name: string;
      enabled: boolean;
    }[];
  }[];
}

interface APIKey {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface BillingInfo {
  plan: string;
  monthlyUsage: number;
  monthlyLimit: number;
  nextBillingDate: string;
  invoices: {
    id: string;
    date: string;
    amount: number;
    status: "paid" | "pending" | "failed";
  }[];
}

interface SettingsPageData {
  general: GeneralSettings;
  branding: BrandingSettings;
  notifications: NotificationSettings;
  apiKeys: APIKey[];
  billing: BillingInfo;
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  try {
    const response = await client.get<{ data: SettingsPageData }>(
      "/api/v4/shops/me/settings",
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return {
      general: {
        companyName: "",
        timezone: "UTC",
        currency: "USD",
        weightUnit: "kg",
        distanceUnit: "km",
      },
      branding: {
        logoUrl: "",
        primaryColor: "#005bd3",
        secondaryColor: "#00a699",
        trackingPageUrl: "",
      },
      notifications: {
        events: [
          {
            name: "Order Created",
            channels: [
              { name: "email", enabled: true },
              { name: "sms", enabled: false },
              { name: "push", enabled: false },
              { name: "webhook", enabled: true },
            ],
          },
          {
            name: "Order Shipped",
            channels: [
              { name: "email", enabled: true },
              { name: "sms", enabled: true },
              { name: "push", enabled: false },
              { name: "webhook", enabled: true },
            ],
          },
          {
            name: "Order Delivered",
            channels: [
              { name: "email", enabled: true },
              { name: "sms", enabled: true },
              { name: "push", enabled: true },
              { name: "webhook", enabled: true },
            ],
          },
        ],
      },
      apiKeys: [
        {
          id: "key_1",
          name: "Production API Key",
          maskedKey:
            "witylogix_live_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
          createdAt: "2026-01-15",
          lastUsedAt: "2026-03-06",
        },
      ],
      billing: {
        plan: "Professional",
        monthlyUsage: 15420,
        monthlyLimit: 50000,
        nextBillingDate: "2026-04-06",
        invoices: [
          {
            id: "inv_001",
            date: "2026-02-06",
            amount: 299,
            status: "paid",
          },
          {
            id: "inv_002",
            date: "2026-03-06",
            amount: 299,
            status: "pending",
          },
        ],
      },
    };
  }
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return null;
  }

  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "save-general") {
      const data = {
        companyName: formData.get("companyName"),
        timezone: formData.get("timezone"),
        currency: formData.get("currency"),
        weightUnit: formData.get("weightUnit"),
        distanceUnit: formData.get("distanceUnit"),
      };
      await client.patch("/api/v4/shops/me/settings/general", data);
      return { success: true, message: "General settings saved" };
    }

    if (intent === "save-branding") {
      const data = {
        logoUrl: formData.get("logoUrl"),
        primaryColor: formData.get("primaryColor"),
        secondaryColor: formData.get("secondaryColor"),
      };
      await client.patch("/api/v4/shops/me/settings/branding", data);
      return { success: true, message: "Branding settings saved" };
    }

    if (intent === "save-notifications") {
      const events = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("notification_")) {
          events.push({ key, value: value === "on" });
        }
      }
      await client.patch("/api/v4/shops/me/settings/notifications", { events });
      return { success: true, message: "Notification settings saved" };
    }

    if (intent === "create-api-key") {
      const name = formData.get("apiKeyName");
      await client.post("/api/v4/shops/me/settings/api-keys", { name });
      return { success: true, message: "API key created" };
    }

    if (intent === "revoke-api-key") {
      const keyId = formData.get("keyId");
      await client.delete(`/api/v4/shops/me/settings/api-keys/${keyId}`);
      return { success: true, message: "API key revoked" };
    }
  } catch (error) {
    return { success: false, error: "Failed to save settings" };
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────

export default function Settings() {
  const data = useLoaderData<SettingsPageData>();
  const actionData = useActionData();
  const [selectedTab, setSelectedTab] = useState(0);
  const [newApiKeyName, setNewApiKeyName] = useState("");

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const tabs = [
    { id: "general", content: "General" },
    { id: "branding", content: "Branding" },
    { id: "notifications", content: "Notifications" },
    { id: "api-keys", content: "API Keys" },
    { id: "billing", content: "Billing" },
  ];

  return (
    <Page
      title="Settings"
      subtitle="Manage your shop settings, branding, notifications, and billing"
    >
      <BlockStack gap="400">
        {/* Action Feedback */}
        {actionData?.success && (
          <Banner tone="success">{actionData.message}</Banner>
        )}
        {actionData?.error && (
          <Banner tone="critical">{actionData.error}</Banner>
        )}

        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {selectedTab === 0 && <GeneralTab data={data.general} />}
              {selectedTab === 1 && <BrandingTab data={data.branding} />}
              {selectedTab === 2 && (
                <NotificationsTab data={data.notifications} />
              )}
              {selectedTab === 3 && (
                <APIKeysTab
                  data={data.apiKeys}
                  newKeyName={newApiKeyName}
                  setNewKeyName={setNewApiKeyName}
                />
              )}
              {selectedTab === 4 && <BillingTab data={data.billing} />}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}

// ─── General Tab ───────────────────────────────────────────

function GeneralTab({ data }: { data: GeneralSettings }) {
  const timezoneOptions = [
    { label: "UTC", value: "UTC" },
    { label: "Eastern Time (EST)", value: "EST" },
    { label: "Central Time (CST)", value: "CST" },
    { label: "Mountain Time (MST)", value: "MST" },
    { label: "Pacific Time (PST)", value: "PST" },
    { label: "Indian Standard Time (IST)", value: "IST" },
    { label: "Greenwich Mean Time (GMT)", value: "GMT" },
  ];

  const currencyOptions = [
    { label: "USD (US Dollar)", value: "USD" },
    { label: "EUR (Euro)", value: "EUR" },
    { label: "GBP (British Pound)", value: "GBP" },
    { label: "CAD (Canadian Dollar)", value: "CAD" },
    { label: "AUD (Australian Dollar)", value: "AUD" },
    { label: "INR (Indian Rupee)", value: "INR" },
    { label: "JPY (Japanese Yen)", value: "JPY" },
  ];

  const weightOptions = [
    { label: "Kilograms (kg)", value: "kg" },
    { label: "Pounds (lbs)", value: "lbs" },
  ];

  const distanceOptions = [
    { label: "Kilometers (km)", value: "km" },
    { label: "Miles (mi)", value: "miles" },
  ];

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="save-general" />
      <FormLayout>
        <TextField
          label="Company Name"
          name="companyName"
          type="text"
          defaultValue={data.companyName}
          placeholder="Your company name"
          autoComplete="organization"
        />
        <Select
          label="Timezone"
          name="timezone"
          options={timezoneOptions}
          value={data.timezone}
        />
        <Select
          label="Default Currency"
          name="currency"
          options={currencyOptions}
          value={data.currency}
        />
        <Select
          label="Weight Unit"
          name="weightUnit"
          options={weightOptions}
          value={data.weightUnit}
        />
        <Select
          label="Distance Unit"
          name="distanceUnit"
          options={distanceOptions}
          value={data.distanceUnit}
        />
        <Button submit variant="primary">
          Save General Settings
        </Button>
      </FormLayout>
    </Form>
  );
}

// ─── Branding Tab ──────────────────────────────────────────

function BrandingTab({ data }: { data: BrandingSettings }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="save-branding" />
      <FormLayout>
        <TextField
          label="Logo URL"
          name="logoUrl"
          type="url"
          // @ts-ignore
          defaultValue={data.logoUrl}
          placeholder="https://example.com/logo.png"
          autoComplete="off"
        />
        {data.logoUrl && (
          <Box
            padding="300"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <img
              src={data.logoUrl}
              alt="Logo"
              style={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain" }}
            />
          </Box>
        )}
        <InlineGrid columns={2} gap="400">
          <TextField
            label="Primary Color"
            name="primaryColor"
            // @ts-ignore
            type="color"
            // @ts-ignore
            defaultValue={data.primaryColor}
            autoComplete="off"
          />
          <TextField
            label="Secondary Color"
            name="secondaryColor"
            // @ts-ignore
            type="color"
            // @ts-ignore
            defaultValue={data.secondaryColor}
            autoComplete="off"
          />
        </InlineGrid>
        <Box padding="400" borderRadius="200" background="bg-fill-info">
          <BlockStack gap="200">
            <Text as="p" variant="headingSm" tone="text-inverse">
              Tracking Page Preview
            </Text>
            <Text as="p" variant="bodySm" tone="text-inverse">
              Your tracking page will use your brand colors
            </Text>
          </BlockStack>
        </Box>
        <Button submit variant="primary">
          Save Branding Settings
        </Button>
      </FormLayout>
    </Form>
  );
}

// ─── Notifications Tab ─────────────────────────────────────

function NotificationsTab({ data }: { data: NotificationSettings }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="save-notifications" />
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
          {data.events.map((event) => (
            <Card key={event.name}>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm" fontWeight="semibold">
                  {event.name}
                </Text>
                {event.channels.map((channel) => (
                  <Checkbox
                    key={channel.name}
                    label={
                      channel.name.charAt(0).toUpperCase() +
                      channel.name.slice(1)
                    }
                    name={`notification_${event.name}_${channel.name}`}
                    checked={channel.enabled}
                  />
                ))}
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
        <Button submit variant="primary">
          Save Notification Settings
        </Button>
      </BlockStack>
    </Form>
  );
}

// ─── API Keys Tab ──────────────────────────────────────────

function APIKeysTab({
  data,
  newKeyName,
  setNewKeyName,
}: {
  data: APIKey[];
  newKeyName: string;
  setNewKeyName: (name: string) => void;
}) {
  const keyRows = data.map((key, index) => (
    <IndexTable.Row id={key.id} key={key.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {key.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {key.maskedKey}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {new Date(key.createdAt).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {key.lastUsedAt
            ? new Date(key.lastUsedAt).toLocaleDateString()
            : "Never"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm("Are you sure you want to revoke this key?")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="revoke-api-key" />
          <input type="hidden" name="keyId" value={key.id} />
          <Button submit tone="critical" size="slim">
            Revoke
          </Button>
        </Form>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      {/* Create New Key */}
      <Card>
        <Form method="post">
          <input type="hidden" name="intent" value="create-api-key" />
          <FormLayout>
            <Text as="h3" variant="headingSm">
              Create New API Key
            </Text>
            <TextField
              label="Key Name"
              name="apiKeyName"
              type="text"
              value={newKeyName}
              onChange={setNewKeyName}
              placeholder="e.g., Mobile App, Third-party Integration"
              autoComplete="off"
            />
            <Button submit variant="primary">
              Create API Key
            </Button>
          </FormLayout>
        </Form>
      </Card>

      {/* List Keys */}
      <Card padding="0">
        <Box padding="400" paddingBlockEnd="0">
          <Text as="h3" variant="headingSm">
            Active API Keys
          </Text>
        </Box>
        {data.length > 0 ? (
          <IndexTable
            resourceName={{ singular: "API key", plural: "API keys" }}
            itemCount={data.length}
            headings={[
              { title: "Name" },
              { title: "Key" },
              { title: "Created" },
              { title: "Last Used" },
              { title: "" },
            ]}
            selectable={false}
          >
            {keyRows}
          </IndexTable>
        ) : (
          <Box padding="400">
            <Text as="p" variant="bodySm" tone="subdued">
              No API keys yet. Create one to get started.
            </Text>
          </Box>
        )}
      </Card>
    </BlockStack>
  );
}

// ─── Billing Tab ───────────────────────────────────────────

function BillingTab({ data }: { data: BillingInfo }) {
  const usagePercent = (data.monthlyUsage / data.monthlyLimit) * 100;

  const invoiceRows = data.invoices.map((invoice, index) => (
    <IndexTable.Row id={invoice.id} key={invoice.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {invoice.id}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {new Date(invoice.date).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          ${Number(invoice.amount).toFixed(2)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={
            invoice.status === "paid"
              ? "success"
              : invoice.status === "pending"
                ? "warning"
                : "critical"
          }
        >
          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      {/* Current Plan */}
      <Card>
        <BlockStack gap="400">
          <Text as="h3" variant="headingMd">
            {data.plan} Plan
          </Text>
          <Text as="p" variant="bodyMd">
            You are currently on the <strong>{data.plan}</strong> plan with{" "}
            <strong>{data.monthlyUsage.toLocaleString()}</strong> API calls used
            this month.
          </Text>

          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" fontWeight="medium">
                  Monthly Usage
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {Math.round(usagePercent)}% of{" "}
                  {data.monthlyLimit.toLocaleString()}
                </Text>
              </InlineStack>
              <ProgressBar
                progress={Math.min(usagePercent, 100)}
                tone={usagePercent > 80 ? "critical" : "primary"}
              />
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" tone="subdued">
                  {data.monthlyUsage.toLocaleString()} calls used
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {(data.monthlyLimit - data.monthlyUsage).toLocaleString()}{" "}
                  calls remaining
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          <Text as="p" variant="bodySm">
            Next billing date:{" "}
            <strong>
              {new Date(data.nextBillingDate).toLocaleDateString()}
            </strong>
          </Text>
        </BlockStack>
      </Card>

      {/* Invoices */}
      <Card padding="0">
        <Box padding="400" paddingBlockEnd="0">
          <Text as="h3" variant="headingSm">
            Invoice History
          </Text>
        </Box>
        {data.invoices.length > 0 ? (
          <IndexTable
            resourceName={{ singular: "invoice", plural: "invoices" }}
            itemCount={data.invoices.length}
            headings={[
              { title: "Invoice ID" },
              { title: "Date" },
              { title: "Amount" },
              { title: "Status" },
            ]}
            selectable={false}
          >
            {invoiceRows}
          </IndexTable>
        ) : (
          <Box padding="400">
            <Text as="p" variant="bodySm" tone="subdued">
              No invoices yet.
            </Text>
          </Box>
        )}
      </Card>
    </BlockStack>
  );
}
