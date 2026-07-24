"use client";

export interface Integration {
  name: string;
  description: string;
  logo: string;
  category:
    | "e-commerce"
    | "payments"
    | "communications"
    | "infrastructure"
    | "maps"
    | "automation"
    | "monitoring";
  docsUrl?: string;
  comingSoon?: boolean;
}

export const integrations: Integration[] = [
  // E-Commerce
  {
    name: "Shopify",
    description:
      "Sync orders, manage fulfillment, and automate delivery tracking for your Shopify store.",
    logo: "/logos/shopify.svg",
    category: "e-commerce",
    docsUrl: "/docs/guides/shopify-integration",
  },
  {
    name: "WooCommerce",
    description:
      "WordPress-native integration for order sync, shipping labels, and live tracking widgets.",
    logo: "/logos/woocommerce.svg",
    category: "e-commerce",
    docsUrl: "/docs/guides/woocommerce-integration",
  },
  {
    name: "Magento",
    description:
      "Adobe Commerce integration with bulk order processing and multi-warehouse support.",
    logo: "/logos/magento.png",
    category: "e-commerce",
    docsUrl: "/docs/guides/magento-integration",
  },
  {
    name: "BigCommerce",
    description:
      "Headless commerce integration with order routing and multi-storefront delivery.",
    logo: "/logos/bigcommerce.svg",
    category: "e-commerce",
    comingSoon: true,
  },
  // Payments
  {
    name: "Stripe",
    description:
      "Collect delivery fees, handle COD payments, and manage driver payouts seamlessly.",
    logo: "/logos/stripe.svg",
    category: "payments",
  },
  {
    name: "Razorpay",
    description:
      "Accept payments in India with UPI, cards, and net banking for delivery charges.",
    logo: "/logos/razorpay.svg",
    category: "payments",
  },
  {
    name: "PayPal",
    description:
      "Global payment processing for delivery charges, tips, and merchant payouts.",
    logo: "/logos/paypal.svg",
    category: "payments",
    comingSoon: true,
  },
  // Communications
  {
    name: "Twilio",
    description:
      "Send SMS and WhatsApp delivery notifications with real-time tracking links.",
    logo: "/logos/twilio.svg",
    category: "communications",
  },
  {
    name: "SendGrid",
    description:
      "Transactional emails for order confirmations, delivery updates, and proof-of-delivery.",
    logo: "/logos/sendgrid.svg",
    category: "communications",
  },
  {
    name: "Slack",
    description:
      "Get instant delivery alerts, failed attempt notifications, and daily summary reports.",
    logo: "/logos/slack.svg",
    category: "communications",
  },
  {
    name: "WhatsApp",
    description:
      "Direct WhatsApp Business messaging for delivery updates and customer communication.",
    logo: "/logos/whatsapp.svg",
    category: "communications",
    comingSoon: true,
  },
  // Maps
  {
    name: "Google Maps",
    description:
      "Geocoding, route optimization, distance matrix, and live driver tracking on maps.",
    logo: "/logos/google-maps.svg",
    category: "maps",
  },
  {
    name: "Mapbox",
    description:
      "Custom map styles, turn-by-turn navigation, and isochrone-based delivery zones.",
    logo: "/logos/mapbox.svg",
    category: "maps",
  },
  // Automation
  {
    name: "Zapier",
    description:
      "Connect Witylogix to 5000+ apps with no-code automation workflows.",
    logo: "/logos/zapier.svg",
    category: "automation",
    comingSoon: true,
  },
  {
    name: "HubSpot",
    description:
      "Sync delivery data with CRM, trigger workflows on shipment events.",
    logo: "/logos/hubspot.svg",
    category: "automation",
    comingSoon: true,
  },
  {
    name: "Salesforce",
    description:
      "Enterprise CRM integration for delivery lifecycle tracking and field service.",
    logo: "/logos/salesforce.svg",
    category: "automation",
    comingSoon: true,
  },
  {
    name: "Segment",
    description:
      "Customer data platform integration for delivery analytics and event tracking.",
    logo: "/logos/segment.svg",
    category: "automation",
    comingSoon: true,
  },
  // Infrastructure
  {
    name: "PostgreSQL",
    description:
      "Primary data store with PostGIS for geospatial queries and delivery zone calculations.",
    logo: "/logos/postgresql.svg",
    category: "infrastructure",
  },
  {
    name: "Redis",
    description:
      "Real-time caching, pub/sub for live tracking, and rate limiting for API endpoints.",
    logo: "/logos/redis.svg",
    category: "infrastructure",
  },
  {
    name: "Docker",
    description:
      "Containerized deployment with pre-built images for all Witylogix services.",
    logo: "/logos/docker.svg",
    category: "infrastructure",
  },
  {
    name: "Kubernetes",
    description:
      "Production-grade orchestration with Helm charts for auto-scaling delivery infra.",
    logo: "/logos/kubernetes.svg",
    category: "infrastructure",
    comingSoon: true,
  },
  {
    name: "AWS",
    description:
      "Native AWS integrations: SQS queues, S3 storage, Lambda webhooks, and CloudWatch.",
    logo: "/logos/aws.svg",
    category: "infrastructure",
    comingSoon: true,
  },
  {
    name: "Firebase",
    description:
      "Push notifications, real-time database sync, and driver app authentication.",
    logo: "/logos/firebase.svg",
    category: "infrastructure",
    comingSoon: true,
  },
  // Monitoring
  {
    name: "Sentry",
    description:
      "Error tracking and performance monitoring across all Witylogix services.",
    logo: "/logos/sentry.svg",
    category: "monitoring",
    comingSoon: true,
  },
];

