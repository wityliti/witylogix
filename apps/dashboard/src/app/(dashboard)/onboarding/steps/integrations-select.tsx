"use client";

import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useState, useMemo } from "react";
import type { OnboardingData } from "../types";

interface IntegrationsSelectProps {
  data: OnboardingData;
  onSelect: (integrations: string[]) => void;
}

interface IntegrationCategory {
  name: string;
  description: string;
  providers: {
    id: string;
    name: string;
    icon?: string;
  }[];
}

// Category mapping based on integration registry
const INTEGRATION_CATEGORIES: Record<string, IntegrationCategory> = {
  routing: {
    name: "Routing & Maps",
    description: "Route optimization and mapping services",
    providers: [
      { id: "valhalla", name: "Valhalla" },
      { id: "vroom", name: "VROOM" },
      { id: "google-routes-api", name: "Google Routes" },
      { id: "mapbox-directions", name: "Mapbox Directions" },
      { id: "here-routing", name: "HERE Routing" },
      { id: "route4me", name: "Route4Me" },
      { id: "optimoroute", name: "OptimoRoute" },
      { id: "routific", name: "Routific" },
    ],
  },
  maps: {
    name: "Maps & Geocoding",
    description: "Mapping and location services",
    providers: [
      { id: "google-maps", name: "Google Maps" },
      { id: "mapbox", name: "Mapbox" },
      { id: "openstreetmap", name: "OpenStreetMap" },
      { id: "here-maps", name: "HERE Maps" },
      { id: "tomtom", name: "TomTom" },
    ],
  },
  telematics: {
    name: "Telematics & Fleet",
    description: "Vehicle tracking and fleet management",
    providers: [
      { id: "samsara", name: "Samsara" },
      { id: "flespi", name: "Flespi" },
      { id: "verizon-connect", name: "Verizon Connect" },
      { id: "trimble", name: "Trimble" },
      { id: "fleetio", name: "Fleetio" },
      { id: "geotab", name: "Geotab" },
      { id: "azuga", name: "Azuga" },
      { id: "omnitracs", name: "Omnitracs" },
    ],
  },
  messaging: {
    name: "Messaging & Notifications",
    description: "SMS, push notifications, and messaging APIs",
    providers: [
      { id: "vonage", name: "Vonage" },
      { id: "textmagic", name: "TextMagic" },
      { id: "onesignal", name: "OneSignal" },
      { id: "sendbird", name: "Sendbird" },
      { id: "twilio", name: "Twilio" },
      { id: "whatsapp-business", name: "WhatsApp Business" },
      { id: "firebase-cloud-messaging", name: "Firebase Cloud Messaging" },
    ],
  },
  email: {
    name: "Email",
    description: "Email delivery and management",
    providers: [
      { id: "mailgun", name: "Mailgun" },
      { id: "amazon-ses", name: "Amazon SES" },
      { id: "gmail", name: "Gmail" },
      { id: "outlook", name: "Outlook" },
      { id: "sendgrid", name: "SendGrid" },
    ],
  },
  "erp-accounting": {
    name: "ERP & Accounting",
    description: "Enterprise resource planning and accounting",
    providers: [
      { id: "sap", name: "SAP" },
      { id: "oracle-netsuite", name: "Oracle NetSuite" },
      { id: "microsoft-dynamics-365", name: "Microsoft Dynamics 365" },
      { id: "sage", name: "Sage" },
      { id: "quickbooks", name: "QuickBooks" },
      { id: "xero", name: "Xero" },
      { id: "infor", name: "Infor" },
      { id: "epicor", name: "Epicor" },
    ],
  },
  crm: {
    name: "CRM",
    description: "Customer relationship management",
    providers: [
      { id: "salesforce", name: "Salesforce" },
      { id: "hubspot", name: "HubSpot" },
      { id: "zoho-crm", name: "Zoho CRM" },
      { id: "microsoft-dynamics-crm", name: "Microsoft Dynamics CRM" },
      { id: "pipedrive", name: "Pipedrive" },
    ],
  },
  "e-commerce": {
    name: "E-Commerce",
    description: "Online store and marketplace integration",
    providers: [
      { id: "shopify", name: "Shopify" },
      { id: "woocommerce", name: "WooCommerce" },
      { id: "bigcommerce", name: "BigCommerce" },
      { id: "magento", name: "Magento" },
      { id: "amazon-seller-central", name: "Amazon Seller Central" },
      { id: "ebay", name: "eBay" },
      { id: "etsy", name: "Etsy" },
      { id: "square-online", name: "Square Online" },
    ],
  },
  payments: {
    name: "Payments",
    description: "Payment processing and transactions",
    providers: [
      { id: "stripe", name: "Stripe" },
      { id: "paypal", name: "PayPal" },
      { id: "braintree", name: "Braintree" },
      { id: "authorize-net", name: "Authorize.Net" },
      { id: "adyen", name: "Adyen" },
      { id: "square-payments", name: "Square" },
    ],
  },
  collaboration: {
    name: "Collaboration",
    description: "Team communication and collaboration",
    providers: [
      { id: "slack", name: "Slack" },
      { id: "microsoft-teams", name: "Microsoft Teams" },
      { id: "pusher", name: "Pusher" },
      { id: "track-pod", name: "Track-POD" },
      { id: "dispatchtrack", name: "DispatchTrack" },
    ],
  },
  "e-signatures": {
    name: "E-Signatures",
    description: "Digital signature and document signing",
    providers: [
      { id: "docusign", name: "DocuSign" },
      { id: "adobe-sign", name: "Adobe Sign" },
      { id: "pandadoc", name: "PandaDoc" },
      { id: "hellosign", name: "HelloSign" },
    ],
  },
  shipping: {
    name: "Shipping",
    description: "Shipping and logistics carriers",
    providers: [
      { id: "shipstation", name: "ShipStation" },
      { id: "easypost", name: "EasyPost" },
      { id: "shippo", name: "Shippo" },
      { id: "fedex", name: "FedEx" },
      { id: "ups", name: "UPS" },
      { id: "usps", name: "USPS" },
      { id: "dhl", name: "DHL" },
    ],
  },
  eld: {
    name: "ELD & Compliance",
    description: "Electronic logging device and compliance",
    providers: [
      { id: "motive-eld", name: "Motive" },
      { id: "omnitracs-eld", name: "Omnitracs ELD" },
      { id: "samsara-eld", name: "Samsara ELD" },
      { id: "geotab-drive", name: "Geotab Drive" },
      { id: "azuga-eld", name: "Azuga ELD" },
    ],
  },
  "last-mile": {
    name: "Last-Mile Delivery",
    description: "On-demand and last-mile delivery",
    providers: [
      { id: "doordash-drive", name: "DoorDash Drive" },
      { id: "uber-eats", name: "Uber Eats" },
      { id: "grubhub", name: "Grubhub" },
    ],
  },
  analytics: {
    name: "Analytics",
    description: "Business intelligence and analytics",
    providers: [
      { id: "tableau", name: "Tableau" },
      { id: "power-bi", name: "Power BI" },
      { id: "looker", name: "Looker" },
      { id: "qlik", name: "Qlik" },
      { id: "google-analytics", name: "Google Analytics" },
    ],
  },
  "supply-chain": {
    name: "Supply Chain",
    description: "Warehouse and supply chain management",
    providers: [
      { id: "manhattan-associates", name: "Manhattan Associates" },
      { id: "blue-yonder", name: "Blue Yonder" },
      { id: "korber-supply-chain", name: "Körber Supply Chain" },
      { id: "deposco", name: "Deposco" },
      { id: "extensiv", name: "Extensiv" },
    ],
  },
  healthcare: {
    name: "Healthcare",
    description: "Healthcare systems and EHR",
    providers: [
      { id: "epic", name: "Epic" },
      { id: "cerner", name: "Cerner" },
      { id: "hl7-fhir", name: "HL7 FHIR" },
      { id: "allscripts", name: "Allscripts" },
    ],
  },
  freight: {
    name: "Freight",
    description: "Freight marketplaces and load boards",
    providers: [
      { id: "dat-load-board", name: "DAT Load Board" },
      { id: "truckstop", name: "Truckstop.com" },
      { id: "123loadboard", name: "123Loadboard" },
      { id: "direct-freight", name: "Direct Freight" },
    ],
  },
  "fuel-fleet": {
    name: "Fuel & Fleet Cards",
    description: "Fleet fuel card management",
    providers: [
      { id: "wex", name: "WEX" },
      { id: "comdata", name: "Comdata" },
      { id: "fuelman", name: "Fuelman" },
      { id: "efs", name: "EFS" },
    ],
  },
  "field-service": {
    name: "Field Service",
    description: "Field service management",
    providers: [
      { id: "servicetitan", name: "ServiceTitan" },
      { id: "jobber", name: "Jobber" },
      { id: "housecall-pro", name: "Housecall Pro" },
      { id: "fieldedge", name: "FieldEdge" },
    ],
  },
  "pos-restaurant": {
    name: "POS & Restaurant",
    description: "Point of sale and restaurant systems",
    providers: [
      { id: "toast-pos", name: "Toast POS" },
      { id: "square-for-restaurants", name: "Square for Restaurants" },
    ],
  },
};

