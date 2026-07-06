"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useApiList } from "@/hooks/use-api";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Grid3x3, List, X, Loader2, ChevronDown } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   INTEGRATION MARKETPLACE — Catalog Page
   Browse all 125+ integrations with filters & search
   ═══════════════════════════════════════════════════════════ */

type Category =
  | "CRM"
  | "EMAIL"
  | "SMS"
  | "PUSH"
  | "ROUTING"
  | "TELEMATICS"
  | "SHIPPING"
  | "INVENTORY"
  | "PAYMENTS"
  | "ANALYTICS"
  | "ECOMMERCE"
  | "ERP"
  | "COLLABORATION"
  | "ELD"
  | "FUEL"
  | "POS"
  | "LASTMILE"
  | "FREIGHT"
  | "SUPPLY_CHAIN"
  | "CATALOG"
  | "ESIGNATURES";

type AuthType = "oauth2" | "api_key" | "basic_auth" | "custom";
type Status = "AVAILABLE" | "CONNECTED" | "COMING_SOON" | "BETA";
type SortBy = "name" | "category" | "popularity" | "recently_added";

interface Provider {
  id: string;
  slug: string;
  name: string;
  category: Category;
  description: string;
  logo?: string;
  status: Status;
  authType: AuthType;
  popular: boolean;
  addedDate: string;
  connected: boolean;
}

// All 21 categories from registry
const CATEGORIES: { key: Category; label: string; count: number }[] = [
  { key: "CRM", label: "CRM", count: 8 },
  { key: "EMAIL", label: "Email", count: 12 },
  { key: "SMS", label: "SMS", count: 6 },
  { key: "PUSH", label: "Push Notifications", count: 5 },
  { key: "ROUTING", label: "Routing", count: 7 },
  { key: "TELEMATICS", label: "Telematics", count: 6 },
  { key: "SHIPPING", label: "Shipping", count: 9 },
  { key: "INVENTORY", label: "Inventory", count: 7 },
  { key: "PAYMENTS", label: "Payments", count: 8 },
  { key: "ANALYTICS", label: "Analytics", count: 6 },
  { key: "ECOMMERCE", label: "E-Commerce", count: 11 },
  { key: "ERP", label: "ERP", count: 5 },
  { key: "COLLABORATION", label: "Collaboration", count: 4 },
  { key: "ELD", label: "ELD", count: 3 },
  { key: "FUEL", label: "Fuel", count: 4 },
  { key: "POS", label: "POS", count: 5 },
  { key: "LASTMILE", label: "Last-Mile", count: 3 },
  { key: "FREIGHT", label: "Freight", count: 4 },
  { key: "SUPPLY_CHAIN", label: "Supply Chain", count: 6 },
  { key: "CATALOG", label: "Catalog", count: 5 },
  { key: "ESIGNATURES", label: "E-Signatures", count: 3 },
];

