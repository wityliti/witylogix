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
 *     - Expand provider card -> shows credential form generated from registry metadata
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
import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
} from "react-router";
import { useState, useMemo, useCallback } from "react";
import {
  Page,
  Card,
  Badge,
  Button,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  TextField,
  FormLayout,
  ButtonGroup,
  EmptyState,
  Banner,
  Box,
  Collapsible,
  Divider,
  DescriptionList,
} from "@shopify/polaris";
import { createApiClientFromRequest } from "~/lib/api.server";
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
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string | null;
  logoUrl?: string | null;
  isEnabled: boolean;
  healthStatus: string;
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  installedAt: string;
  credentials: Record<string, string>;
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

const HEALTH_BADGE_TONE: Record<
  string,
  "success" | "warning" | "critical" | undefined
> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  ERROR: "critical",
  UNKNOWN: undefined,
};

const STATUS_BADGE_TONE: Record<
  string,
  "success" | "info" | "critical" | undefined
> = {
  AVAILABLE: "success",
  COMING_SOON: undefined,
  BETA: "info",
  DEPRECATED: "critical",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  COMING_SOON: "Coming Soon",
  BETA: "Beta",
  DEPRECATED: "Deprecated",
};

const HEALTH_LABELS: Record<string, string> = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  ERROR: "Error",
  UNKNOWN: "Unknown",
};

// ─── Loader ────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);

  const [marketplaceRes, installedRes] = await Promise.allSettled([
    api.get<{ apps: MarketplaceApp[] }>("/api/v4/integrations/marketplace"),
    api.get<{ integrations: InstalledIntegration[] }>("/api/v4/integrations"),
  ]);

  const marketplace =
    marketplaceRes.status === "fulfilled"
      ? (marketplaceRes.value.apps ?? [])
      : [];

  const installed =
    installedRes.status === "fulfilled"
      ? (installedRes.value.integrations ?? [])
      : [];

  return { marketplace, installed };
}