const CATEGORIES_ORDER = [
  "routing",
  "maps",
  "telematics",
  "messaging",
  "email",
  "erp-accounting",
  "crm",
  "e-commerce",
  "payments",
  "collaboration",
  "e-signatures",
  "shipping",
  "eld",
  "last-mile",
  "analytics",
  "supply-chain",
  "healthcare",
  "freight",
  "fuel-fleet",
  "field-service",
  "pos-restaurant",
];

export function IntegrationsSelect({
  data,
  onSelect,
}: IntegrationsSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES_ORDER.slice(0, 5)),
  );

  const selected = new Set(data.integrations);

  const toggleCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleIntegration = (integrationId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(integrationId)) {
      newSelected.delete(integrationId);
    } else {
      newSelected.add(integrationId);
    }
    onSelect(Array.from(newSelected));
  };

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const result: Record<string, (typeof INTEGRATION_CATEGORIES)[string]> = {};

    for (const categoryKey of CATEGORIES_ORDER) {
      const category = INTEGRATION_CATEGORIES[categoryKey];
      const filtered = category.providers.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          category.name.toLowerCase().includes(query),
      );

      if (filtered.length > 0) {
        result[categoryKey] = {
          ...category,
          providers: filtered,
        };
      }
    }

    return result;
  }, [searchQuery]);

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Connect your tools
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Select integrations to enable (optional)
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary pointer-events-none" />
        <input
          type="text"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "w-full pl-9 pr-4 py-2 rounded-lg",
            "bg-wl-bg-surface border border-wl-border-default",
            "text-wl-text-primary placeholder-wl-text-tertiary",
            "transition-colors duration-200",
            "focus:outline-none focus:border-wl-primary-400",
          )}
        />
      </div>

      {/* Integration Categories */}
      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
        {Object.entries(filteredCategories).map(([categoryKey, category]) => {
          const isExpanded = expandedCategories.has(categoryKey);
          const visibleProviders = isExpanded
            ? category.providers
            : category.providers.slice(0, 4);
          const hasMore = category.providers.length > 4 && !isExpanded;

          return (
            <div key={categoryKey} className="flex flex-col gap-3">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg",
                  "bg-wl-bg-surface/50 hover:bg-wl-bg-surface",
                  "border border-wl-border-subtle",
                  "transition-colors duration-200",
                  "text-left",
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-wl-text-primary m-0">
                    {category.name}
                  </p>
                  <p className="text-xs text-wl-text-tertiary m-0">
                    {category.description}
                  </p>
                </div>
                {category.providers.length > 4 &&
                  (isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
                  ))}
              </button>

              {/* Provider Chips */}
              <div className="flex flex-wrap gap-2 pl-3">
                {visibleProviders.map((provider) => {
                  const isSelected = selected.has(provider.id);
                  return (
                    <button
                      key={provider.id}
                      onClick={() => toggleIntegration(provider.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium",
                        "transition-all duration-200",
                        "border",
                        "flex items-center gap-2",
                        isSelected
                          ? "bg-wl-primary-500/15 border-wl-primary-400 text-wl-primary-300"
                          : "bg-wl-bg-surface border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong",
                      )}
                    >
                      {provider.name}
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}

                {hasMore && (
                  <button
                    onClick={() => toggleCategory(categoryKey)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium",
                      "bg-wl-bg-surface border border-wl-border-default",
                      "text-wl-primary-400 hover:bg-wl-primary-500/10",
                      "transition-all duration-200",
                    )}
                  >
                    Show More Tools +
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-wl-text-tertiary m-0">
              No integrations found. Try a different search.
            </p>
          </div>
        )}
      </div>

      {/* Selected Count */}
      {selected.size > 0 && (
        <div className="px-4 py-3 rounded-lg bg-wl-primary-500/10 border border-wl-primary-500/20">
          <p className="text-sm font-medium text-wl-primary-300 m-0">
            {selected.size} integration{selected.size !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      {/* Helper Text */}
      <div className="p-4 rounded-lg bg-wl-bg-surface/50 border border-wl-border-subtle">
        <p className="text-xs text-wl-text-tertiary m-0">
          These can be configured later in Settings &gt; Integrations. You can
          skip this step for now.
        </p>
      </div>
    </div>
  );
}
