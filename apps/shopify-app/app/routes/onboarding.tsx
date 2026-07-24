import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useState } from "react";
import {
  Page,
  Card,
  Layout,
  Text,
  Banner,
  Button,
  Form,
  FormLayout,
  TextField,
} from "@shopify/polaris";
import { createApiClientFromRequest } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

interface OnboardingStep {
  id: number;
  title: string;
  status: "completed" | "current" | "pending";
}

interface DeliveryZone {
  id: string;
  name: string;
  geofence: {
    radius: number;
    unit: "km" | "miles";
  };
  deliveryFee: number;
  currency: string;
}

interface OnboardingData {
  currentStep: number;
  completedSteps: number[];
  shopName: string;
  shopDomain: string;
  zones: DeliveryZone[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  if (!session || !session.accessToken) {
    return { error: "Not authenticated" };
  }

  const api = createApiClientFromRequest(request, session);

  try {
    const response = await api.get<{ data: OnboardingData }>(
      "/api/v4/shops/onboarding",
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch onboarding state:", error);
    return {
      currentStep: 1,
      completedSteps: [],
      shopName: "Your Store",
      shopDomain: "example.myshopify.com",
      zones: [],
    };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return { error: "Method not allowed" };
  }

  const { session } = await authenticate.admin(request);

  if (!session || !session.accessToken) {
    return { error: "Not authenticated" };
  }

  const api = createApiClientFromRequest(request, session);
  const formData = await request.formData();

  const action = formData.get("_action");
  const step = formData.get("step");

  try {
    if (action === "skip") {
      await api.post("/api/v4/shops/onboarding/skip", { step });
      return { status: "skipped" };
    } else if (action === "complete") {
      const data = Object.fromEntries(formData.entries());
      await api.post("/api/v4/shops/onboarding/save", data);
      return { status: "saved" };
    }
  } catch (error) {
    console.error("Onboarding action error:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const {
    currentStep = 1,
    completedSteps = [],
    shopName = "Your Store",
    shopDomain = "example.myshopify.com",
    zones = [],
  } = useLoaderData<OnboardingData>();

  const [activeStep, setActiveStep] = useState(currentStep);
  const [zones_state, setZones] = useState(zones);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneRadius, setNewZoneRadius] = useState("5");
  const [newZoneDeliveryFee, setNewZoneDeliveryFee] = useState("0");
  const [deliveryRules, setDeliveryRules] = useState({
    cutoffTime: "14:00",
    sameDayEnabled: true,
    nextDayEnabled: true,
  });
  const [carrierSelected, setCarrierSelected] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome",
      status:
        completedSteps.includes(1) || activeStep > 1
          ? "completed"
          : activeStep === 1
            ? "current"
            : "pending",
    },
    {
      id: 2,
      title: "Delivery Zones",
      status:
        completedSteps.includes(2) || activeStep > 2
          ? "completed"
          : activeStep === 2
            ? "current"
            : "pending",
    },
    {
      id: 3,
      title: "Delivery Rules",
      status:
        completedSteps.includes(3) || activeStep > 3
          ? "completed"
          : activeStep === 3
            ? "current"
            : "pending",
    },
    {
      id: 4,
      title: "Carrier Setup",
      status:
        completedSteps.includes(4) || activeStep > 4
          ? "completed"
          : activeStep === 4
            ? "current"
            : "pending",
    },
    {
      id: 5,
      title: "Tracking Page",
      status:
        completedSteps.includes(5) || activeStep > 5
          ? "completed"
          : activeStep === 5
            ? "current"
            : "pending",
    },
  ];

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;

