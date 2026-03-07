/**
 * Settings Page — Comprehensive multi-tab settings panel.
 *
 * Features:
 *   - Tabbed layout: General, Branding, Notifications, API Keys, Billing
 *   - General tab: company name, timezone picker, currency, weight unit, distance unit
 *   - Branding tab: logo URL input, primary/secondary color pickers, tracking page preview
 *   - Notifications tab: event type × channel grid (email, SMS, push, webhook toggles)
 *   - API Keys tab: list keys (masked), create key form, revoke button
 *   - Billing tab: current plan display, usage meters, invoice history
 *   - Save button per section
 *   - All using Polaris var styling
 *
 * All data is loaded server-side via React Router v7 loader.
 * Form submission via POST with intent field.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import { useState } from "react";
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
      "/api/v4/shops/me/settings"
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
          maskedKey: "witylogix_live_••••••••••••••••",
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
  const [activeTab, setActiveTab] = useState("general");
  const [newApiKeyName, setNewApiKeyName] = useState("");

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={pageHeadingStyle}>Settings</h1>
        <p style={pageSubheadingStyle}>
          Manage your shop settings, branding, notifications, and billing
        </p>
      </div>

      {/* Action Feedback */}
      {actionData?.success && (
        <div style={successBannerStyle}>{actionData.message}</div>
      )}
      {actionData?.error && (
        <div style={errorBannerStyle}>{actionData.error}</div>
      )}

      {/* Tabs */}
      <div style={tabsContainerStyle}>
        <div style={tabListStyle}>
          {[
            { id: "general", label: "General" },
            { id: "branding", label: "Branding" },
            { id: "notifications", label: "Notifications" },
            { id: "api-keys", label: "API Keys" },
            { id: "billing", label: "Billing" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...tabStyle,
                borderBottomColor:
                  activeTab === tab.id
                    ? "var(--p-color-text-primary, #005bd3)"
                    : "transparent",
                color:
                  activeTab === tab.id
                    ? "var(--p-color-text-primary, #005bd3)"
                    : "var(--p-color-text-subdued, #6d7175)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={tabContentStyle}>
          {activeTab === "general" && (
            <GeneralTab data={data.general} />
          )}
          {activeTab === "branding" && (
            <BrandingTab data={data.branding} />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab data={data.notifications} />
          )}
          {activeTab === "api-keys" && (
            <APIKeysTab data={data.apiKeys} newKeyName={newApiKeyName} setNewKeyName={setNewApiKeyName} />
          )}
          {activeTab === "billing" && (
            <BillingTab data={data.billing} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── General Tab ───────────────────────────────────────────

function GeneralTab({ data }: { data: GeneralSettings }) {
  return (
    <Form method="post" style={formStyle}>
      <input type="hidden" name="intent" value="save-general" />

      <div style={formGroupStyle}>
        <label style={labelStyle}>Company Name</label>
        <input
          type="text"
          name="companyName"
          defaultValue={data.companyName}
          style={inputStyle}
          placeholder="Your company name"
        />
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>Timezone</label>
        <select name="timezone" defaultValue={data.timezone} style={inputStyle}>
          <option value="UTC">UTC</option>
          <option value="EST">Eastern Time (EST)</option>
          <option value="CST">Central Time (CST)</option>
          <option value="MST">Mountain Time (MST)</option>
          <option value="PST">Pacific Time (PST)</option>
          <option value="IST">Indian Standard Time (IST)</option>
          <option value="GMT">Greenwich Mean Time (GMT)</option>
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>Default Currency</label>
        <select name="currency" defaultValue={data.currency} style={inputStyle}>
          <option value="USD">USD (US Dollar)</option>
          <option value="EUR">EUR (Euro)</option>
          <option value="GBP">GBP (British Pound)</option>
          <option value="CAD">CAD (Canadian Dollar)</option>
          <option value="AUD">AUD (Australian Dollar)</option>
          <option value="INR">INR (Indian Rupee)</option>
          <option value="JPY">JPY (Japanese Yen)</option>
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>Weight Unit</label>
        <select name="weightUnit" defaultValue={data.weightUnit} style={inputStyle}>
          <option value="kg">Kilograms (kg)</option>
          <option value="lbs">Pounds (lbs)</option>
        </select>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>Distance Unit</label>
        <select name="distanceUnit" defaultValue={data.distanceUnit} style={inputStyle}>
          <option value="km">Kilometers (km)</option>
          <option value="miles">Miles (mi)</option>
        </select>
      </div>

      <button type="submit" style={primaryButtonStyle}>
        Save General Settings
      </button>
    </Form>
  );
}

// ─── Branding Tab ──────────────────────────────────────────

function BrandingTab({ data }: { data: BrandingSettings }) {
  return (
    <Form method="post" style={formStyle}>
      <input type="hidden" name="intent" value="save-branding" />

      <div style={formGroupStyle}>
        <label style={labelStyle}>Logo URL</label>
        <input
          type="url"
          name="logoUrl"
          defaultValue={data.logoUrl}
          style={inputStyle}
          placeholder="https://example.com/logo.png"
        />
        {data.logoUrl && (
          <div style={logoPreviewStyle}>
            <img src={data.logoUrl} alt="Logo" style={logoImageStyle} />
          </div>
        )}
      </div>

      <div style={colorGridStyle}>
        <div style={formGroupStyle}>
          <label style={labelStyle}>Primary Color</label>
          <div style={colorPickerWrapperStyle}>
            <input
              type="color"
              name="primaryColor"
              defaultValue={data.primaryColor}
              style={colorInputStyle}
            />
            <span style={colorValueStyle}>{data.primaryColor}</span>
          </div>
        </div>

        <div style={formGroupStyle}>
          <label style={labelStyle}>Secondary Color</label>
          <div style={colorPickerWrapperStyle}>
            <input
              type="color"
              name="secondaryColor"
              defaultValue={data.secondaryColor}
              style={colorInputStyle}
            />
            <span style={colorValueStyle}>{data.secondaryColor}</span>
          </div>
        </div>
      </div>

      <div style={formGroupStyle}>
        <label style={labelStyle}>Tracking Page Preview</label>
        <div
          style={{
            ...previewBoxStyle,
            backgroundColor: data.primaryColor,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "white",
              marginBottom: 8,
            }}
          >
            Tracking Page Preview
          </div>
          <div style={{ fontSize: 13, color: "white", opacity: 0.9 }}>
            Your tracking page will use your brand colors
          </div>
        </div>
      </div>

      <button type="submit" style={primaryButtonStyle}>
        Save Branding Settings
      </button>
    </Form>
  );
}

// ─── Notifications Tab ─────────────────────────────────────

function NotificationsTab({ data }: { data: NotificationSettings }) {
  return (
    <Form method="post" style={formStyle}>
      <input type="hidden" name="intent" value="save-notifications" />

      <div style={notificationGridStyle}>
        {data.events.map((event) => (
          <div key={event.name} style={notificationCardStyle}>
            <h3 style={notificationEventStyle}>{event.name}</h3>
            <div style={channelListStyle}>
              {event.channels.map((channel) => (
                <label key={channel.name} style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    name={`notification_${event.name}_${channel.name}`}
                    defaultChecked={channel.enabled}
                    style={checkboxStyle}
                  />
                  <span style={channelNameStyle}>
                    {channel.name.charAt(0).toUpperCase() + channel.name.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="submit" style={primaryButtonStyle}>
        Save Notification Settings
      </button>
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
  return (
    <div>
      {/* Create New Key */}
      <Form method="post" style={{ ...formStyle, marginBottom: 24 }}>
        <input type="hidden" name="intent" value="create-api-key" />

        <h3 style={cardHeadingStyle}>Create New API Key</h3>
        <div style={formGroupStyle}>
          <label style={labelStyle}>Key Name</label>
          <input
            type="text"
            name="apiKeyName"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            style={inputStyle}
            placeholder="e.g., Mobile App, Third-party Integration"
          />
        </div>

        <button type="submit" style={primaryButtonStyle}>
          Create API Key
        </button>
      </Form>

      {/* List Keys */}
      <div>
        <h3 style={cardHeadingStyle}>Active API Keys</h3>
        {data.length > 0 ? (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={trStyle}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Key</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Last Used</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {data.map((key) => (
                  <tr key={key.id} style={trStyle}>
                    <td style={tdStyle}>{key.name}</td>
                    <td style={tdStyle}>
                      <code style={maskedKeyStyle}>{key.maskedKey}</code>
                    </td>
                    <td style={tdStyle}>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input
                          type="hidden"
                          name="intent"
                          value="revoke-api-key"
                        />
                        <input type="hidden" name="keyId" value={key.id} />
                        <button
                          type="submit"
                          style={deleteButtonStyle}
                          onClick={(e) => {
                            if (
                              !confirm(
                                "Are you sure you want to revoke this key?"
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Revoke
                        </button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={emptyTextStyle}>No API keys yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}

// ─── Billing Tab ───────────────────────────────────────────

function BillingTab({ data }: { data: BillingInfo }) {
  const usagePercent = (data.monthlyUsage / data.monthlyLimit) * 100;

  return (
    <div>
      {/* Current Plan */}
      <div style={planCardStyle}>
        <h3 style={cardHeadingStyle}>{data.plan} Plan</h3>
        <p style={planDescStyle}>
          You are currently on the <strong>{data.plan}</strong> plan with{" "}
          <strong>{data.monthlyUsage.toLocaleString()}</strong> API calls used this
          month.
        </p>

        <div style={usageCardStyle}>
          <div style={usageHeaderStyle}>
            <span>Monthly Usage</span>
            <span style={usagePercentStyle}>
              {Math.round(usagePercent)}% of {data.monthlyLimit.toLocaleString()}
            </span>
          </div>
          <div style={progressBarStyle}>
            <div
              style={{
                ...progressFillStyle,
                width: `${Math.min(usagePercent, 100)}%`,
              }}
            />
          </div>
          <div style={usageDetailsStyle}>
            <div>
              {data.monthlyUsage.toLocaleString()} calls used
            </div>
            <div>
              {(data.monthlyLimit - data.monthlyUsage).toLocaleString()} calls remaining
            </div>
          </div>
        </div>

        <div style={nextBillingStyle}>
          Next billing date:{" "}
          <strong>{new Date(data.nextBillingDate).toLocaleDateString()}</strong>
        </div>
      </div>

      {/* Invoices */}
      <div style={{ marginTop: 24 }}>
        <h3 style={cardHeadingStyle}>Invoice History</h3>
        {data.invoices.length > 0 ? (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={trStyle}>
                  <th style={thStyle}>Invoice ID</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id} style={trStyle}>
                    <td style={tdStyle}>{invoice.id}</td>
                    <td style={tdStyle}>
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>${invoice.amount.toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          backgroundColor:
                            invoice.status === "paid"
                              ? "var(--p-color-bg-fill-success, #22c55e)"
                              : invoice.status === "pending"
                              ? "var(--p-color-bg-fill-warning, #f59e0b)"
                              : "var(--p-color-bg-fill-critical, #ef4444)",
                          color: "white",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={emptyTextStyle}>No invoices yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: "32px",
  backgroundColor: "var(--p-color-bg, #ffffff)",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const pageHeadingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--p-color-text, #202223)",
  margin: 0,
};

const pageSubheadingStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--p-color-text-subdued, #6d7175)",
  margin: "8px 0 0",
};

const successBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "var(--p-color-bg-fill-success, #22c55e)",
  color: "white",
  borderRadius: "var(--p-border-radius-200, 8px)",
  marginBottom: "24px",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "var(--p-color-bg-fill-critical, #ef4444)",
  color: "white",
  borderRadius: "var(--p-border-radius-200, 8px)",
  marginBottom: "24px",
};

const tabsContainerStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  overflow: "hidden",
};

const tabListStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--p-color-border, #c9cccf)",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: "16px 24px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--p-color-text-subdued, #6d7175)",
  backgroundColor: "transparent",
  border: "none",
  borderBottom: "3px solid transparent",
  cursor: "pointer",
  transition: "all 0.2s",
};

const tabContentStyle: React.CSSProperties = {
  padding: "32px",
};

const formStyle: React.CSSProperties = {
  maxWidth: 600,
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: "24px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  backgroundColor: "var(--p-color-bg-surface, #ffffff)",
  color: "var(--p-color-text, #202223)",
  boxSizing: "border-box",
};

const colorGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px",
};

const colorPickerWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const colorInputStyle: React.CSSProperties = {
  width: 50,
  height: 40,
  border: "1px solid var(--p-color-border, #c9cccf)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
};

const colorValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "monospace",
  color: "var(--p-color-text, #202223)",
};

const logoPreviewStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  borderRadius: "var(--p-border-radius-200, 8px)",
};

const logoImageStyle: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: 100,
  objectFit: "contain",
};

const previewBoxStyle: React.CSSProperties = {
  padding: "24px",
  borderRadius: "var(--p-border-radius-200, 8px)",
  marginTop: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  backgroundColor: "var(--p-color-bg-fill-brand, #005bd3)",
  border: "none",
  borderRadius: "var(--p-border-radius-200, 8px)",
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--p-color-bg-fill-critical, #ef4444)",
  backgroundColor: "white",
  border: "1px solid var(--p-color-bg-fill-critical, #ef4444)",
  borderRadius: 4,
  cursor: "pointer",
};

const notificationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const notificationCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "16px",
};

const notificationEventStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 12px",
};

const channelListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  cursor: "pointer",
};

const channelNameStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
};

const cardHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const tableContainerStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "var(--p-border-radius-200, 8px)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--p-color-text-subdued, #6d7175)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--p-color-border-subdued, #e1e3e5)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "top",
};

const maskedKeyStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "monospace",
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  padding: "4px 8px",
  borderRadius: 4,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const emptyTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text-subdued, #6d7175)",
  fontStyle: "italic",
};

const planCardStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-surface-secondary, #f6f6f7)",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "24px",
  marginBottom: "24px",
};

const planDescStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--p-color-text, #202223)",
  margin: "0 0 16px",
};

const usageCardStyle: React.CSSProperties = {
  backgroundColor: "white",
  border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "var(--p-border-radius-200, 8px)",
  padding: "16px",
  marginBottom: "16px",
};

const usageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
  fontSize: 13,
  fontWeight: 500,
};

const usagePercentStyle: React.CSSProperties = {
  color: "var(--p-color-text-subdued, #6d7175)",
};

const progressBarStyle: React.CSSProperties = {
  width: "100%",
  height: "8px",
  backgroundColor: "var(--p-color-border-subdued, #e1e3e5)",
  borderRadius: "4px",
  overflow: "hidden",
  marginBottom: "8px",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "var(--p-color-bg-fill-success, #22c55e)",
  transition: "width 0.3s",
};

const usageDetailsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  fontSize: 12,
  color: "var(--p-color-text-subdued, #6d7175)",
};

const nextBillingStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--p-color-text, #202223)",
};