// ─── Action ────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const api = createApiClientFromRequest(request, session);
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
      return {
        success: true,
        message: `${slug} uninstalled successfully`,
        slug,
      };
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
      const result = await api.post<
        SingleResponse<{ healthy: boolean; message?: string }>
      >(`/api/v4/integrations/${slug}/test`);
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
    () => new Set(installed.map((i) => i.slug)),
    [installed],
  );

  // Filter marketplace by category and search
  const filteredApps = useMemo(() => {
    return marketplace.filter((app) => {
      if (activeCategory !== "ALL" && app.category !== activeCategory)
        return false;
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
    <Page
      title="Integrations"
      subtitle="Connect third-party services to extend your delivery platform"
    >
      <BlockStack gap="400">
        {/* Header badges */}
        <InlineStack gap="200">
          <Badge tone="success">{installed.length} installed</Badge>
          <Badge>{marketplace.length} available</Badge>
        </InlineStack>

        {/* Global action feedback */}
        {actionData?.error && (
          <Banner tone="critical">{actionData.error}</Banner>
        )}
        {actionData?.success && (
          <Banner tone="success">{actionData.message}</Banner>
        )}

        {/* View Toggle */}
        <ButtonGroup variant="segmented">
          <Button
            pressed={view === "marketplace"}
            onClick={() => setView("marketplace")}
          >
            Marketplace
          </Button>
          <Button
            pressed={view === "installed"}
            onClick={() => setView("installed")}
          >
            Installed ({installed.length})
          </Button>
        </ButtonGroup>

        {/* Marketplace View */}
        {view === "marketplace" && (
          <BlockStack gap="400">
            {/* Search */}
            <TextField
              label="Search"
              labelHidden
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={setSearchQuery}
              autoComplete="off"
            />

            {/* Category Tabs */}
            <InlineStack gap="200" wrap>
              {CATEGORY_TABS.map(({ key, label }) => {
                const count =
                  key === "ALL"
                    ? marketplace.length
                    : marketplace.filter((a) => a.category === key).length;
                return (
                  <Button
                    key={key}
                    pressed={activeCategory === key}
                    onClick={() => setActiveCategory(key)}
                    size="slim"
                  >
                    {label} ({count})
                  </Button>
                );
              })}
            </InlineStack>

            {/* Provider Grid */}
            {filteredApps.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No integrations found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    No integrations found
                    {searchQuery
                      ? ` matching "${searchQuery}"`
                      : " in this category"}
                    .
                  </p>
                </EmptyState>
              </Card>
            ) : (
              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                {filteredApps.map((app) => {
                  const isInstalled = installedSlugs.has(app.slug);
                  const isExpanded = expandedSlug === app.slug;
                  const installedData = installed.find(
                    (i) => i.slug === app.slug,
                  );

                  return (
                    <Card key={app.slug}>
                      <BlockStack gap="300">
                        {/* Card Header */}
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h3" variant="headingSm" fontWeight="bold">
                            {app.name}
                          </Text>
                          <InlineStack gap="100">
                            {isInstalled && (
                              <Badge tone="success">Installed</Badge>
                            )}
                            {app.status !== "AVAILABLE" && (
                              <Badge tone={STATUS_BADGE_TONE[app.status]}>
                                {STATUS_LABELS[app.status] ?? app.status}
                              </Badge>
                            )}
                          </InlineStack>
                        </InlineStack>

                        <Text as="p" variant="bodySm" tone="subdued">
                          {app.description}
                        </Text>

                        {/* Capabilities */}
                        {app.capabilities.length > 0 && (
                          <InlineStack gap="100" wrap>
                            {app.capabilities.slice(0, 4).map((cap) => (
                              <Badge key={cap}>{cap}</Badge>
                            ))}
                            {app.capabilities.length > 4 && (
                              <Badge>+{app.capabilities.length - 4}</Badge>
                            )}
                          </InlineStack>
                        )}

                        {/* Category tag */}
                        <Badge tone="info">
                          {app.category.replace("_", " ")}
                          {app.subcategory ? ` / ${app.subcategory}` : ""}
                        </Badge>

                        {/* Expand/Collapse */}
                        {app.status !== "COMING_SOON" && (
                          <Button
                            variant="plain"
                            onClick={() => {
                              setExpandedSlug(isExpanded ? null : app.slug);
                              setConfirmUninstall(null);
                            }}
                          >
                            {isExpanded ? "Collapse" : "Configure"}
                          </Button>
                        )}

                        {/* Expanded Panel */}
                        <Collapsible
                          open={isExpanded}
                          id={`expand-${app.slug}`}
                        >
                          <BlockStack gap="300">
                            <Divider />
                            {app.longDescription && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {app.longDescription}
                              </Text>
                            )}

                            {/* Links */}
                            <InlineStack gap="300">
                              {app.websiteUrl && (
                                <Button
                                  url={app.websiteUrl}
                                  external
                                  variant="plain"
                                  size="slim"
                                >
                                  Website
                                </Button>
                              )}
                              {app.docsUrl && (
                                <Button
                                  url={app.docsUrl}
                                  external
                                  variant="plain"
                                  size="slim"
                                >
                                  Documentation
                                </Button>
                              )}
                            </InlineStack>

                            {isInstalled && installedData ? (
                              <InstalledPanel
                                app={app}
                                integration={installedData}
                                isSubmitting={isSubmitting}
                                confirmUninstall={confirmUninstall}
                                setConfirmUninstall={setConfirmUninstall}
                              />
                            ) : (
                              <InstallForm
                                app={app}
                                isSubmitting={isSubmitting}
                              />
                            )}
                          </BlockStack>
                        </Collapsible>
                      </BlockStack>
                    </Card>
                  );
                })}
              </InlineGrid>
            )}
          </BlockStack>
        )}

        {/* Installed View */}
        {view === "installed" && (
          <BlockStack gap="400">
            {installed.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No integrations installed"
                  action={{
                    content: "Browse Marketplace",
                    onAction: () => setView("marketplace"),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Browse the marketplace to connect third-party services.</p>
                </EmptyState>
              </Card>
            ) : (
              installed.map((integration) => {
                const app = getAppMeta(integration.slug);
                const isExpanded = expandedSlug === integration.slug;

                return (
                  <Card key={integration.slug}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="h3" variant="headingSm" fontWeight="bold">
                            {app?.name ?? integration.slug}
                          </Text>
                          <Badge tone="info">
                            {app?.category.replace("_", " ") ?? "Unknown"}
                          </Badge>
                        </InlineStack>
                        <InlineStack gap="200">
                          {!integration.isEnabled && <Badge>Disabled</Badge>}
                          <Badge
                            tone={HEALTH_BADGE_TONE[integration.healthStatus]}
                          >
                            {HEALTH_LABELS[integration.healthStatus] ??
                              "Unknown"}
                          </Badge>
                        </InlineStack>
                      </InlineStack>

                      <Text as="p" variant="bodySm" tone="subdued">
                        {app?.description ?? ""}
                      </Text>

                      {integration.lastSyncAt && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          Last sync:{" "}
                          {new Date(integration.lastSyncAt).toLocaleString()}
                        </Text>
                      )}

                      <Button
                        variant="plain"
                        onClick={() => {
                          setExpandedSlug(isExpanded ? null : integration.slug);
                          setConfirmUninstall(null);
                        }}
                      >
                        {isExpanded ? "Collapse" : "Manage"}
                      </Button>

                      <Collapsible
                        open={isExpanded}
                        id={`installed-${integration.slug}`}
                      >
                        {app && (
                          <>
                            <Divider />
                            <Box paddingBlockStart="300">
                              <InstalledPanel
                                app={app}
                                integration={integration}
                                isSubmitting={isSubmitting}
                                confirmUninstall={confirmUninstall}
                                setConfirmUninstall={setConfirmUninstall}
                              />
                            </Box>
                          </>
                        )}
                      </Collapsible>
                    </BlockStack>
                  </Card>
                );
              })
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Page>
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
    <Form method="post">
      <input type="hidden" name="intent" value="install" />
      <input type="hidden" name="slug" value={app.slug} />

      <BlockStack gap="300">
        <Text as="h4" variant="headingSm">
          Install {app.name}
        </Text>

        {app.authType === "NONE" ? (
          <Text as="p" variant="bodySm" tone="subdued">
            This integration does not require any credentials.
          </Text>
        ) : (
          <FormLayout>
            {app.credentialFields.length > 0 && (
              <Text as="p" variant="bodySm" tone="subdued">
                Enter your credentials to connect {app.name}.
              </Text>
            )}

            {app.credentialFields.map((field) => (
              <BlockStack key={field.key} gap="100">
                <TextField
                  label={`${field.label}${field.required ? " *" : ""}`}
                  name={`cred_${field.key}`}
                  type={
                    field.type === "textarea"
                      ? "text"
                      : field.type === "password"
                        ? "password"
                        : "text"
                  }
                  placeholder={field.placeholder}
                  requiredIndicator={field.required}
                  autoComplete="off"
                  multiline={field.type === "textarea" ? 4 : undefined}
                />
                {field.helpUrl && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Get your credentials from{" "}
                    <a
                      href={field.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {extractHostname(field.helpUrl)}
                    </a>
                  </Text>
                )}
              </BlockStack>
            ))}
          </FormLayout>
        )}

        <Divider />
        <Button submit variant="primary" loading={isSubmitting}>
          {isSubmitting ? "Installing..." : "Install Integration"}
        </Button>
      </BlockStack>
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
  const infoItems = [
    {
      term: "Health",
      description: (
        <Badge tone={HEALTH_BADGE_TONE[integration.healthStatus]}>
          {HEALTH_LABELS[integration.healthStatus] ?? "Unknown"}
        </Badge>
      ),
    },
    {
      term: "Status",
      description: integration.isEnabled ? "Enabled" : "Disabled",
    },
    {
      term: "Installed",
      description: new Date(integration.installedAt).toLocaleDateString(),
    },
    ...(integration.lastHealthCheckAt
      ? [
          {
            term: "Last Health Check",
            description: new Date(
              integration.lastHealthCheckAt,
            ).toLocaleString(),
          },
        ]
      : []),
  ];

  return (
    <BlockStack gap="400">
      <DescriptionList items={infoItems} />

      {/* Masked credentials */}
      {Object.keys(integration.credentials ?? {}).length > 0 && (
        <>
          <Divider />
          <Text as="h4" variant="headingSm">
            Current Credentials
          </Text>
          <DescriptionList
            items={Object.entries(integration.credentials).map(
              ([key, masked]) => ({
                term: key,
                description: masked,
              }),
            )}
          />
        </>
      )}

      {/* Update Credentials Form */}
      {app.credentialFields.length > 0 && (
        <>
          <Divider />
          <Form method="post">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="slug" value={app.slug} />
            <BlockStack gap="300">
              <Text as="h4" variant="headingSm">
                Update Credentials
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Leave fields blank to keep current values.
              </Text>
              <FormLayout>
                {app.credentialFields.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    name={`cred_${field.key}`}
                    type={
                      field.type === "textarea"
                        ? "text"
                        : field.type === "password"
                          ? "password"
                          : "text"
                    }
                    placeholder={`New ${field.label.toLowerCase()} (leave blank to keep current)`}
                    autoComplete="off"
                  />
                ))}
              </FormLayout>
              <Button submit variant="primary" loading={isSubmitting}>
                {isSubmitting ? "Saving..." : "Update Credentials"}
              </Button>
            </BlockStack>
          </Form>
        </>
      )}

      {/* Action Buttons */}
      <Divider />
      <InlineStack gap="200" wrap>
        {/* Test Connection */}
        <Form method="post">
          <input type="hidden" name="intent" value="test" />
          <input type="hidden" name="slug" value={app.slug} />
          <Button submit disabled={isSubmitting}>
            {isSubmitting ? "Testing..." : "Test Connection"}
          </Button>
        </Form>

        {/* Toggle Enable/Disable */}
        <Form method="post">
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="slug" value={app.slug} />
          <input
            type="hidden"
            name="isEnabled"
            value={integration.isEnabled ? "false" : "true"}
          />
          <Button submit disabled={isSubmitting}>
            {integration.isEnabled ? "Disable" : "Enable"}
          </Button>
        </Form>

        {/* Uninstall */}
        {confirmUninstall === app.slug ? (
          <Form method="post">
            <input type="hidden" name="intent" value="uninstall" />
            <input type="hidden" name="slug" value={app.slug} />
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodySm" tone="critical">
                Are you sure?
              </Text>
              <Button submit tone="critical" disabled={isSubmitting}>
                Confirm Uninstall
              </Button>
              <Button onClick={() => setConfirmUninstall(null)}>Cancel</Button>
            </InlineStack>
          </Form>
        ) : (
          <Button tone="critical" onClick={() => setConfirmUninstall(app.slug)}>
            Uninstall
          </Button>
        )}
      </InlineStack>
    </BlockStack>
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