// Sample providers data (125 cards)
const ALL_PROVIDERS: Provider[] = [
  // CRM
  {
    id: "crm-1",
    slug: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Customer relationship management platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "crm-2",
    slug: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Enterprise CRM solution",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "crm-3",
    slug: "pipedrive",
    name: "Pipedrive",
    category: "CRM",
    description: "Sales pipeline management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-05-20",
    connected: false,
  },
  {
    id: "crm-4",
    slug: "freshsales",
    name: "Freshsales",
    category: "CRM",
    description: "Modern CRM for teams",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-05-15",
    connected: false,
  },
  {
    id: "crm-5",
    slug: "zoho-crm",
    name: "Zoho CRM",
    category: "CRM",
    description: "Cloud CRM software",
    status: "BETA",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-01",
    connected: false,
  },
  {
    id: "crm-6",
    slug: "sugarcrm",
    name: "SugarCRM",
    category: "CRM",
    description: "Customer-centric CRM",
    status: "COMING_SOON",
    authType: "api_key",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },
  {
    id: "crm-7",
    slug: "vtiger",
    name: "Vtiger",
    category: "CRM",
    description: "Open-source CRM",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-04-25",
    connected: false,
  },
  {
    id: "crm-8",
    slug: "copper",
    name: "Copper",
    category: "CRM",
    description: "AI-powered CRM for Gmail",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-05-10",
    connected: false,
  },

  // EMAIL
  {
    id: "email-1",
    slug: "sendgrid",
    name: "SendGrid",
    category: "EMAIL",
    description: "Transactional email delivery",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "email-2",
    slug: "mailgun",
    name: "Mailgun",
    category: "EMAIL",
    description: "Email API for developers",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "email-3",
    slug: "aws-ses",
    name: "AWS SES",
    category: "EMAIL",
    description: "Amazon email service",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "email-4",
    slug: "resend",
    name: "Resend",
    category: "EMAIL",
    description: "Modern email API",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },
  {
    id: "email-5",
    slug: "sparkpost",
    name: "SparkPost",
    category: "EMAIL",
    description: "Email delivery platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-05-28",
    connected: false,
  },
  {
    id: "email-6",
    slug: "mandrill",
    name: "Mandrill",
    category: "EMAIL",
    description: "Transactional email service",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-05-22",
    connected: false,
  },
  {
    id: "email-7",
    slug: "postmark",
    name: "Postmark",
    category: "EMAIL",
    description: "Fast & reliable email",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "email-8",
    slug: "brevo",
    name: "Brevo",
    category: "EMAIL",
    description: "Omnichannel marketing platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-05-30",
    connected: false,
  },
  {
    id: "email-9",
    slug: "klaviyo",
    name: "Klaviyo",
    category: "EMAIL",
    description: "Email marketing for e-commerce",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-03",
    connected: false,
  },
  {
    id: "email-10",
    slug: "mailchimp",
    name: "Mailchimp",
    category: "EMAIL",
    description: "Email marketing made easy",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-01",
    connected: false,
  },
  {
    id: "email-11",
    slug: "constant-contact",
    name: "Constant Contact",
    category: "EMAIL",
    description: "Email marketing & automation",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-05-25",
    connected: false,
  },
  {
    id: "email-12",
    slug: "getresponse",
    name: "GetResponse",
    category: "EMAIL",
    description: "Integrated marketing platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },

  // SMS
  {
    id: "sms-1",
    slug: "twilio",
    name: "Twilio",
    category: "SMS",
    description: "Programmable SMS & voice",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "sms-2",
    slug: "vonage",
    name: "Vonage",
    category: "SMS",
    description: "Communications APIs",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "sms-3",
    slug: "aws-sns",
    name: "AWS SNS",
    category: "SMS",
    description: "AWS messaging service",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "sms-4",
    slug: "messagebind",
    name: "MessageBind",
    category: "SMS",
    description: "SMS API provider",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "sms-5",
    slug: "telnyx",
    name: "Telnyx",
    category: "SMS",
    description: "Telecom APIs platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },
  {
    id: "sms-6",
    slug: "bandwidth",
    name: "Bandwidth",
    category: "SMS",
    description: "Carrier-grade communications",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-02",
    connected: false,
  },

  // PUSH
  {
    id: "push-1",
    slug: "firebase-fcm",
    name: "Firebase Cloud Messaging",
    category: "PUSH",
    description: "Cross-platform push notifications",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "push-2",
    slug: "onesignal",
    name: "OneSignal",
    category: "PUSH",
    description: "Multi-channel notifications",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "push-3",
    slug: "braze",
    name: "Braze",
    category: "PUSH",
    description: "Customer engagement platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "push-4",
    slug: "urban-airship",
    name: "Airship",
    category: "PUSH",
    description: "Customer journey platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "push-5",
    slug: "apptivo",
    name: "Apptivo",
    category: "PUSH",
    description: "Business management suite",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },

  // ROUTING
  {
    id: "routing-1",
    slug: "mapbox",
    name: "Mapbox",
    category: "ROUTING",
    description: "Maps, routing & optimization",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "routing-2",
    slug: "google-maps",
    name: "Google Maps",
    category: "ROUTING",
    description: "Industry-standard maps",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "routing-3",
    slug: "here-maps",
    name: "HERE Maps",
    category: "ROUTING",
    description: "Enterprise location services",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "routing-4",
    slug: "osrm",
    name: "OSRM",
    category: "ROUTING",
    description: "Open source routing",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "routing-5",
    slug: "graphhopper",
    name: "GraphHopper",
    category: "ROUTING",
    description: "Routing engine as API",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },
  {
    id: "routing-6",
    slug: "tomtom",
    name: "TomTom",
    category: "ROUTING",
    description: "Mapping & location APIs",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-03",
    connected: false,
  },
  {
    id: "routing-7",
    slug: "vroom",
    name: "VROOM",
    category: "ROUTING",
    description: "Route optimization engine",
    status: "COMING_SOON",
    authType: "api_key",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },

  // TELEMATICS
  {
    id: "telematics-1",
    slug: "geotab",
    name: "Geotab",
    category: "TELEMATICS",
    description: "Fleet telematics platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "telematics-2",
    slug: "samsara",
    name: "Samsara",
    category: "TELEMATICS",
    description: "Fleet operations software",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "telematics-3",
    slug: "verizon-connect",
    name: "Verizon Connect",
    category: "TELEMATICS",
    description: "Fleet management solution",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "telematics-4",
    slug: "teletrac",
    name: "TELETRAC SIRCO",
    category: "TELEMATICS",
    description: "Fleet tracking & safety",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "telematics-5",
    slug: "omnitracs",
    name: "Omnitracs",
    category: "TELEMATICS",
    description: "Fleet visibility platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "telematics-6",
    slug: "motive",
    name: "Motive",
    category: "TELEMATICS",
    description: "Digital operations platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },

  // SHIPPING
  {
    id: "shipping-1",
    slug: "easypost",
    name: "EasyPost",
    category: "SHIPPING",
    description: "Shipping API with 100+ carriers",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "shipping-2",
    slug: "shipstation",
    name: "ShipStation",
    category: "SHIPPING",
    description: "Multi-carrier shipping",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "shipping-3",
    slug: "aftership",
    name: "AfterShip",
    category: "SHIPPING",
    description: "Tracking & notifications",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "shipping-4",
    slug: "fedex",
    name: "FedEx",
    category: "SHIPPING",
    description: "Shipping & tracking API",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "shipping-5",
    slug: "ups",
    name: "UPS",
    category: "SHIPPING",
    description: "UPS shipping API",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "shipping-6",
    slug: "usps",
    name: "USPS",
    category: "SHIPPING",
    description: "US postal service API",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "shipping-7",
    slug: "dhl",
    name: "DHL",
    category: "SHIPPING",
    description: "DHL shipping services",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-05",
    connected: false,
  },
  {
    id: "shipping-8",
    slug: "stamps",
    name: "Stamps.com",
    category: "SHIPPING",
    description: "Shipping software",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-03",
    connected: false,
  },
  {
    id: "shipping-9",
    slug: "pirate-ship",
    name: "Pirate Ship",
    category: "SHIPPING",
    description: "Shipping labels & rates",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-01",
    connected: false,
  },

  // INVENTORY
  {
    id: "inventory-1",
    slug: "shopify",
    name: "Shopify",
    category: "INVENTORY",
    description: "E-commerce platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "inventory-2",
    slug: "woocommerce",
    name: "WooCommerce",
    category: "INVENTORY",
    description: "WordPress e-commerce",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "inventory-3",
    slug: "magento",
    name: "Magento",
    category: "INVENTORY",
    description: "Enterprise e-commerce",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "inventory-4",
    slug: "cin7",
    name: "Cin7 Omni",
    category: "INVENTORY",
    description: "Inventory management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "inventory-5",
    slug: "dear",
    name: "DEAR Inventory",
    category: "INVENTORY",
    description: "Inventory & order mgmt",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "inventory-6",
    slug: "infoplus",
    name: "infoplus",
    category: "INVENTORY",
    description: "Warehouse management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "inventory-7",
    slug: "trackobject",
    name: "TrackObject",
    category: "INVENTORY",
    description: "Inventory tracking",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },

  // PAYMENTS (8 providers)
  {
    id: "payment-1",
    slug: "stripe",
    name: "Stripe",
    category: "PAYMENTS",
    description: "Payment processing",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "payment-2",
    slug: "paypal",
    name: "PayPal",
    category: "PAYMENTS",
    description: "Payment platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "payment-3",
    slug: "square",
    name: "Square",
    category: "PAYMENTS",
    description: "Payments & POS",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "payment-4",
    slug: "braintree",
    name: "Braintree",
    category: "PAYMENTS",
    description: "Payment solutions",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "payment-5",
    slug: "adyen",
    name: "Adyen",
    category: "PAYMENTS",
    description: "Global payments",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "payment-6",
    slug: "authorize-net",
    name: "Authorize.Net",
    category: "PAYMENTS",
    description: "Payment gateway",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "payment-7",
    slug: " 2checkout",
    name: "2Checkout",
    category: "PAYMENTS",
    description: "Global payment solutions",
    status: "COMING_SOON",
    authType: "api_key",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },
  {
    id: "payment-8",
    slug: "mollie",
    name: "Mollie",
    category: "PAYMENTS",
    description: "European payment gateway",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },

  // ANALYTICS (6)
  {
    id: "analytics-1",
    slug: "google-analytics",
    name: "Google Analytics",
    category: "ANALYTICS",
    description: "Website analytics",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "analytics-2",
    slug: "mixpanel",
    name: "Mixpanel",
    category: "ANALYTICS",
    description: "Product analytics",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "analytics-3",
    slug: "amplitude",
    name: "Amplitude",
    category: "ANALYTICS",
    description: "Digital analytics",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "analytics-4",
    slug: "segment",
    name: "Segment",
    category: "ANALYTICS",
    description: "Customer data platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "analytics-5",
    slug: "looker",
    name: "Looker",
    category: "ANALYTICS",
    description: "Business intelligence",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "analytics-6",
    slug: "tableau",
    name: "Tableau",
    category: "ANALYTICS",
    description: "Data visualization",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },

  // ECOMMERCE (11)
  {
    id: "ecom-1",
    slug: "bigcommerce",
    name: "BigCommerce",
    category: "ECOMMERCE",
    description: "E-commerce platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "ecom-2",
    slug: "wix",
    name: "Wix",
    category: "ECOMMERCE",
    description: "Website builder",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "ecom-3",
    slug: "squarespace",
    name: "Squarespace",
    category: "ECOMMERCE",
    description: "Website platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "ecom-4",
    slug: "prestashop",
    name: "PrestaShop",
    category: "ECOMMERCE",
    description: "E-commerce solution",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "ecom-5",
    slug: "opencart",
    name: "OpenCart",
    category: "ECOMMERCE",
    description: "Shopping cart software",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "ecom-6",
    slug: "commerce-tools",
    name: "commercetools",
    category: "ECOMMERCE",
    description: "Headless commerce",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },
  {
    id: "ecom-7",
    slug: "saleor",
    name: "Saleor",
    category: "ECOMMERCE",
    description: "Open-source commerce",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-05",
    connected: false,
  },
  {
    id: "ecom-8",
    slug: "medusa",
    name: "Medusa",
    category: "ECOMMERCE",
    description: "Composable commerce",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-03",
    connected: false,
  },
  {
    id: "ecom-9",
    slug: "shopware",
    name: "Shopware",
    category: "ECOMMERCE",
    description: "E-commerce platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-01",
    connected: false,
  },
  {
    id: "ecom-10",
    slug: "acquia",
    name: "Acquia Commerce",
    category: "ECOMMERCE",
    description: "Drupal commerce",
    status: "COMING_SOON",
    authType: "api_key",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },
  {
    id: "ecom-11",
    slug: "fabric",
    name: "Fabric",
    category: "ECOMMERCE",
    description: "Composable platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-04",
    connected: false,
  },

  // ERP (5)
  {
    id: "erp-1",
    slug: "sap",
    name: "SAP",
    category: "ERP",
    description: "Enterprise resource planning",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "erp-2",
    slug: "oracle",
    name: "Oracle",
    category: "ERP",
    description: "Enterprise software",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "erp-3",
    slug: "netsuite",
    name: "NetSuite",
    category: "ERP",
    description: "Cloud ERP platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "erp-4",
    slug: "dolibarr",
    name: "Dolibarr",
    category: "ERP",
    description: "Open-source ERP",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "erp-5",
    slug: "odoo",
    name: "Odoo",
    category: "ERP",
    description: "Business management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },

  // COLLABORATION (4)
  {
    id: "collab-1",
    slug: "slack",
    name: "Slack",
    category: "COLLABORATION",
    description: "Team messaging platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "collab-2",
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    category: "COLLABORATION",
    description: "Enterprise chat",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "collab-3",
    slug: "discord",
    name: "Discord",
    category: "COLLABORATION",
    description: "Chat & community",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "collab-4",
    slug: "mattermost",
    name: "Mattermost",
    category: "COLLABORATION",
    description: "Open-source chat",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },

  // ELD (3)
  {
    id: "eld-1",
    slug: "samsara-eld",
    name: "Samsara ELD",
    category: "ELD",
    description: "Electronic logging device",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "eld-2",
    slug: "geotab-eld",
    name: "Geotab ELD",
    category: "ELD",
    description: "ELD solution",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "eld-3",
    slug: "keeptruckin",
    name: "Keeptruckin",
    category: "ELD",
    description: "ELD & telematics",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },

  // FUEL (4)
  {
    id: "fuel-1",
    slug: "fleet-complete",
    name: "Fleet Complete",
    category: "FUEL",
    description: "Fuel management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "fuel-2",
    slug: "smartfuel",
    name: "SmartFuel",
    category: "FUEL",
    description: "Fuel card integration",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "fuel-3",
    slug: "wex",
    name: "WEX",
    category: "FUEL",
    description: "Fleet fuel cards",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "fuel-4",
    slug: "voyager",
    name: "Voyager",
    category: "FUEL",
    description: "Fuel payment network",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },

  // POS (5)
  {
    id: "pos-1",
    slug: "toast",
    name: "Toast",
    category: "POS",
    description: "Restaurant POS system",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "pos-2",
    slug: "lightspeed",
    name: "Lightspeed",
    category: "POS",
    description: "Retail POS software",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "pos-3",
    slug: "clover",
    name: "Clover",
    category: "POS",
    description: "Point of sale platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "pos-4",
    slug: "shopify-pos",
    name: "Shopify POS",
    category: "POS",
    description: "Unified POS system",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "pos-5",
    slug: "vend",
    name: "Vend",
    category: "POS",
    description: "Cloud POS platform",
    status: "COMING_SOON",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },

  // LASTMILE (3)
  {
    id: "lastmile-1",
    slug: "roadie",
    name: "Roadie",
    category: "LASTMILE",
    description: "On-demand delivery",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "lastmile-2",
    slug: "onfleet",
    name: "OnFleet",
    category: "LASTMILE",
    description: "Last-mile delivery",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "lastmile-3",
    slug: "relay",
    name: "Relay",
    category: "LASTMILE",
    description: "Delivery automation",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },

  // FREIGHT (4)
  {
    id: "freight-1",
    slug: "freightos",
    name: "Freightos",
    category: "FREIGHT",
    description: "Freight marketplace",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "freight-2",
    slug: "convoy",
    name: "Convoy",
    category: "FREIGHT",
    description: "Freight platform",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "freight-3",
    slug: "loadsmart",
    name: "Loadsmart",
    category: "FREIGHT",
    description: "Freight brokerage",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "freight-4",
    slug: "ffxp",
    name: "Forward Air",
    category: "FREIGHT",
    description: "Freight services",
    status: "COMING_SOON",
    authType: "api_key",
    popular: false,
    addedDate: "2025-07-01",
    connected: false,
  },

  // SUPPLY_CHAIN (6)
  {
    id: "sc-1",
    slug: "blume-global",
    name: "Blume Global",
    category: "SUPPLY_CHAIN",
    description: "Supply chain visibility",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "sc-2",
    slug: "fourkites",
    name: "FourKites",
    category: "SUPPLY_CHAIN",
    description: "Shipment visibility",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "sc-3",
    slug: "jagg",
    name: "Jagg",
    category: "SUPPLY_CHAIN",
    description: "Supply chain planning",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "sc-4",
    slug: "kinaxis",
    name: "Kinaxis",
    category: "SUPPLY_CHAIN",
    description: "Supply chain planning",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "sc-5",
    slug: "logility",
    name: "Logility",
    category: "SUPPLY_CHAIN",
    description: "Demand planning",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },
  {
    id: "sc-6",
    slug: "trackwise",
    name: "TrackWise",
    category: "SUPPLY_CHAIN",
    description: "Quality management",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-08",
    connected: false,
  },

  // CATALOG (5)
  {
    id: "catalog-1",
    slug: "contentstack",
    name: "Contentstack",
    category: "CATALOG",
    description: "Headless CMS",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "catalog-2",
    slug: "contentful",
    name: "Contentful",
    category: "CATALOG",
    description: "Content infrastructure",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "catalog-3",
    slug: "sanity",
    name: "Sanity",
    category: "CATALOG",
    description: "Structured content",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-15",
    connected: false,
  },
  {
    id: "catalog-4",
    slug: "strapi",
    name: "Strapi",
    category: "CATALOG",
    description: "Open-source CMS",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-12",
    connected: false,
  },
  {
    id: "catalog-5",
    slug: "hygraph",
    name: "Hygraph",
    category: "CATALOG",
    description: "Federated content",
    status: "AVAILABLE",
    authType: "api_key",
    popular: false,
    addedDate: "2025-06-10",
    connected: false,
  },

  // ESIGNATURES (3)
  {
    id: "sig-1",
    slug: "docusign",
    name: "DocuSign",
    category: "ESIGNATURES",
    description: "E-signature platform",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-20",
    connected: false,
  },
  {
    id: "sig-2",
    slug: "adobe-sign",
    name: "Adobe Sign",
    category: "ESIGNATURES",
    description: "Digital signatures",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    addedDate: "2025-06-18",
    connected: false,
  },
  {
    id: "sig-3",
    slug: "hellosign",
    name: "HelloSign",
    category: "ESIGNATURES",
    description: "E-signature service",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: false,
    addedDate: "2025-06-15",
    connected: false,
  },
];

export default function MarketplacePage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("popularity");
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const {
    items: connections,
    error: connectionsError,
    refetch: refetchConnections,
  } = useApiList<{ slug: string }>("/api/v4/integrations/connections");
  const connectedSlugs = useMemo(
    () => new Set(connections.map((c) => c.slug)),
    [connections],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setIsSearching(true);
  };

  const toggleCategory = useCallback((category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }, []);

  // Filter & sort providers
  const filtered = useMemo(() => {
    let items = [...ALL_PROVIDERS];

    // Filter by search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.slug.includes(q),
      );
    }

    // Filter by categories
    if (selectedCategories.length > 0) {
      items = items.filter((p) => selectedCategories.includes(p.category));
    }

    // Sort
    switch (sortBy) {
      case "name":
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "category":
        items.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case "popularity":
        items.sort((a, b) => {
          if (a.popular !== b.popular) return b.popular ? 1 : -1;
          return (
            (connectedSlugs.has(b.slug) ? 1 : 0) -
            (connectedSlugs.has(a.slug) ? 1 : 0)
          );
        });
        break;
      case "recently_added":
        items.sort(
          (a, b) =>
            new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime(),
        );
        break;
    }

    return items;
  }, [debouncedSearch, selectedCategories, sortBy]);

  // Get active filter count
  const activeFilterCount =
    selectedCategories.length + (debouncedSearch ? 1 : 0);

  if (connectionsError)
    return (
      <ErrorState
        title="Failed to load integrations"
        error={connectionsError}
        onRetry={refetchConnections}
      />
    );

  return (
    <>
      <Header
        title="Integration Marketplace"
        subtitle={`${filtered.length} providers available`}
      />

      <div className={cn("p-6 max-w-7xl mx-auto")}>
        {/* Filters & Search Row */}
        <div className={cn("flex flex-col gap-4 mb-6")}>
          {/* Search Input */}
          <div className={cn("relative")}>
            <Search className="w-4 h-4 absolute left-3 top-3 text-wl-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg",
                "text-white text-sm",
                "focus:border-blue-500 outline-none",
                "transition-all duration-fast",
              )}
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3 top-3 text-blue-500 animate-spin" />
            )}
          </div>

          {/* Filters & Controls */}
          <div className={cn("flex flex-wrap gap-3 items-center")}>
            {/* View Toggle */}
            <div className={cn("flex gap-1 bg-wl-bg-elevated rounded-md p-1")}>
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "p-2 rounded-sm border-none cursor-pointer transition-all",
                    view === v
                      ? "bg-blue-500 text-black"
                      : "bg-transparent text-wl-text-tertiary hover:text-white",
                  )}
                  title={v === "grid" ? "Grid view" : "List view"}
                >
                  {v === "grid" ? (
                    <Grid3x3 className="w-4 h-4" />
                  ) : (
                    <List className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className={cn("relative")}>
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded-lg",
                  "text-sm text-white hover:border-blue-500 transition-all",
                )}
              >
                Sort by:{" "}
                <span className="font-semibold capitalize">
                  {sortBy.replace(/_/g, " ")}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {/* Dropdown Menu */}
              <div
                className={cn(
                  "absolute top-full mt-2 left-0 z-10 bg-wl-bg-elevated border border-wl-border-default rounded-lg",
                  "shadow-lg overflow-hidden min-w-max",
                )}
              >
                {(
                  ["name", "category", "popularity", "recently_added"] as const
                ).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm",
                      "hover:bg-wl-bg-elevated",
                      sortBy === opt
                        ? "bg-blue-500/20 text-blue-500"
                        : "text-white",
                    )}
                  >
                    {opt.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategories([]);
                }}
                className={cn(
                  "text-sm text-wl-text-tertiary hover:text-white transition-all",
                )}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {(debouncedSearch || selectedCategories.length > 0) && (
            <div className={cn("flex flex-wrap gap-2")}>
              {debouncedSearch && (
                <Badge variant="primary">
                  Search: {debouncedSearch}
                  <button
                    onClick={() => setSearch("")}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedCategories.map((cat) => (
                <Badge key={cat} variant="info">
                  {cat.replace(/_/g, " ")}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Main Content: Sidebar + Grid/List */}
        <div className={cn("flex gap-6")}>
          {/* Sidebar Filters */}
          <aside className={cn("w-56 flex-shrink-0")}>
            <div className={cn("sticky top-4 space-y-4")}>
              <div>
                <h3 className={cn("text-sm font-semibold text-white mb-3")}>
                  Categories
                </h3>
                <div className={cn("space-y-2")}>
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat.key}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-wl-bg-elevated transition-all",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.key)}
                        onChange={() => toggleCategory(cat.key)}
                        className={cn(
                          "w-4 h-4 rounded border-wl-border-default",
                          "checked:bg-blue-500 checked:border-blue-500",
                        )}
                      />
                      <span className={cn("text-sm text-white flex-1")}>
                        {cat.label}
                      </span>
                      <span className={cn("text-xs text-wl-text-tertiary")}>
                        {cat.count}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Grid/List View */}
          <main className={cn("flex-1")}>
            {filtered.length === 0 ? (
              <div className={cn("text-center py-20 text-wl-text-tertiary")}>
                <div className="text-base font-semibold mb-2">
                  No providers found
                </div>
                <div className="text-sm">
                  Try adjusting your search or filters
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  view === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-3",
                )}
              >
                {filtered.map((provider, idx) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    index={idx}
                    layout={view}
                    isConnected={connectedSlugs.has(provider.slug)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

/* Provider Card Component */
interface ProviderCardProps {
  provider: Provider;
  index: number;
  layout: "grid" | "list";
  isConnected?: boolean;
}

function ProviderCard({
  provider,
  index,
  layout,
  isConnected = false,
}: ProviderCardProps) {
  const statusColor =
    provider.status === "CONNECTED"
      ? "success"
      : provider.status === "BETA"
        ? "info"
        : provider.status === "COMING_SOON"
          ? "default"
          : "primary";

  const animationDelay = `${index * 30}ms`;

  if (layout === "list") {
    return (
      <Card
        className={cn(
          "flex items-center justify-between p-4 hover:border-blue-500 transition-all",
          isConnected && "border-emerald-500/30",
        )}
        style={{ animationDelay } as React.CSSProperties}
      >
        <div className={cn("flex-1 flex items-center gap-4 min-w-0")}>
          <div
            className={cn(
              "w-12 h-12 rounded-lg bg-wl-bg-elevated flex items-center justify-center flex-shrink-0",
            )}
          >
            <span className="text-xl">📦</span>
          </div>
          <div className={cn("flex-1 min-w-0")}>
            <h3 className={cn("text-sm font-semibold text-white")}>
              {provider.name}
            </h3>
            <p className={cn("text-xs text-wl-text-tertiary truncate")}>
              {provider.description}
            </p>
            <div className={cn("flex gap-2 mt-2 flex-wrap")}>
              <Badge variant="default" className="text-xs">
                {provider.category.replace(/_/g, " ")}
              </Badge>
              {provider.popular && <Badge variant="primary">Popular</Badge>}
            </div>
          </div>
        </div>
        <div className={cn("flex items-center gap-3 flex-shrink-0")}>
          <Badge variant={statusColor}>
            {provider.status.replace(/_/g, " ")}
          </Badge>
          <Link href={`/integrations/marketplace/${provider.slug}`}>
            <Button variant="secondary" size="sm">
              View
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/integrations/marketplace/${provider.slug}`}>
      <Card
        className={cn(
          "h-full flex flex-col hover:border-blue-500 cursor-pointer transition-all",
          isConnected && "border-emerald-500/30",
        )}
        style={{ animationDelay } as React.CSSProperties}
        hover
      >
        {/* Logo Area */}
        <div
          className={cn(
            "w-full h-24 bg-wl-bg-elevated rounded-lg mb-3 flex items-center justify-center",
          )}
        >
          <span className="text-3xl">📦</span>
        </div>

        {/* Content */}
        <div className={cn("flex-1 flex flex-col")}>
          <div className={cn("flex items-start justify-between gap-2 mb-2")}>
            <div>
              <h3 className={cn("text-sm font-semibold text-white")}>
                {provider.name}
              </h3>
              {provider.popular && (
                <Badge variant="primary" className="text-xs mt-1">
                  Popular
                </Badge>
              )}
            </div>
          </div>

          <p className={cn("text-xs text-wl-text-tertiary mb-3 line-clamp-2")}>
            {provider.description}
          </p>

          <Badge variant="default" className="mb-3 w-fit text-xs">
            {provider.category.replace(/_/g, " ")}
          </Badge>

          <Badge
            variant={statusColor}
            className={cn("mt-auto mb-3 w-fit text-xs")}
          >
            {provider.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Actions */}
        <div className={cn("flex gap-2 w-full")}>
          <Button variant="secondary" size="sm" className="flex-1">
            View Details
          </Button>
          {isConnected && (
            <Button variant="ghost" size="sm" className="flex-1">
              Manage
            </Button>
          )}
        </div>
      </Card>
    </Link>
  );
}
