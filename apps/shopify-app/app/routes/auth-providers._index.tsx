/**
 * Authentication Providers Configuration Page
 *
 * Features:
 * - Page title: "Authentication Providers"
 * - Banner explaining BYOK (Bring Your Own Key) auth concept
 * - ResourceList of 7 auth provider cards with:
 * - Provider name, description, status badge (Enabled/Disabled)
 * - "Configure" button to open provider-specific modal
 * - Modal with form fields based on provider type:
 * - Auth0: domain, clientId, clientSecret, audience
 * - Clerk: publishableKey, secretKey
 * - Cognito: userPoolId, clientId, region
 * - Firebase: projectId, apiKey
 * - OIDC: discoveryUrl, clientId, clientSecret, scopes
 * - SAML: entityId, ssoUrl, certificate
 * - "Test Connection" button in modal
 * - "Set as Default" action for each provider
 * - Toast notifications on save/test
 *
 * All data is mock (no real API calls)
 */
import { useState } from "react";
import {
  Page,
  Card,
  Button,
  Badge,
  Modal,
  TextField,
  Form,
  Banner,
  Toast,
  Frame,
  ResourceList,
  ResourceItem,
  InlineStack,
  BlockStack,
  Text,
  Select,
} from "@shopify/polaris";
// ─── Types ─────────────────────────────────────────────────
interface AuthProvider {
  id: string;
  name: string;
  type: "local" | "auth0" | "clerk" | "cognito" | "firebase" | "oidc" | "saml";
  description: string;
  enabled: boolean;
  isDefault: boolean;
  icon: string;
}
interface ProviderConfig {
  [key: string]: string | undefined;
}
// ─── Mock Data ─────────────────────────────────────────────
const MOCK_PROVIDERS: AuthProvider[] = [
  {
    id: "local",
    name: "Local",
    type: "local",
    description: "Store credentials in your Witylogix database",
    enabled: true,
    isDefault: true,
    icon: "🔐",
  },
  {
    id: "auth0",
    name: "Auth0",
    type: "auth0",
    description: "Enterprise-grade authentication platform",
    enabled: false,
    isDefault: false,
    icon: "🟣",
  },
  {
    id: "clerk",
    name: "Clerk",
    type: "clerk",
    description: "Modern auth platform with flexible pricing",
    enabled: false,
    isDefault: false,
    icon: "⚡",
  },
  {
    id: "cognito",
    name: "AWS Cognito",
    type: "cognito",
    description: "Amazon's user directory and authentication service",
    enabled: false,
    isDefault: false,
    icon: "☁️",
  },
  {
    id: "firebase",
    name: "Firebase Auth",
    type: "firebase",
    description: "Google's real-time database authentication",
    enabled: false,
    isDefault: false,
    icon: "🔥",
  },
  {
    id: "oidc",
    name: "Generic OIDC",
    type: "oidc",
    description: "Any OpenID Connect compliant provider",
    enabled: false,
    isDefault: false,
    icon: "🔑",
  },
  {
    id: "saml",
    name: "SAML 2.0",
    type: "saml",
    description: "Security Assertion Markup Language for SSO",
    enabled: false,
    isDefault: false,
    icon: "🛡️",
  },
];
// ─── Component ─────────────────────────────────────────────
export default function AuthProvidersIndex() {
  const [providers, setProviders] = useState<AuthProvider[]>(MOCK_PROVIDERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(
    null,
  );
  const [config, setConfig] = useState<ProviderConfig>({});
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [saving, setSaving] = useState(false);
  const handleConfigureClick = (provider: AuthProvider) => {
    setSelectedProvider(provider);
    setConfig({});
    setIsModalOpen(true);
  };
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedProvider(null);
    setConfig({});
  };
  const handleConfigChange = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };
  const handleTestConnection = async () => {
    setTestingConnection(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    showToast(`${selectedProvider?.name} connection test successful!`, false);
    setTestingConnection(false);
  };
  const handleSaveConfig = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (selectedProvider) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === selectedProvider.id ? { ...p, enabled: true } : p,
        ),
      );
    }
    showToast(`${selectedProvider?.name} configuration saved!`, false);
    setSaving(false);
    handleModalClose();
  };
  const handleSetAsDefault = (provider: AuthProvider) => {
    setProviders((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === provider.id,
      })),
    );
    showToast(
      `${provider.name} set as default authentication provider!`,
      false,
    );
  };
  const getModalTitle = (): string => {
    if (!selectedProvider) return "Configure Provider";
    const titleMap: Record<string, string> = {
      auth0: "Configure Auth0",
      clerk: "Configure Clerk",
      cognito: "Configure AWS Cognito",
      firebase: "Configure Firebase Auth",
      oidc: "Configure OIDC Provider",
      saml: "Configure SAML 2.0",
      local: "Configure Local Auth",
    };
    return titleMap[selectedProvider.type as any] || "Configure Provider";
  };
  const renderModalContent = () => {
    if (!selectedProvider) return null;
    const commonFields = () => (
      <>
        <TextField
          autoComplete="off"
          label="Configuration Name"
          value={config.name || ""}
          onChange={(value) => handleConfigChange("name", value)}
          placeholder="e.g., Production Auth0"
        />
      </>
    );
    switch (selectedProvider.type) {
      case "auth0":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="Domain"
              value={config.domain || ""}
              onChange={(value) => handleConfigChange("domain", value)}
              placeholder="your-domain.auth0.com"
              type="text"
            />
            <TextField
              autoComplete="off"
              label="Client ID"
              value={config.clientId || ""}
              onChange={(value) => handleConfigChange("clientId", value)}
              placeholder="Your Auth0 Client ID"
            />
            <TextField
              label="Client Secret"
              value={config.clientSecret || ""}
              onChange={(value) => handleConfigChange("clientSecret", value)}
              placeholder="Your Auth0 Client Secret"
              type="password"
              autoComplete="current-password"
            />
            <TextField
              autoComplete="off"
              label="API Audience"
              value={config.audience || ""}
              onChange={(value) => handleConfigChange("audience", value)}
              placeholder="https://api.your-domain.com"
            />
          </BlockStack>
        );
      case "clerk":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="Publishable Key"
              value={config.publishableKey || ""}
              onChange={(value) => handleConfigChange("publishableKey", value)}
              placeholder="pk_live_..."
            />
            <TextField
              label="Secret Key"
              value={config.secretKey || ""}
              onChange={(value) => handleConfigChange("secretKey", value)}
              placeholder="sk_live_..."
              type="password"
              autoComplete="current-password"
            />
          </BlockStack>
        );
      case "cognito":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="User Pool ID"
              value={config.userPoolId || ""}
              onChange={(value) => handleConfigChange("userPoolId", value)}
              placeholder="us-east-1_xxxxxxxxx"
            />
            <TextField
              autoComplete="off"
              label="Client ID"
              value={config.clientId || ""}
              onChange={(value) => handleConfigChange("clientId", value)}
              placeholder="Your Cognito Client ID"
            />
            <Select
              label="AWS Region"
              options={[
                { label: "US East (N. Virginia)", value: "us-east-1" },
                { label: "US West (Oregon)", value: "us-west-2" },
                { label: "EU (Ireland)", value: "eu-west-1" },
                { label: "AP (Singapore)", value: "ap-southeast-1" },
              ]}
              value={config.region || "us-east-1"}
              onChange={(value) => handleConfigChange("region", value)}
            />
          </BlockStack>
        );
      case "firebase":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="Project ID"
              value={config.projectId || ""}
              onChange={(value) => handleConfigChange("projectId", value)}
              placeholder="your-firebase-project"
            />
            <TextField
              autoComplete="off"
              label="API Key"
              value={config.apiKey || ""}
              onChange={(value) => handleConfigChange("apiKey", value)}
              placeholder="Your Firebase API Key"
              type="password"
            />
          </BlockStack>
        );
      case "oidc":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="Discovery URL"
              value={config.discoveryUrl || ""}
              onChange={(value) => handleConfigChange("discoveryUrl", value)}
              placeholder="https://auth.example.com/.well-known/openid-configuration"
            />
            <TextField
              autoComplete="off"
              label="Client ID"
              value={config.clientId || ""}
              onChange={(value) => handleConfigChange("clientId", value)}
              placeholder="Your OIDC Client ID"
            />
            <TextField
              label="Client Secret"
              value={config.clientSecret || ""}
              onChange={(value) => handleConfigChange("clientSecret", value)}
              placeholder="Your OIDC Client Secret"
              type="password"
              autoComplete="current-password"
            />
            <TextField
              autoComplete="off"
              label="Scopes"
              value={config.scopes || ""}
              onChange={(value) => handleConfigChange("scopes", value)}
              placeholder="openid profile email"
              helpText="Space-separated list of scopes"
            />
          </BlockStack>
        );
      case "saml":
        return (
          <BlockStack gap="400">
            {commonFields()}
            <TextField
              autoComplete="off"
              label="Entity ID"
              value={config.entityId || ""}
              onChange={(value) => handleConfigChange("entityId", value)}
              placeholder="https://your-domain.com/saml/metadata"
            />
            <TextField
              autoComplete="off"
              label="SSO URL"
              value={config.ssoUrl || ""}
              onChange={(value) => handleConfigChange("ssoUrl", value)}
              placeholder="https://idp.example.com/sso"
            />
            <TextField
              autoComplete="off"
              label="Certificate"
              value={config.certificate || ""}
              onChange={(value) => handleConfigChange("certificate", value)}
              placeholder="Paste your SAML certificate here"
              multiline={3}
            />
          </BlockStack>
        );
      case "local":
      default:
        return (
          <BlockStack gap="400">
            <Banner tone="info">
              Local authentication is always enabled by default. Users can
              manage their own passwords through the Witylogix dashboard.
            </Banner>
          </BlockStack>
        );
    }
  };
  const resourceItems = providers.map((provider) => (
    <ResourceItem
      id={provider.id}
      key={provider.id}
      media={
        <div style={{ fontSize: "24px", marginTop: "4px" }}>
          {provider.icon}
        </div>
      }
      onClick={() => handleConfigureClick(provider)}
    >
      <InlineStack align="space-between" gap="400">
        <BlockStack gap="100">
          <Text as="h3" variant="bodyMd" fontWeight="bold">
            {provider.name}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {provider.description}
          </Text>
        </BlockStack>
        <InlineStack gap="200" align="end">
          <Badge tone={provider.enabled ? "success" : "attention"}>
            {provider.enabled ? "Enabled" : "Disabled"}
          </Badge>
          {provider.isDefault && <Badge tone="info">Default</Badge>}
        </InlineStack>
      </InlineStack>
    </ResourceItem>
  ));
  return (
    <Frame>
      <Page
        title="Authentication Providers"
        subtitle="Configure BYOK (Bring Your Own Key) authentication providers"
      >
        <BlockStack gap="400">
          <Banner tone="info">
            Bring Your Own Key (BYOK) authentication allows you to use your own
            identity provider for user authentication. Configure providers below
            and set one as your default authentication method.
          </Banner>
          <Card>
            <ResourceList
              resourceName={{ singular: "provider", plural: "providers" }}
              items={resourceItems}
              renderItem={(item, index) => resourceItems[index as any]}
            />
          </Card>
        </BlockStack>
        <Modal
          open={isModalOpen}
          onClose={handleModalClose}
          title={getModalTitle()}
          primaryAction={{
            content: "Save Configuration",
            onAction: handleSaveConfig,
            loading: saving,
            disabled: selectedProvider?.type === "local",
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleModalClose,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {renderModalContent()}
              {selectedProvider && selectedProvider.type !== "local" && (
                <InlineStack gap="200">
                  <Button
                    onClick={handleTestConnection}
                    loading={testingConnection}
                    variant="secondary"
                  >
                    Test Connection
                  </Button>
                  {selectedProvider.enabled && !selectedProvider.isDefault && (
                    <Button
                      onClick={() => handleSetAsDefault(selectedProvider)}
                      variant="secondary"
                    >
                      Set as Default
                    </Button>
                  )}
                </InlineStack>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
      {toastActive && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastActive(false)}
          error={toastError}
        />
      )}
    </Frame>
  );
}