    const zone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName,
      geofence: {
        radius: Number(newZoneRadius),
        unit: "km",
      },
      deliveryFee: Number(newZoneDeliveryFee),
      currency: "USD",
    };

    setZones([...zones_state, zone]);
    setNewZoneName("");
    setNewZoneRadius("5");
    setNewZoneDeliveryFee("0");
  };

  const handleRemoveZone = (id: string) => {
    setZones(zones_state.filter((z) => z.id !== id));
  };

  const handleNext = async () => {
    const formData = new FormData();
    formData.append("_action", "complete");
    formData.append("step", String(activeStep));

    if (activeStep === 2 && zones_state.length > 0) {
      formData.append("zones", JSON.stringify(zones_state));
    }
    if (activeStep === 3) {
      formData.append("deliveryRules", JSON.stringify(deliveryRules));
    }
    if (activeStep === 4) {
      formData.append("carrier", carrierSelected);
    }
    if (activeStep === 5) {
      formData.append("trackingEnabled", String(trackingEnabled));
    }

    fetcher.submit(formData, { method: "POST" });

    if (activeStep < 5) {
      setActiveStep(activeStep + 1);
    } else {
      navigate("/");
    }
  };

  const handleSkip = async () => {
    const formData = new FormData();
    formData.append("_action", "skip");
    formData.append("step", String(activeStep));

    fetcher.submit(formData, { method: "POST" });

    if (activeStep < 5) {
      setActiveStep(activeStep + 1);
    } else {
      navigate("/");
    }
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  return (
    <Page title="Setup Witylogix">
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "24px 32px" }}>
              <div style={{ marginBottom: "20px" }}>
                <Text variant="headingMd" as="h2">
                  Setup Progress
                </Text>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {steps.map((step, idx) => (
                  <div key={step.id} style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            step.status === "completed"
                              ? "var(--p-color-border-success)"
                              : step.status === "current"
                                ? "var(--p-color-bg-primary)"
                                : "var(--p-color-bg-surface)",
                          color:
                            step.status === "completed" ||
                            step.status === "current"
                              ? "white"
                              : "var(--p-color-text-subdued)",
                          fontSize: "14px",
                          fontWeight: "600",
                          marginBottom: "8px",
                        }}
                      >
                        {step.status === "completed" ? "✓" : step.id}
                      </div>
                      <Text as="span" variant="bodySm">
                        {step.title}
                      </Text>
                    </div>

                    {idx < steps.length - 1 && (
                      <div
                        style={{
                          width: "100%",
                          height: "2px",
                          backgroundColor: "var(--p-color-border)",
                          margin: "12px 0",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <p style={{ margin: 0, color: "var(--p-color-text-subdued)" }}>
                  Step {activeStep} of {steps.length}
                </p>
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {activeStep === 1 && (
            <StepWelcome shopName={shopName} shopDomain={shopDomain} />
          )}
          {activeStep === 2 && (
            <StepDeliveryZones
              zones={zones_state}
              newZoneName={newZoneName}
              newZoneRadius={newZoneRadius}
              newZoneDeliveryFee={newZoneDeliveryFee}
              onNewZoneNameChange={setNewZoneName}
              onNewZoneRadiusChange={setNewZoneRadius}
              onNewZoneDeliveryFeeChange={setNewZoneDeliveryFee}
              onAddZone={handleAddZone}
              onRemoveZone={handleRemoveZone}
            />
          )}
          {activeStep === 3 && (
            <StepDeliveryRules
              deliveryRules={deliveryRules}
              onDeliveryRulesChange={setDeliveryRules}
            />
          )}
          {activeStep === 4 && (
            <StepCarrierSetup
              carrierSelected={carrierSelected}
              onCarrierChange={setCarrierSelected}
            />
          )}
          {activeStep === 5 && (
            <StepTrackingPage
              trackingEnabled={trackingEnabled}
              onTrackingChange={setTrackingEnabled}
              shopDomain={shopDomain}
            />
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div
              style={{
                padding: "24px",
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              {activeStep > 1 && <Button onClick={handleBack}>Back</Button>}
              <div style={{ flex: 1 }} />
              <Button onClick={handleSkip} variant="plain">
                {activeStep === 5 ? "Go to Dashboard" : "Skip"}
              </Button>
              <Button
                variant="primary"
                onClick={handleNext}
                loading={fetcher.state === "submitting"}
              >
                {activeStep === 5 ? "Complete Setup" : "Next"}
              </Button>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StepWelcome({
  shopName,
  shopDomain,
}: {
  shopName: string;
  shopDomain: string;
}) {
  return (
    <Card>
      <div style={{ padding: "48px 32px", textAlign: "center" }}>
        <div style={{ marginBottom: "24px" }}>
          <svg
            style={{
              width: "48px",
              height: "48px",
              color: "var(--p-color-icon-success)",
            }}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <Text variant="headingXl" as="h1">
          Welcome to Witylogix!
        </Text>
        <p
          style={{
            marginTop: "12px",
            fontSize: "18px",
            color: "var(--p-color-text-subdued)",
          }}
        >
          Your store is connected and ready to go.
        </p>

        <div
          style={{
            backgroundColor: "var(--p-color-bg-surface)",
            padding: "20px",
            borderRadius: "8px",
            marginTop: "28px",
            textAlign: "left",
          }}
        >
          <Text variant="headingSm" as="h3">
            Store Information
          </Text>
          <div style={{ marginTop: "12px" }}>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>Store Name:</strong> {shopName}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Domain:</strong> {shopDomain}
            </p>
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <Banner tone="info" title="Next Steps">
            <Text as="p">
              In the following steps, you'll set up delivery zones, configure
              delivery rules, connect carriers, and enable customer tracking.
            </Text>
          </Banner>
        </div>
      </div>
    </Card>
  );
}

function StepDeliveryZones({
  zones,
  newZoneName,
  newZoneRadius,
  newZoneDeliveryFee,
  onNewZoneNameChange,
  onNewZoneRadiusChange,
  onNewZoneDeliveryFeeChange,
  onAddZone,
  onRemoveZone,
}: {
  zones: DeliveryZone[];
  newZoneName: string;
  newZoneRadius: string;
  newZoneDeliveryFee: string;
  onNewZoneNameChange: (v: string) => void;
  onNewZoneRadiusChange: (v: string) => void;
  onNewZoneDeliveryFeeChange: (v: string) => void;
  onAddZone: () => void;
  onRemoveZone: (id: string) => void;
}) {
  return (
    <Card>
      <div style={{ padding: "32px" }}>
        <Text variant="headingMd" as="h2">
          Delivery Zones
        </Text>

        <p
          style={{
            marginTop: "20px",
            marginBottom: "20px",
            color: "var(--p-color-text-subdued)",
          }}
        >
          Create zones to define service areas, set delivery fees, and manage
          coverage.
        </p>

        {zones.length > 0 && (
          <div style={{ marginBottom: "28px" }}>
            <Text variant="headingSm" as="h3">
              Active Zones ({zones.length})
            </Text>
            <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  style={{
                    backgroundColor: "var(--p-color-bg-surface)",
                    padding: "16px",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: "0 0 4px 0", fontWeight: "600" }}>
                      {zone.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--p-color-text-subdued)",
                        fontSize: "14px",
                      }}
                    >
                      {zone.geofence.radius}
                      {zone.geofence.unit} • $
                      {Number(zone.deliveryFee).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={() => onRemoveZone(zone.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: "var(--p-color-bg-surface)",
            padding: "20px",
            borderRadius: "6px",
          }}
        >
          <Text variant="headingSm" as="h3">
            Add Zone
          </Text>
          <Form onSubmit={(e: any) => e.preventDefault()}>
            <FormLayout>
              <TextField
                label="Zone Name"
                placeholder="e.g., Downtown, Suburbs"
                value={newZoneName}
                onChange={onNewZoneNameChange}
                autoComplete="off"
              />
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  Coverage Radius (km)
                </label>
                <input
                  type="text"
                  placeholder="5"
                  value={newZoneRadius}
                  onChange={(e) => onNewZoneRadiusChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid var(--p-color-border)",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  Delivery Fee ($)
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={newZoneDeliveryFee}
                  onChange={(e) => onNewZoneDeliveryFeeChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid var(--p-color-border)",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <Button onClick={onAddZone} variant="primary">
                Add Zone
              </Button>
            </FormLayout>
          </Form>
        </div>
      </div>
    </Card>
  );
}

function StepDeliveryRules({
  deliveryRules,
  onDeliveryRulesChange,
}: {
  deliveryRules: {
    cutoffTime: string;
    sameDayEnabled: boolean;
    nextDayEnabled: boolean;
  };
  onDeliveryRulesChange: (rules: any) => void;
}) {
  return (
    <Card>
      <div style={{ padding: "32px" }}>
        <Text variant="headingMd" as="h2">
          Delivery Rules
        </Text>

        <p
          style={{
            marginTop: "20px",
            marginBottom: "24px",
            color: "var(--p-color-text-subdued)",
          }}
        >
          Set cutoff times and define which delivery windows are available.
        </p>

        <Form onSubmit={(e: any) => e.preventDefault()}>
          <FormLayout>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Daily Order Cutoff Time
              </label>
              <input
                type="text"
                placeholder="14:00"
                value={deliveryRules.cutoffTime}
                onChange={(e) =>
                  onDeliveryRulesChange({
                    ...deliveryRules,
                    cutoffTime: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid var(--p-color-border)",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div style={{ marginTop: "12px", marginBottom: "12px" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={deliveryRules.sameDayEnabled}
                  onChange={(e) =>
                    onDeliveryRulesChange({
                      ...deliveryRules,
                      sameDayEnabled: e.target.checked,
                    })
                  }
                />
                <span>
                  Enable Same-Day Delivery (available only for orders before
                  cutoff time)
                </span>
              </label>
            </div>

            <div style={{ marginTop: "12px", marginBottom: "12px" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={deliveryRules.nextDayEnabled}
                  onChange={(e) =>
                    onDeliveryRulesChange({
                      ...deliveryRules,
                      nextDayEnabled: e.target.checked,
                    })
                  }
                />
                <span>Enable Next-Day Delivery</span>
              </label>
            </div>
          </FormLayout>
        </Form>

        <div style={{ marginTop: "24px" }}>
          <Banner tone="info" title="Delivery Rules Info">
            <Text as="p">
              You can adjust these settings later from Settings &gt; Delivery
              Rules.
            </Text>
          </Banner>
        </div>
      </div>
    </Card>
  );
}

function StepCarrierSetup({
  carrierSelected,
  onCarrierChange,
}: {
  carrierSelected: string;
  onCarrierChange: (carrier: string) => void;
}) {
  const carriers = [
    { label: "In-House Drivers", value: "in-house" },
    { label: "FedEx", value: "fedex" },
    { label: "UPS", value: "ups" },
    { label: "DHL", value: "dhl" },
    { label: "Third-Party Logistics", value: "3pl" },
  ];

  return (
    <Card>
      <div style={{ padding: "32px" }}>
        <Text variant="headingMd" as="h2">
          Carrier Setup
        </Text>

        <p
          style={{
            marginTop: "20px",
            marginBottom: "24px",
            color: "var(--p-color-text-subdued)",
          }}
        >
          Select your preferred carrier. You can add multiple carriers later.
        </p>

        <Form onSubmit={(e: any) => e.preventDefault()}>
          <FormLayout>
            <div>
              <Text variant="bodyMd" as="span">
                Primary Carrier
              </Text>
              {carriers.map((carrier) => (
                <label
                  key={carrier.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <input
                    type="radio"
                    name="primary-carrier"
                    value={carrier.value}
                    checked={carrierSelected === carrier.value}
                    onChange={() => onCarrierChange(carrier.value)}
                  />
                  <span>{carrier.label}</span>
                </label>
              ))}
            </div>

            {carrierSelected && (
              <TextField
                label={`${carriers.find((c) => c.value === carrierSelected)?.label} API Key`}
                placeholder="Paste your carrier API key (optional for now)"
                autoComplete="off"
              />
            )}
          </FormLayout>
        </Form>

        <div style={{ marginTop: "24px" }}>
          <Banner tone="info" title="Carrier Integration">
            <Text as="p">
              Carrier integration is optional during setup. You can enable it
              anytime from Settings &gt; Integrations.
            </Text>
          </Banner>
        </div>
      </div>
    </Card>
  );
}

function StepTrackingPage({
  trackingEnabled,
  onTrackingChange,
  shopDomain,
}: {
  trackingEnabled: boolean;
  onTrackingChange: (enabled: boolean) => void;
  shopDomain: string;
}) {
  const trackingUrl = `https://${shopDomain}/pages/witylogix-tracking`;

  return (
    <Card>
      <div style={{ padding: "32px" }}>
        <Text variant="headingMd" as="h2">
          Customer Tracking Page
        </Text>

        <p
          style={{
            marginTop: "20px",
            marginBottom: "24px",
            color: "var(--p-color-text-subdued)",
          }}
        >
          Enable a public tracking page so customers can see live delivery
          status, driver location, and estimated arrival time.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={trackingEnabled}
              onChange={(e) => onTrackingChange(e.target.checked)}
            />
            <span>Enable Public Tracking Page</span>
          </label>
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "var(--p-color-text-subdued)",
              margin: "8px 0 0 0",
            }}
          >
            Customers can access: /pages/witylogix-tracking?order=XXXXX
          </p>
        </div>

        {trackingEnabled && (
          <div
            style={{
              backgroundColor: "var(--p-color-bg-surface)",
              padding: "20px",
              borderRadius: "6px",
              marginTop: "20px",
            }}
          >
            <Text variant="headingSm" as="h3">
              Preview
            </Text>
            <p
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "var(--p-color-text-subdued)",
                margin: "8px 0 0 0",
              }}
            >
              Tracking URL:
            </p>
            <div
              style={{
                display: "block",
                padding: "8px",
                backgroundColor: "var(--p-color-bg)",
                borderRadius: "4px",
                marginTop: "4px",
                wordBreak: "break-all",
                fontSize: "12px",
              }}
            >
              {trackingUrl}
            </div>
          </div>
        )}

        <div style={{ marginTop: "24px" }}>
          <Banner tone="info" title="Tracking Customization">
            <Text as="p">
              Tracking page can be customized with your branding from Settings.
            </Text>
          </Banner>
        </div>
      </div>
    </Card>
  );
}