const categoryLabels: Record<string, string> = {
  "e-commerce": "E-Commerce Platforms",
  payments: "Payments",
  communications: "Communications",
  maps: "Maps & Navigation",
  automation: "Automation & CRM",
  infrastructure: "Infrastructure",
  monitoring: "Monitoring",
};

const categoryColors: Record<string, string> = {
  "e-commerce": "var(--teal)",
  payments: "#635BFF",
  communications: "#F22F46",
  maps: "#4285F4",
  automation: "#FF4A00",
  infrastructure: "#2496ED",
  monitoring: "#362D59",
};

function LogoImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={32}
      height={32}
      className="object-contain w-7 h-7"
      loading="lazy"
    />
  );
}

export function IntegrationsGrid({ compact = false }: { compact?: boolean }) {
  const categories = [...new Set(integrations.map((i) => i.category))];
  const activeIntegrations = integrations.filter((i) => !i.comingSoon);

  if (compact) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {activeIntegrations.slice(0, 6).map((integration) => (
          <a
            key={integration.name}
            href={integration.docsUrl || "#"}
            className="group flex flex-col items-center gap-3 rounded-xl border border-[var(--forge-border)] bg-[var(--forge-surface)] p-5 transition-all hover:border-[var(--teal)] hover:shadow-[0_0_0_1px_rgba(42,157,143,0.1),0_8px_30px_rgba(42,157,143,0.08)] hover:-translate-y-1"
          >
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white p-2">
              <LogoImage src={integration.logo} alt={integration.name} />
            </div>
            <span className="text-sm font-medium text-[var(--sand-muted)] group-hover:text-[var(--sand)] transition-colors text-center">
              {integration.name}
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((category) => {
        const items = integrations.filter((i) => i.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: categoryColors[category] }}
              />
              <h3 className="font-display text-lg text-[var(--sand)]">
                {categoryLabels[category]}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((integration) => (
                <a
                  key={integration.name}
                  href={
                    integration.comingSoon
                      ? undefined
                      : integration.docsUrl || "#"
                  }
                  className={`group relative flex items-start gap-4 rounded-xl border border-[var(--forge-border)] bg-[var(--forge-surface)] p-5 transition-all ${
                    integration.comingSoon
                      ? "opacity-60 cursor-default"
                      : "hover:border-[var(--teal)] hover:shadow-[0_0_0_1px_rgba(42,157,143,0.1),0_8px_30px_rgba(42,157,143,0.08)] hover:-translate-y-1"
                  }`}
                >
                  {integration.comingSoon && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--coral)] bg-[var(--coral-glow)] px-2 py-0.5 rounded-full">
                      Coming Soon
                    </span>
                  )}
                  <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-white p-2">
                    <LogoImage src={integration.logo} alt={integration.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--sand)] group-hover:text-[var(--teal)] transition-colors">
                      {integration.name}
                    </div>
                    <p className="mt-1 text-xs text-[var(--sand-dim)] leading-relaxed line-clamp-2">
                      {integration.description}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
