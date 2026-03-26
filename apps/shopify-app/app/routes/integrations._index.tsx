/**
 * Integrations Marketplace Page — Browse, install, configure, and manage integrations.
 *
 * Features:
 *   Marketplace View:
 *     - Category tabs (Communication, Routing, Order Management, Inventory, Payment, Analytics)
 *     - Provider cards with status badges (Available, Coming Soon, Beta, Installed)
 *     - Search/filter across all categories
 *
 *   Installed View:
 *     - List of installed integrations with health status
 *     - Quick actions: configure, test, disable, uninstall
 *
 *   Install Flow:
 *     - Expand provider card → shows credential form generated from registry metadata
 *     - Submit installs the integration via POST /api/v4/integrations/:slug/install
 *
 *   Configuration:
 *     - Update credentials via PATCH /api/v4/integrations/:slug
 *     - Test connectivity via POST /api/v4/integrations/:slug/test
 *     - Uninstall via DELETE /api/v4/integrations/:slug
 *
 * Uses React Router v7 loader/action pattern with createApiClient.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation } from "react-router";
import { useState, useMemo } from "react";
import { createApiClient, type SingleResponse } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url" | "textarea";
  required: boolean;
  helpUrl?: string;
}

interface MarketplaceApp {
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  subcategory?: string;
  logoUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  authType: string;
  credentialFields: CredentialField[];
  capabilities: string[];
  status: string;
  isBuiltIn: boolean;
  version: string;
}

interface InstalledIntegration {
  id: string;
  appSlug: string;
  isEnabled: boolean;
  healthStatus: string;
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  installedAt: string;
  credentialsMasked: Record<string, string>;
  config: Record<string, unknown>;
}

interface IntegrationsPageData {
  marketplace: MarketplaceApp[];
  installed: InstalledIntegration[];
}

type CategoryKey =
  | "ALL"
  | "COMMUNICATION"
  | "ROUTING"
  | "ORDER_MANAGEMENT"
  | "INVENTORY"
  | "PAYMENT"
  | "ANALYTICS";

const CATEGORY_TABS: { key: CategoryKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "COMMUNICATION", label: "Communication" },
  { key: "ROUTING", label: "Routing" },
  { key: "ORDER_MANAGEMENT", label: "Orders" },
  { key: "INVENTORY", label: "Inventory" },
  { key: "PAYMENT", label: "Payment" },
  { key: "ANALYTICS", label: "Analytics" },
];

const HEALTH_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  HEALTHY: { label: "Healthy", color: "#008060", bg: "#d4f3e6" },
  DEGRADED: { label: "Degraded", color: "#7a4c00", bg: "#fff3cd" },
  ERROR: { label: "Error", color: "#d72c0d", bg: "#fee2e2" },
  UNKNOWN: { label: "Unknown", color: "#6d7175", bg: "#e4e5e7" },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  AVAILABLE: { label: "Available", color: "#008060", bg: "#d4f3e6" },
  COMING_SOON: { label: "Coming Soon", color: "#6d7175", bg: "#e4e5e7" },
  BETA: { label: "Beta", color: "#5c3da4", bg: "#ede8fa" },
  DEPRECATED: { label: "Deprecated", color: "#d72c0d", bg: "#fee2e2" },
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);

  const [marketplaceRes, installedRes] = await Promise.allSettled([
    api.get<SingleResponse<MarketplaceApp[]>>("/api/v4/integrations/marketplace"),
    api.get<SingleResponse<InstalledIntegration[]>>("/api/v4/integrations"),
  ]);

  const marketplace =
    marketplaceRes.status === "fulfilled"
      ? marketplaceRes.value.data
      : [];

  const installed =
    installedRes.status === "fulfilled"
      ? installedRes.value.data
      : [];

  return { marketplace, installed };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClient(session.accessToken!);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "install") {
    const slug = formData.get("slug") as string;

    // Collect credential fields from form
    const credentials: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("cred_") && typeof value === "string" && value) {
        credentials[key.replace("cred_", "")] = value;
      }
    }

    // Collect config fields
    const config: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("config_") && typeof value === "string" && value) {
        config[key.replace("config_", "")] = value;
      }
    }

    try {
      await api.post(`/api/v4/integrations/${slug}/install`, {
        credentials,
        config,
      });
      return { success: true, message: `${slug} installed successfully`, slug };
    } catch (error: any) {
      return {
        error: error?.message ?? `Failed to install ${slug}`,
        slug,
      };
    }
  }

  if (intent === "uninstall") {
    const slug = formData.get("slug") as string;

    try {
      await api.delete(`/api/v4/integrations/${slug}`);
      return { success: true, message: `${slug} uninstalled successfully`, slug };
    } catch (error: any) {
      return { error: error?.message ?? `Failed to uninstall ${slug}`, slug };
    }
  }

  if (intent === "update") {
    const slug = formData.get("slug") as string;

    const credentials: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("cred_") && typeof value === "string" && value) {
        credentials[key.replace("cred_", "")] = value;
      }
    }

    const isEnabled = formData.get("isEnabled");

    try {
      await api.patch(`/api/v4/integrations/${slug}`, {
        ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
        ...(isEnabled !== null ? { isEnabled: isEnabled === "true" } : {}),
      });
      return { success: true, message: `${slug} updated successfully`, slug };
    } catch (error: any) {
      return { error: error?.message ?? `Failed to update ${slug}`, slug };
    }
  }

  if (intent === "test") {
    const slug = formData.get("slug") as string;

    try {
      const result = await api.post<SingleResponse<{ healthy: boolean; message?: string }>>(
        `/api/v4/integrations/${slug}/test`,
      );
      const healthy = result.data.healthy;
      return {
        success: true,
        message: healthy
          ? `${slug} connection test passed`
          : `${slug} connection test failed: ${result.data.message ?? "unknown error"}`,
        slug,
      };
    } catch (error: any) {
      return { error: error?.message ?? `Failed to test ${slug}`, slug };
    }
  }

  return { error: "Unknown action" };
}

// ─── Component ─────────────────────────────────────────────

export default function Integrations() {
  const { marketplace, installed } = useLoaderData<IntegrationsPageData>();
  const actionData = useActionData<{
    success?: boolean;
    error?: string;
    message?: string;
    slug?: string;
  }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // View: "marketplace" or "installed"
  const [view, setView] = useState<"marketplace" | "installed">("marketplace");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);

  // Build a Set of installed slugs for quick lookup
  const installedSlugs = useMemo(
    () => new Set(installed.map((i) => i.appSlug)),
    [installed],
  );

  // Filter marketplace by category and search
  const filteredApps = useMemo(() => {
    return marketplace.filter((app) => {
      if (activeCategory !== "ALL" && app.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.slug.toLowerCase().includes(q) ||
          (app.subcategory ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [marketplace, activeCategory, searchQuery]);

  // Get marketplace metadata for an installed integration
  function getAppMeta(slug: string): MarketplaceApp | undefined {
    return marketplace.find((a) => a.slug === slug);
  }

  return (
    <div style={containerStyle}>
      {/* Page Header */}
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={headingStyle}>Integrations</h1>
          <p style={subtextStyle}>
            Connect third-party services to extend your delivery platform
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={countBadgeStyle}>
            {installed.length} installed
          </span>
          <span style={{ ...countBadgeStyle, backgroundColor: "#f1f2f3", color: "#6d7175" }}>
            {marketplace.length} available
          </span>
        </div>
      </div>

      {/* Global action feedback */}
      {actionData?.error && (
        <div style={errorBannerStyle}>{actionData.error}</div>
      )}
      {actionData?.success && (
        <div style={successBannerStyle}>{actionData.message}</div>
      )}

      {/* View Toggle */}
      <div style={viewToggleContainerStyle}>
        <button
          onClick={() => setView("marketplace")}
          style={{
            ...viewToggleButtonStyle,
            ...(view === "marketplace" ? viewToggleActiveStyle : {}),
          }}
        >
          Marketplace
        </button>
        <button
          onClick={() => setView("installed")}
          style={{
            ...viewToggleButtonStyle,
            ...(view === "installed" ? viewToggleActiveStyle : {}),
          }}
        >
          Installed ({installed.length})
        </button>
      </div>

      {/* ═══════ Marketplace View ═══════ */}
      {view === "marketplace" && (
        <>
          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </div>

          {/* Category Tabs */}
          <div style={categoryTabsContainerStyle}>
            {CATEGORY_TABS.map(({ key, label }) => {
              const count =
                key === "ALL"
                  ? marketplace.length
                  : marketplace.filter((a) => a.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  style={{
                    ...categoryTabStyle,
                    ...(activeCategory === key ? categoryTabActiveStyle : {}),
                  }}
                >
                  {label}
                  <span style={categoryCountStyle}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Provider Grid */}
          {filteredApps.length === 0 ? (
            <div style={emptyStateStyle}>
              <p style={{ margin: 0, color: "var(--p-color-text-subdued)" }}>
                No integrations found
                {searchQuery ? ` matching "${searchQuery}"` : " in this category"}.
              </p>
            </div>
          ) : (
            <div style={providerGridStyle}>
              {filteredApps.map((app) => {
                const isInstalled = installedSlugs.has(app.slug);
                const isExpanded = expandedSlug === app.slug;
                const installedData = installed.find((i) => i.appSlug === app.slug);
                const statusInfo = STATUS_LABELS[app.status] ?? STATUS_LABELS.AVAILABLE;

                return (
                  <div key={app.slug} style={{ gridColumn: isExpanded ? "1 / -1" : undefined }}>
                    <div
                      style={{
                        ...providerCardStyle,
                        ...(isExpanded ? providerCardExpandedStyle : {}),
                        ...(isInstalled ? providerCardInstalledStyle : {}),
                        ...(app.status === "COMING_SOON" ? providerCardDisabledStyle : {}),
                      }}
                    >
                      {/* Card Header */}
                      <button
                        type="button"
                        onClick={() => {
                          if (app.status !== "COMING_SOON") {
                            setExpandedSlug(isExpanded ? null : app.slug);
                            setConfirmUninstall(null);
                          }
                        }}
                        style={providerCardClickableStyle}
                        disabled={app.status === "COMING_SOON"}
                      >
                        <div style={providerCardHeaderStyle}>
                          <span style={providerCardNameStyle}>{app.name}</span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {isInstalled && (
                              <span style={installedBadgeStyle}>Installed</span>
                            )}
                            {app.status !== "AVAILABLE" && (
                              <span
                                style={{
                                  ...statusBadgeStyle,
                                  color: statusInfo.color,
                                  backgroundColor: statusInfo.bg,
                                }}
                              >
                                {statusInfo.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <p style={providerCardDescriptionStyle}>{app.description}</p>

                        {/* Capabilities */}
                        {app.capabilities.length > 0 && (
                          <div style={capabilitiesRowStyle}>
                            {app.capabilities.slice(0, 4).map((cap) => (
                              <span key={cap} style={capBadgeStyle}>
                                {cap}
                              </span>
                            ))}
                            {app.capabilities.length > 4 && (
                              <span style={capBadgeStyle}>
                                +{app.capabilities.length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Category + subcategory tag */}
                        <div style={{ marginTop: 8 }}>
                          <span style={categoryBadgeStyle}>
                            {app.category.replace("_", " ")}
                            {app.subcategory ? ` / ${app.subcategory}` : ""}
                          </span>
                        </div>
                      </button>

                      {/* Expanded: Install / Configure Panel */}
                      {isExpanded && (
                        <div style={expandedPanelStyle}>
                          {app.longDescription && (
                            <p style={{ ...subtextStyle, marginBottom: 16 }}>
                              {app.longDescription}
                            </p>
                          )}

                          {/* Links */}
                          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                            {app.websiteUrl && (
                              <a
                                href={app.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={linkStyle}
                              >
                                Website
                              </a>
                            )}
                            {app.docsUrl && (
                              <a
                                href={app.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={linkStyle}
                              >
                                Documentation
                              </a>
                            )}
                          </div>

                          {/* Already installed: show config + actions */}
                          {isInstalled && installedData ? (
                            <InstalledPanel
                              app={app}
                              integration={installedData}
                              isSubmitting={isSubmitting}
                              confirmUninstall={confirmUninstall}
                              setConfirmUninstall={setConfirmUninstall}
                            />
                          ) : (
                            /* Not installed: show install form */
                            <InstallForm app={app} isSubmitting={isSubmitting} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ Installed View ═══════ */}
      {view === "installed" && (
        <>
          {installed.length === 0 ? (
            <div style={emptyStateStyle}>
              <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "var(--p-color-text)" }}>
                No integrations installed
              </p>
              <p style={{ margin: 0, color: "var(--p-color-text-subdued)" }}>
                Browse the marketplace to connect third-party services.
              </p>
              <button
                onClick={() => setView("marketplace")}
                style={{ ...primaryButtonStyle, marginTop: 16 }}
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {installed.map((integration) => {
                const app = getAppMeta(integration.appSlug);
                const health = HEALTH_LABELS[integration.healthStatus] ?? HEALTH_LABELS.UNKNOWN;
                const isExpanded = expandedSlug === integration.appSlug;

                return (
                  <div
                    key={integration.id}
                    style={{
                      ...installedCardStyle,
                      ...(isExpanded ? installedCardExpandedStyle : {}),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedSlug(isExpanded ? null : integration.appSlug);
                        setConfirmUninstall(null);
                      }}
                      style={installedCardClickableStyle}
                    >
                      <div style={installedCardRowStyle}>
                        <div>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--p-color-text)" }}>
                            {app?.name ?? integration.appSlug}
                          </span>
                          <span style={{ ...categoryBadgeStyle, marginLeft: 8 }}>
                            {app?.category.replace("_", " ") ?? "Unknown"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {!integration.isEnabled && (
                            <span style={{ ...statusBadgeStyle, color: "#6d7175", backgroundColor: "#e4e5e7" }}>
                              Disabled
                            </span>
                          )}
                          <span
                            style={{
                              ...statusBadgeStyle,
                              color: health.color,
                              backgroundColor: health.bg,
                            }}
                          >
                            {health.label}
                          </span>
                        </div>
                      </div>
                      <p style={{ ...providerCardDescriptionStyle, margin: "8px 0 0 0" }}>
                        {app?.description ?? ""}
                      </p>
                      {integration.lastSyncAt && (
                        <p style={{ ...helperTextStyle, marginTop: 4 }}>
                          Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                        </p>
                      )}
                    </button>

                    {isExpanded && app && (
                      <div style={expandedPanelStyle}>
                        <InstalledPanel
                          app={app}
                          integration={integration}
                          isSubmitting={isSubmitting}
                          confirmUninstall={confirmUninstall}
                          setConfirmUninstall={setConfirmUninstall}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────

function InstallForm({
  app,
  isSubmitting,
}: {
  app: MarketplaceApp;
  isSubmitting: boolean;
}) {
  return (
    <Form method="post" style={formStyle}>
      <input type="hidden" name="intent" value="install" />
      <input type="hidden" name="slug" value={app.slug} />

      <h4 style={sectionHeadingStyle}>Install {app.name}</h4>

      {app.authType === "NONE" ? (
        <p style={helperTextStyle}>
          This integration does not require any credentials.
        </p>
      ) : (
        <>
          {app.credentialFields.length > 0 && (
            <p style={{ ...helperTextStyle, marginBottom: 16 }}>
              Enter your credentials to connect {app.name}.
            </p>
          )}

          {app.credentialFields.map((field) => (
            <div key={field.key} style={formGroupStyle}>
              <label style={labelStyle} htmlFor={`cred_${field.key}`}>
                {field.label}
                {field.required && <span style={{ color: "#d72c0d" }}> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`cred_${field.key}`}
                  name={`cred_${field.key}`}
                  placeholder={field.placeholder}
                  required={field.required}
                  autoComplete="off"
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              ) : (
                <input
                  id={`cred_${field.key}`}
                  type={field.type}
                  name={`cred_${field.key}`}
                  placeholder={field.placeholder}
                  required={field.required}
                  autoComplete="off"
                  style={inputStyle}
                />
              )}
              {field.helpUrl && (
                <p style={helperTextStyle}>
                  Get your credentials from{" "}
                  <a
                    href={field.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                  >
                    {extractHostname(field.helpUrl)}
                  </a>
                </p>
              )}
            </div>
          ))}
        </>
      )}

      <div style={formFooterStyle}>
        <button
          type="submit"
          style={primaryButtonStyle}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Installing..." : "Install Integration"}
        </button>
      </div>
    </Form>
  );
}

function InstalledPanel({
  app,
  integration,
  isSubmitting,
  confirmUninstall,
  setConfirmUninstall,
}: {
  app: MarketplaceApp;
  integration: InstalledIntegration;
  isSubmitting: boolean;
  confirmUninstall: string | null;
  setConfirmUninstall: (slug: string | null) => void;
}) {
  const health = HEALTH_LABELS[integration.healthStatus] ?? HEALTH_LABELS.UNKNOWN;

  return (
    <div>
      {/* Health & Status Info */}
      <div style={{ marginBottom: 16 }}>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>Health</span>
          <span style={{ ...infoValueStyle, color: health.color }}>{health.label}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>Status</span>
          <span style={infoValueStyle}>
            {integration.isEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>Installed</span>
          <span style={infoValueStyle}>
            {new Date(integration.installedAt).toLocaleDateString()}
          </span>
        </div>
        {integration.lastHealthCheckAt && (
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Last Health Check</span>
            <span style={infoValueStyle}>
              {new Date(integration.lastHealthCheckAt).toLocaleString()}
            </span>
          </div>
        )}

        {/* Masked credentials */}
        {Object.keys(integration.credentialsMasked).length > 0 && (
          <>
            <div style={sectionDividerStyle} />
            <h4 style={{ ...sectionHeadingStyle, fontSize: 14 }}>Current Credentials</h4>
            {Object.entries(integration.credentialsMasked).map(([key, masked]) => (
              <div key={key} style={infoRowStyle}>
                <span style={infoLabelStyle}>{key}</span>
                <span style={{ ...infoValueStyle, fontFamily: "monospace", fontSize: 13 }}>
                  {masked}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Update Credentials Form */}
      {app.credentialFields.length > 0 && (
        <Form method="post" style={{ ...formStyle, marginTop: 8 }}>
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="slug" value={app.slug} />

          <div style={sectionDividerStyle} />
          <h4 style={{ ...sectionHeadingStyle, fontSize: 14 }}>Update Credentials</h4>
          <p style={{ ...helperTextStyle, marginBottom: 12 }}>
            Leave fields blank to keep current values.
          </p>

          {app.credentialFields.map((field) => (
            <div key={field.key} style={formGroupStyle}>
              <label style={labelStyle} htmlFor={`upd_cred_${field.key}`}>
                {field.label}
              </label>
              <input
                id={`upd_cred_${field.key}`}
                type={field.type === "textarea" ? "text" : field.type}
                name={`cred_${field.key}`}
                placeholder={`New ${field.label.toLowerCase()} (leave blank to keep current)`}
                autoComplete="off"
                style={inputStyle}
              />
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={primaryButtonStyle} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Credentials"}
            </button>
          </div>
        </Form>
      )}

      {/* Action Buttons */}
      <div style={sectionDividerStyle} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* Test Connection */}
        <Form method="post" style={{ display: "inline" }}>
          <input type="hidden" name="intent" value="test" />
          <input type="hidden" name="slug" value={app.slug} />
          <button type="submit" style={secondaryButtonStyle} disabled={isSubmitting}>
            {isSubmitting ? "Testing..." : "Test Connection"}
          </button>
        </Form>

        {/* Toggle Enable/Disable */}
        <Form method="post" style={{ display: "inline" }}>
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="slug" value={app.slug} />
          <input
            type="hidden"
            name="isEnabled"
            value={integration.isEnabled ? "false" : "true"}
          />
          <button type="submit" style={secondaryButtonStyle} disabled={isSubmitting}>
            {integration.isEnabled ? "Disable" : "Enable"}
          </button>
        </Form>

        {/* Uninstall */}
        {confirmUninstall === app.slug ? (
          <Form method="post" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="uninstall" />
            <input type="hidden" name="slug" value={app.slug} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#d72c0d" }}>
                Are you sure?
              </span>
              <button type="submit" style={dangerButtonStyle} disabled={isSubmitting}>
                Confirm Uninstall
              </button>
              <button
                type="button"
                onClick={() => setConfirmUninstall(null)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </Form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmUninstall(app.slug)}
            style={dangerButtonStyle}
          >
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ─── Styles ────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "20px",
};

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "24px",
  paddingBottom: "16px",
  borderBottom: "1px solid var(--p-color-border)",
};

const headingStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "600",
  margin: "0 0 8px 0",
  color: "var(--p-color-text)",
};

const subtextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--p-color-text-subdued)",
  margin: 0,
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  padding: "4px 10px",
  borderRadius: "12px",
  backgroundColor: "#d4f3e6",
  color: "#008060",
};

const errorBannerStyle: React.CSSProperties = {
  color: "#dc2626",
  fontSize: "14px",
  padding: "12px 16px",
  backgroundColor: "#fee2e2",
  borderRadius: "6px",
  marginBottom: "16px",
  border: "1px solid #fecaca",
};

const successBannerStyle: React.CSSProperties = {
  color: "#166534",
  fontSize: "14px",
  padding: "12px 16px",
  backgroundColor: "#dcfce7",
  borderRadius: "6px",
  marginBottom: "16px",
  border: "1px solid #bbf7d0",
};

const viewToggleContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  marginBottom: "20px",
  backgroundColor: "#f1f2f3",
  borderRadius: "8px",
  padding: "4px",
  width: "fit-content",
};

const viewToggleButtonStyle: React.CSSProperties = {
  padding: "8px 20px",
  backgroundColor: "transparent",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "600",
  color: "var(--p-color-text-subdued)",
  cursor: "pointer",
  transition: "all 0.2s",
  fontFamily: "inherit",
};

const viewToggleActiveStyle: React.CSSProperties = {
  backgroundColor: "white",
  color: "var(--p-color-text)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--p-color-border)",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const categoryTabsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const categoryTabStyle: React.CSSProperties = {
  padding: "6px 14px",
  backgroundColor: "var(--p-color-bg-surface)",
  border: "1px solid var(--p-color-border)",
  borderRadius: "16px",
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--p-color-text-subdued)",
  cursor: "pointer",
  transition: "all 0.2s",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const categoryTabActiveStyle: React.CSSProperties = {
  backgroundColor: "var(--p-color-bg-interactive, #2c6ecb)",
  color: "white",
  borderColor: "var(--p-color-bg-interactive, #2c6ecb)",
};

const categoryCountStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  opacity: 0.7,
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 24px",
  backgroundColor: "var(--p-color-bg-surface)",
  borderRadius: "8px",
  border: "1px solid var(--p-color-border)",
};

const providerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "12px",
};

const providerCardStyle: React.CSSProperties = {
  border: "1px solid var(--p-color-border)",
  borderRadius: "8px",
  backgroundColor: "var(--p-color-bg-surface)",
  transition: "all 0.2s",
  overflow: "hidden",
};

const providerCardExpandedStyle: React.CSSProperties = {
  borderColor: "var(--p-color-bg-interactive, #2c6ecb)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const providerCardInstalledStyle: React.CSSProperties = {
  borderColor: "#008060",
  borderWidth: "1px",
};

const providerCardDisabledStyle: React.CSSProperties = {
  opacity: 0.55,
};

const providerCardClickableStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  backgroundColor: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

const providerCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const providerCardNameStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "700",
  color: "var(--p-color-text)",
};

const providerCardDescriptionStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--p-color-text-subdued)",
  margin: "0 0 8px 0",
  lineHeight: "1.4",
};

const installedBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "600",
  padding: "2px 6px",
  borderRadius: "4px",
  backgroundColor: "#d4f3e6",
  color: "#008060",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "600",
  padding: "2px 6px",
  borderRadius: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const capabilitiesRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  flexWrap: "wrap",
};

const capBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  padding: "2px 5px",
  borderRadius: "3px",
  backgroundColor: "#f1f2f3",
  color: "#6d7175",
};

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: "500",
  padding: "2px 6px",
  borderRadius: "3px",
  backgroundColor: "#eef0fb",
  color: "#5c3da4",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const expandedPanelStyle: React.CSSProperties = {
  padding: "0 16px 16px 16px",
  borderTop: "1px solid var(--p-color-border)",
  marginTop: 0,
  paddingTop: 16,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: "600",
  marginBottom: "6px",
  color: "var(--p-color-text)",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--p-color-text-subdued)",
  marginTop: "4px",
  margin: "4px 0 0 0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--p-color-border)",
  borderRadius: "4px",
  fontSize: "13px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const sectionDividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: "var(--p-color-border)",
  margin: "16px 0",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 12px 0",
  color: "var(--p-color-text)",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "var(--p-color-bg-interactive)",
  color: "white",
  border: "none",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background-color 0.2s",
  width: "fit-content",
  fontFamily: "inherit",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "white",
  color: "var(--p-color-text)",
  border: "1px solid var(--p-color-border)",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  width: "fit-content",
  fontFamily: "inherit",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "white",
  color: "#d72c0d",
  border: "1px solid #d72c0d",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  width: "fit-content",
  fontFamily: "inherit",
};

const formFooterStyle: React.CSSProperties = {
  marginTop: "16px",
  paddingTop: "12px",
  borderTop: "1px solid var(--p-color-border)",
};

const linkStyle: React.CSSProperties = {
  color: "var(--p-color-text-interactive)",
  fontSize: "13px",
  textDecoration: "none",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid var(--p-color-border-secondary, #f1f2f3)",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--p-color-text-subdued)",
};

const infoValueStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: "600",
  color: "var(--p-color-text)",
};

// ─── Installed View Card Styles ──────────────────────────────

const installedCardStyle: React.CSSProperties = {
  border: "1px solid var(--p-color-border)",
  borderRadius: "8px",
  backgroundColor: "var(--p-color-bg-surface)",
  overflow: "hidden",
  transition: "all 0.2s",
};

const installedCardExpandedStyle: React.CSSProperties = {
  borderColor: "var(--p-color-bg-interactive, #2c6ecb)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const installedCardClickableStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  backgroundColor: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

const installedCardRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
