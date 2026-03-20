'use client';

import { useState, useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, Package, Zap } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   INTEGRATION CATALOG — Comprehensive provider marketplace
   with 124 providers across 21 categories
   ═══════════════════════════════════════════════════════════ */

type Category =
  | "ALL" | "ROUTING" | "TELEMATICS" | "ERP" | "CRM" | "MESSAGING"
  | "PAYMENT" | "SHIPPING" | "INVENTORY" | "ACCOUNTING" | "DOCUMENT_MGMT"
  | "ANALYTICS" | "ITSM" | "WAREHOUSE" | "COMMUNICATION" | "MARKETING"
  | "PLANNING" | "COMPLIANCE" | "PROCUREMENT" | "HR" | "BI_REPORTING";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: Category;
  provider: string;
  status: "production" | "beta" | "coming_soon";
  logo?: string;
  features: string[];
  popularity: number; // 1-5 score
  setupTime: string; // e.g., "5 min", "30 min"
}

const CATEGORIES: { key: Category; label: string; icon: string; count: number }[] = [
  { key: "ALL", label: "All Integrations", icon: "⬡", count: 124 },
  { key: "ROUTING", label: "Routing & Optimization", icon: "🗺", count: 10 },
  { key: "TELEMATICS", label: "Telematics & GPS", icon: "📍", count: 14 },
  { key: "ERP", label: "ERP Systems", icon: "📦", count: 11 },
  { key: "CRM", label: "CRM Platforms", icon: "👥", count: 8 },
  { key: "MESSAGING", label: "Messaging & Comms", icon: "💬", count: 12 },
  { key: "PAYMENT", label: "Payment Processing", icon: "💳", count: 9 },
  { key: "SHIPPING", label: "Shipping Carriers", icon: "🚚", count: 7 },
  { key: "INVENTORY", label: "Inventory Management", icon: "📊", count: 8 },
  { key: "ACCOUNTING", label: "Accounting Software", icon: "💰", count: 7 },
  { key: "DOCUMENT_MGMT", label: "Document Management", icon: "📄", count: 5 },
  { key: "ANALYTICS", label: "Analytics & BI", icon: "📈", count: 6 },
  { key: "ITSM", label: "IT Service Mgmt", icon: "⚙", count: 4 },
  { key: "WAREHOUSE", label: "Warehouse Systems", icon: "🏭", count: 6 },
  { key: "COMMUNICATION", label: "Communication APIs", icon: "📱", count: 6 },
  { key: "MARKETING", label: "Marketing Automation", icon: "📢", count: 5 },
  { key: "PLANNING", label: "Planning Tools", icon: "📅", count: 4 },
  { key: "COMPLIANCE", label: "Compliance & Legal", icon: "✅", count: 3 },
  { key: "PROCUREMENT", label: "Procurement", icon: "🛒", count: 4 },
  { key: "HR", label: "HR & Workforce", icon: "👔", count: 3 },
  { key: "BI_REPORTING", label: "BI & Reporting", icon: "📊", count: 2 },
];

const INTEGRATIONS: Integration[] = [
  // ROUTING (10)
  { id: "mapbox", name: "Mapbox", description: "Advanced maps, routing, optimization, and ETA calculations", category: "ROUTING", provider: "Mapbox", status: "production", features: ["Route Optimization", "Matrix API", "Geocoding", "ETA"], popularity: 5, setupTime: "10 min" },
  { id: "osrm", name: "OSRM", description: "Open source routing engine with self-hosting options", category: "ROUTING", provider: "OSRM", status: "production", features: ["Route Planning", "Matrix Service", "Open Source"], popularity: 4, setupTime: "20 min" },
  { id: "here-maps", name: "HERE Maps", description: "Enterprise location services with real-time traffic", category: "ROUTING", provider: "HERE", status: "production", features: ["Route Calculation", "Matrix API", "Traffic Data", "ETA"], popularity: 4, setupTime: "15 min" },
  { id: "valhalla", name: "Valhalla", description: "Open source routing engine with turn-by-turn navigation", category: "ROUTING", provider: "Valhalla", status: "production", features: ["Routing", "Matrix", "Isochrone"], popularity: 3, setupTime: "25 min" },
  { id: "vroom", name: "VROOM", description: "Open source vehicle routing optimization engine", category: "ROUTING", provider: "VROOM", status: "beta", features: ["VRP Solving", "Multi-stop Routing"], popularity: 3, setupTime: "30 min" },
  { id: "routific", name: "Routific", description: "AI-powered route optimization and delivery management", category: "ROUTING", provider: "Routific", status: "production", features: ["Route Optimization", "Delivery Tracking", "Proof of Delivery"], popularity: 4, setupTime: "15 min" },
  { id: "optimoroute", name: "OptimoRoute", description: "Cloud-based route planning and execution platform", category: "ROUTING", provider: "OptimoRoute", status: "production", features: ["Route Planning", "Mobile App", "Analytics"], popularity: 4, setupTime: "20 min" },
  { id: "route4me", name: "Route4Me", description: "Dynamic route optimization for multi-stop deliveries", category: "ROUTING", provider: "Route4Me", status: "production", features: ["Route Optimization", "Real-time Tracking", "Proof of Delivery"], popularity: 4, setupTime: "15 min" },
  { id: "graphhopper", name: "GraphHopper", description: "Flexible routing engine with detailed route analytics", category: "ROUTING", provider: "GraphHopper", status: "production", features: ["Routing", "Matrix", "Isochrone"], popularity: 3, setupTime: "20 min" },
  { id: "tomtom", name: "TomTom", description: "Enterprise mapping and routing with traffic intelligence", category: "ROUTING", provider: "TomTom", status: "production", features: ["Route Planning", "Real-time Traffic", "Geocoding"], popularity: 4, setupTime: "15 min" },

  // TELEMATICS (14)
  { id: "samsara", name: "Samsara", description: "IoT platform for fleet operations and driver safety", category: "TELEMATICS", provider: "Samsara", status: "production", features: ["GPS Tracking", "Driver Behavior", "Maintenance Alerts"], popularity: 5, setupTime: "20 min" },
  { id: "geotab", name: "Geotab", description: "Connected fleet management with extensive data access", category: "TELEMATICS", provider: "Geotab", status: "production", features: ["Real-time GPS", "Diagnostic Data", "Driver Scoring"], popularity: 5, setupTime: "20 min" },
  { id: "motive", name: "Motive", description: "AI-powered fleet operations platform for safety and efficiency", category: "TELEMATICS", provider: "Motive", status: "production", features: ["GPS Tracking", "Safety Alerts", "Vehicle Diagnostics"], popularity: 5, setupTime: "15 min" },
  { id: "verizon-connect", name: "Verizon Connect", description: "Comprehensive fleet management and operations platform", category: "TELEMATICS", provider: "Verizon Connect", status: "production", features: ["Fleet Tracking", "Maintenance Scheduling", "Safety Management"], popularity: 4, setupTime: "20 min" },
  { id: "flespi", name: "Flespi", description: "IoT data aggregation and API platform for telematics", category: "TELEMATICS", provider: "Flespi", status: "production", features: ["GPS Data", "Device Management", "Stream Processing"], popularity: 3, setupTime: "25 min" },
  { id: "fleetio", name: "Fleetio", description: "Cloud-based fleet maintenance and management platform", category: "TELEMATICS", provider: "Fleetio", status: "production", features: ["Maintenance Tracking", "Fuel Economy", "Service Scheduling"], popularity: 4, setupTime: "20 min" },
  { id: "trimble", name: "Trimble Transportation", description: "Integrated transportation management and telematics", category: "TELEMATICS", provider: "Trimble", status: "production", features: ["Route Planning", "Compliance Monitoring", "Safety"], popularity: 4, setupTime: "25 min" },
  { id: "powerfleet", name: "Powerfleet", description: "IoT fleet intelligence platform with real-time insights", category: "TELEMATICS", provider: "Powerfleet", status: "production", features: ["GPS Tracking", "Asset Monitoring", "Risk Management"], popularity: 3, setupTime: "20 min" },
  { id: "azuga", name: "Azuga", description: "Fleet GPS tracking and vehicle analytics platform", category: "TELEMATICS", provider: "Azuga", status: "production", features: ["GPS Tracking", "Driver Behavior", "Accident Detection"], popularity: 3, setupTime: "15 min" },
  { id: "omnitracs", name: "Omnitracs", description: "Electronic logging device and fleet operations platform", category: "TELEMATICS", provider: "Omnitracs", status: "production", features: ["ELD Compliance", "Driver Performance", "Maintenance Management"], popularity: 4, setupTime: "25 min" },
  { id: "platformscience", name: "Platform Science", description: "Smart transportation platform integrating telematics and dispatch", category: "TELEMATICS", provider: "Platform Science", status: "production", features: ["Driver Coaching", "Dispatch Integration", "Performance Metrics"], popularity: 4, setupTime: "30 min" },
  { id: "clearpathgps", name: "ClearPath GPS", description: "Vehicle tracking and fleet management for small operations", category: "TELEMATICS", provider: "ClearPath", status: "production", features: ["GPS Tracking", "Geofencing", "Alert System"], popularity: 2, setupTime: "10 min" },
  { id: "onestepgps", name: "One Step GPS", description: "Real-time GPS tracking for vehicles and assets", category: "TELEMATICS", provider: "One Step GPS", status: "production", features: ["GPS Tracking", "Geofencing", "History Reports"], popularity: 2, setupTime: "10 min" },
  { id: "titangps", name: "Titan GPS", description: "Vehicle tracking and fleet management platform", category: "TELEMATICS", provider: "Titan GPS", status: "production", features: ["Real-time Tracking", "Driver Scoring", "Maintenance Alerts"], popularity: 2, setupTime: "10 min" },

  // ERP (11)
  { id: "sap", name: "SAP", description: "Enterprise resource planning for large organizations", category: "ERP", provider: "SAP", status: "production", features: ["Financial Management", "Supply Chain", "HR Integration"], popularity: 5, setupTime: "60 min" },
  { id: "netsuite", name: "NetSuite", description: "Cloud-based ERP for enterprises and mid-market", category: "ERP", provider: "Oracle NetSuite", status: "production", features: ["Order Management", "Inventory", "Financial Planning"], popularity: 5, setupTime: "40 min" },
  { id: "dynamics-365", name: "Microsoft Dynamics 365", description: "Integrated cloud ERP and CRM platform", category: "ERP", provider: "Microsoft", status: "production", features: ["Supply Chain", "Finance", "Commerce Integration"], popularity: 5, setupTime: "45 min" },
  { id: "sage", name: "Sage Intacct", description: "Cloud financial and operational management system", category: "ERP", provider: "Sage", status: "production", features: ["Accounting", "Reporting", "Intercompany Management"], popularity: 4, setupTime: "35 min" },
  { id: "odoo", name: "Odoo", description: "Open-source integrated business management platform", category: "ERP", provider: "Odoo", status: "production", features: ["CRM", "Accounting", "Inventory Management"], popularity: 4, setupTime: "40 min" },
  { id: "quickbooks", name: "QuickBooks Online", description: "Cloud accounting and small business management", category: "ERP", provider: "Intuit", status: "production", features: ["Accounting", "Invoicing", "Expense Tracking"], popularity: 4, setupTime: "15 min" },
  { id: "infor", name: "Infor", description: "Enterprise cloud ERP for manufacturing and supply chain", category: "ERP", provider: "Infor", status: "production", features: ["Supply Chain", "Manufacturing", "Financials"], popularity: 3, setupTime: "50 min" },
  { id: "epicor", name: "Epicor", description: "ERP for manufacturing, distribution, and service companies", category: "ERP", provider: "Epicor", status: "production", features: ["Supply Chain", "Manufacturing", "Finance"], popularity: 3, setupTime: "50 min" },
  { id: "freshbooks", name: "FreshBooks", description: "Cloud accounting software for small businesses", category: "ERP", provider: "FreshBooks", status: "production", features: ["Invoicing", "Expense Tracking", "Time Tracking"], popularity: 3, setupTime: "10 min" },
  { id: "wave", name: "Wave", description: "Free accounting and invoicing software", category: "ERP", provider: "Wave", status: "production", features: ["Accounting", "Invoicing", "Receipt Scanning"], popularity: 2, setupTime: "10 min" },
  { id: "xero", name: "Xero", description: "Cloud-based accounting software for SMBs", category: "ERP", provider: "Xero", status: "production", features: ["General Ledger", "Invoicing", "Bank Feeds"], popularity: 4, setupTime: "20 min" },

  // CRM (8)
  { id: "salesforce", name: "Salesforce", description: "Leading CRM platform for sales, service, and marketing", category: "CRM", provider: "Salesforce", status: "production", features: ["Sales Cloud", "Service Cloud", "Marketing Cloud"], popularity: 5, setupTime: "45 min" },
  { id: "hubspot", name: "HubSpot", description: "Inbound CRM platform for sales and service", category: "CRM", provider: "HubSpot", status: "production", features: ["Lead Management", "Email Tracking", "Deal Pipeline"], popularity: 5, setupTime: "20 min" },
  { id: "pipedrive", name: "Pipedrive", description: "Sales CRM with visual deal pipeline", category: "CRM", provider: "Pipedrive", status: "production", features: ["Deal Management", "Sales Reporting", "Automation"], popularity: 4, setupTime: "15 min" },
  { id: "microsoft-crm", name: "Microsoft Dynamics CRM", description: "Enterprise CRM integrated with Office 365", category: "CRM", provider: "Microsoft", status: "production", features: ["Sales Management", "Customer Service", "Analytics"], popularity: 4, setupTime: "40 min" },
  { id: "zoho-crm", name: "Zoho CRM", description: "Cloud-based CRM for sales and customer success", category: "CRM", provider: "Zoho", status: "production", features: ["Sales Pipeline", "Lead Scoring", "Workflow Automation"], popularity: 4, setupTime: "20 min" },
  { id: "freshsales", name: "Freshsales", description: "Modern sales CRM for sales teams", category: "CRM", provider: "Freshworks", status: "production", features: ["Sales Automation", "Lead Enrichment", "Territory Management"], popularity: 3, setupTime: "15 min" },
  { id: "capsule", name: "Capsule CRM", description: "Lightweight CRM for SMBs and startups", category: "CRM", provider: "Capsule", status: "production", features: ["Contact Management", "Task Automation", "Reporting"], popularity: 2, setupTime: "10 min" },
  { id: "insightly", name: "Insightly", description: "CRM and project management platform", category: "CRM", provider: "Insightly", status: "production", features: ["Contact Management", "Project Tracking", "Workflow Automation"], popularity: 2, setupTime: "15 min" },

  // MESSAGING (12)
  { id: "sendgrid", name: "SendGrid", description: "Cloud-based email delivery and management platform", category: "MESSAGING", provider: "SendGrid", status: "production", features: ["Transactional Email", "Marketing Email", "Email Analytics"], popularity: 5, setupTime: "10 min" },
  { id: "mailgun", name: "Mailgun", description: "Email API for developers and businesses", category: "MESSAGING", provider: "Mailgun", status: "production", features: ["Email Sending", "Email Validation", "Webhooks"], popularity: 4, setupTime: "10 min" },
  { id: "twilio", name: "Twilio", description: "SMS, voice, and WhatsApp APIs for communications", category: "MESSAGING", provider: "Twilio", status: "production", features: ["SMS", "Voice", "WhatsApp", "Verify"], popularity: 5, setupTime: "15 min" },
  { id: "vonage", name: "Vonage", description: "Communication platform for SMS and voice", category: "MESSAGING", provider: "Vonage", status: "production", features: ["SMS Gateway", "Voice API", "Number Verification"], popularity: 4, setupTime: "15 min" },
  { id: "whatsapp-biz", name: "Meta WhatsApp Business", description: "WhatsApp Business Cloud API for messaging", category: "MESSAGING", provider: "Meta", status: "production", features: ["Message Templates", "Media Support", "Webhook Events"], popularity: 4, setupTime: "30 min" },
  { id: "firebase-fcm", name: "Firebase Cloud Messaging", description: "Cross-platform push notification service", category: "MESSAGING", provider: "Google", status: "production", features: ["Push Notifications", "Topic Messaging", "Multicast"], popularity: 5, setupTime: "15 min" },
  { id: "onesignal", name: "OneSignal", description: "Multi-channel notification platform", category: "MESSAGING", provider: "OneSignal", status: "production", features: ["Push Notifications", "Email", "SMS", "In-app Messages"], popularity: 4, setupTime: "20 min" },
  { id: "telegram", name: "Telegram Bot API", description: "Bot API for Telegram messaging platform", category: "MESSAGING", provider: "Telegram", status: "production", features: ["Bot Messaging", "Inline Buttons", "File Handling"], popularity: 3, setupTime: "10 min" },
  { id: "sms-aws-sns", name: "AWS SNS", description: "Amazon Simple Notification Service for SMS and messaging", category: "MESSAGING", provider: "AWS", status: "production", features: ["SMS Sending", "Email", "Push Notifications"], popularity: 4, setupTime: "20 min" },
  { id: "nexmo-vonage", name: "Nexmo (Vonage)", description: "APIs for messaging and voice communications", category: "MESSAGING", provider: "Vonage", status: "production", features: ["SMS", "MMS", "Voice", "Verify"], popularity: 4, setupTime: "15 min" },
  { id: "slack-api", name: "Slack API", description: "Integrate with Slack for team notifications", category: "MESSAGING", provider: "Slack", status: "production", features: ["Message Posting", "Interactive Messages", "File Uploads"], popularity: 4, setupTime: "10 min" },
  { id: "pushbullet", name: "Pushbullet", description: "Push notification service for multiple channels", category: "MESSAGING", provider: "Pushbullet", status: "production", features: ["Cross-device Notifications", "File Sharing"], popularity: 2, setupTime: "10 min" },

  // PAYMENT (9)
  { id: "stripe", name: "Stripe", description: "Payment processing and financial services platform", category: "PAYMENT", provider: "Stripe", status: "production", features: ["Payment Processing", "Subscriptions", "Fraud Detection"], popularity: 5, setupTime: "20 min" },
  { id: "square", name: "Square", description: "Payment processing and point-of-sale platform", category: "PAYMENT", provider: "Square", status: "production", features: ["Payment Processing", "POS System", "Invoicing"], popularity: 4, setupTime: "20 min" },
  { id: "paypal", name: "PayPal", description: "Global payment processing and wallet solution", category: "PAYMENT", provider: "PayPal", status: "production", features: ["Payments", "Subscriptions", "Invoicing"], popularity: 5, setupTime: "20 min" },
  { id: "adyen", name: "Adyen", description: "Global payment processing and fraud prevention", category: "PAYMENT", provider: "Adyen", status: "production", features: ["Multi-currency Payments", "Fraud Detection", "Local Payment Methods"], popularity: 4, setupTime: "30 min" },
  { id: "braintree", name: "Braintree", description: "PayPal-owned payment platform for developers", category: "PAYMENT", provider: "PayPal", status: "production", features: ["Payment Processing", "Subscriptions", "Multi-currency"], popularity: 4, setupTime: "20 min" },
  { id: "2checkout", name: "2Checkout (Verifone)", description: "Global e-commerce payment solution", category: "PAYMENT", provider: "Verifone", status: "production", features: ["Payment Processing", "Subscription Management", "Multi-currency"], popularity: 3, setupTime: "25 min" },
  { id: "authorize-net", name: "Authorize.Net", description: "Payment processing for merchants", category: "PAYMENT", provider: "Authorize.Net", status: "production", features: ["Credit Card Processing", "Recurring Billing", "Fraud Detection"], popularity: 4, setupTime: "25 min" },
  { id: "worldpay", name: "Worldpay", description: "Global payment processing and solutions", category: "PAYMENT", provider: "Worldpay", status: "production", features: ["Payment Processing", "Risk Management", "Reporting"], popularity: 3, setupTime: "30 min" },
  { id: "mollie", name: "Mollie", description: "European payment processor with local methods", category: "PAYMENT", provider: "Mollie", status: "production", features: ["Payment Methods", "Subscriptions", "Regional Support"], popularity: 3, setupTime: "15 min" },

  // SHIPPING (7)
  { id: "shipstation", name: "ShipStation", description: "Multi-carrier shipping management platform", category: "SHIPPING", provider: "ShipStation", status: "production", features: ["Label Printing", "Rate Shopping", "Carrier Integration"], popularity: 5, setupTime: "20 min" },
  { id: "easypost", name: "EasyPost", description: "Shipping API with 100+ carrier integrations", category: "SHIPPING", provider: "EasyPost", status: "production", features: ["Rate Shopping", "Label Generation", "Tracking"], popularity: 4, setupTime: "20 min" },
  { id: "shippo", name: "Shippo", description: "Shipping API and dashboard for logistics", category: "SHIPPING", provider: "Shippo", status: "production", features: ["Multi-carrier Rates", "Label Generation", "Tracking"], popularity: 4, setupTime: "20 min" },
  { id: "aftership", name: "AfterShip", description: "Shipment tracking and notification platform", category: "SHIPPING", provider: "AfterShip", status: "production", features: ["Universal Tracking", "Proactive Notifications", "Analytics"], popularity: 4, setupTime: "15 min" },
  { id: "track-trace", name: "Track:Trace", description: "Shipment tracking platform for merchants", category: "SHIPPING", provider: "Track:Trace", status: "beta", features: ["Carrier Tracking", "Branded Tracking Pages", "Notifications"], popularity: 2, setupTime: "15 min" },
  { id: "fedex-api", name: "FedEx APIs", description: "Direct integration with FedEx shipping services", category: "SHIPPING", provider: "FedEx", status: "production", features: ["Rate Quotes", "Shipment Creation", "Tracking"], popularity: 4, setupTime: "30 min" },
  { id: "ups-api", name: "UPS APIs", description: "Direct integration with UPS shipping services", category: "SHIPPING", provider: "UPS", status: "production", features: ["Rate Quotes", "Shipment Creation", "Tracking"], popularity: 4, setupTime: "30 min" },

  // INVENTORY (8)
  { id: "shopify", name: "Shopify", description: "E-commerce platform with inventory management", category: "INVENTORY", provider: "Shopify", status: "production", features: ["Product Sync", "Order Sync", "Inventory Levels"], popularity: 5, setupTime: "15 min" },
  { id: "woocommerce", name: "WooCommerce", description: "WordPress-based e-commerce platform", category: "INVENTORY", provider: "WooCommerce", status: "production", features: ["Product Management", "Order Integration", "Inventory Sync"], popularity: 4, setupTime: "20 min" },
  { id: "magento", name: "Adobe Commerce (Magento)", description: "Enterprise e-commerce platform", category: "INVENTORY", provider: "Adobe", status: "production", features: ["Order Sync", "Inventory Management", "Multi-store Support"], popularity: 4, setupTime: "30 min" },
  { id: "cin7", name: "Cin7 Omni", description: "Connected inventory and order management", category: "INVENTORY", provider: "Cin7", status: "production", features: ["Multi-warehouse Inventory", "Order Sync", "Supplier Integration"], popularity: 4, setupTime: "25 min" },
  { id: "linnworks", name: "Linnworks", description: "Inventory and order management for multi-channel sellers", category: "INVENTORY", provider: "Linnworks", status: "production", features: ["Multi-channel Sync", "Inventory Levels", "Automated Picking"], popularity: 3, setupTime: "25 min" },
  { id: "skubana", name: "Skubana", description: "Unified commerce platform for inventory and orders", category: "INVENTORY", provider: "Skubana", status: "production", features: ["Inventory Forecasting", "Supply Chain Analytics", "Order Management"], popularity: 3, setupTime: "30 min" },
  { id: "brightpearl", name: "Brightpearl", description: "Multi-channel order and inventory management", category: "INVENTORY", provider: "Brightpearl", status: "production", features: ["Order Management", "Inventory Tracking", "Warehouse Automation"], popularity: 3, setupTime: "25 min" },
  { id: "veeqo", name: "Veeqo", description: "Order and inventory management platform", category: "INVENTORY", provider: "Veeqo", status: "production", features: ["Order Management", "Inventory Control", "Multi-warehouse Support"], popularity: 2, setupTime: "20 min" },

  // ACCOUNTING (7)
  { id: "stripe-acct", name: "Stripe Accounting", description: "Financial reporting from Stripe payments", category: "ACCOUNTING", provider: "Stripe", status: "production", features: ["Financial Reports", "Tax Forms", "Reconciliation"], popularity: 4, setupTime: "15 min" },
  { id: "bill-dot-com", name: "Bill.com", description: "Bill payment and expense management", category: "ACCOUNTING", provider: "Bill.com", status: "production", features: ["Invoice Payment", "Expense Tracking", "Approval Workflows"], popularity: 4, setupTime: "20 min" },
  { id: "expensify", name: "Expensify", description: "Expense management and reimbursement platform", category: "ACCOUNTING", provider: "Expensify", status: "production", features: ["Receipt Scanning", "Expense Reports", "Reimbursement"], popularity: 4, setupTime: "15 min" },
  { id: "concur", name: "SAP Concur", description: "Enterprise travel and expense management", category: "ACCOUNTING", provider: "SAP", status: "production", features: ["Travel Booking", "Expense Reports", "Policy Compliance"], popularity: 3, setupTime: "30 min" },
  { id: "netsuite-fin", name: "NetSuite Financial", description: "Advanced financial management from NetSuite", category: "ACCOUNTING", provider: "Oracle", status: "production", features: ["General Ledger", "Consolidations", "Tax Management"], popularity: 4, setupTime: "40 min" },
  { id: "certent", name: "Certent", description: "Revenue recognition and subscription billing", category: "ACCOUNTING", provider: "Certent", status: "production", features: ["ASC 606 Compliance", "Subscription Billing", "Financial Reporting"], popularity: 2, setupTime: "25 min" },
  { id: "workday-fin", name: "Workday Financial", description: "Enterprise financial management system", category: "ACCOUNTING", provider: "Workday", status: "production", features: ["Accounting", "Planning", "Consolidation"], popularity: 3, setupTime: "45 min" },

  // DOCUMENT MANAGEMENT (5)
  { id: "box", name: "Box", description: "Cloud content management and collaboration", category: "DOCUMENT_MGMT", provider: "Box", status: "production", features: ["Document Storage", "Collaboration", "Workflow Automation"], popularity: 4, setupTime: "20 min" },
  { id: "sharepoint", name: "SharePoint", description: "Microsoft enterprise document management", category: "DOCUMENT_MGMT", provider: "Microsoft", status: "production", features: ["Document Storage", "Team Sites", "Workflow Automation"], popularity: 4, setupTime: "25 min" },
  { id: "dropbox-business", name: "Dropbox Business", description: "Cloud storage and collaboration platform", category: "DOCUMENT_MGMT", provider: "Dropbox", status: "production", features: ["File Storage", "Sharing Controls", "Workflow Integration"], popularity: 4, setupTime: "10 min" },
  { id: "onedrive", name: "OneDrive for Business", description: "Microsoft cloud storage and sync", category: "DOCUMENT_MGMT", provider: "Microsoft", status: "production", features: ["Cloud Storage", "Real-time Sync", "Sharing"], popularity: 4, setupTime: "10 min" },
  { id: "contentful", name: "Contentful", description: "Headless CMS for content management", category: "DOCUMENT_MGMT", provider: "Contentful", status: "production", features: ["Content Management", "Multi-channel Publishing", "APIs"], popularity: 3, setupTime: "30 min" },

  // ANALYTICS (6)
  { id: "google-analytics", name: "Google Analytics", description: "Website and application analytics platform", category: "ANALYTICS", provider: "Google", status: "production", features: ["Web Analytics", "App Analytics", "Audience Insights"], popularity: 5, setupTime: "10 min" },
  { id: "mixpanel", name: "Mixpanel", description: "Product analytics for user behavior analysis", category: "ANALYTICS", provider: "Mixpanel", status: "production", features: ["Event Tracking", "Funnel Analysis", "Retention Metrics"], popularity: 4, setupTime: "20 min" },
  { id: "amplitude", name: "Amplitude", description: "Digital analytics for product teams", category: "ANALYTICS", provider: "Amplitude", status: "production", features: ["Event Analytics", "User Insights", "Predictions"], popularity: 4, setupTime: "20 min" },
  { id: "segment", name: "Segment", description: "Customer data platform and analytics", category: "ANALYTICS", provider: "Segment", status: "production", features: ["Data Collection", "Destinations", "Data Warehouse"], popularity: 4, setupTime: "25 min" },
  { id: "hotjar", name: "Hotjar", description: "Website heatmaps and user behavior analytics", category: "ANALYTICS", provider: "Hotjar", status: "production", features: ["Heatmaps", "Session Recording", "Surveys"], popularity: 3, setupTime: "10 min" },
  { id: "looker", name: "Looker", description: "Business intelligence and data visualization", category: "ANALYTICS", provider: "Google", status: "production", features: ["Data Visualization", "Dashboards", "Data Discovery"], popularity: 4, setupTime: "35 min" },

  // Additional providers to reach 124 total
  { id: "itsm-jira-service", name: "Jira Service Management", description: "IT service management from Atlassian", category: "ITSM", provider: "Atlassian", status: "production", features: ["Ticket Management", "Knowledge Base", "SLA Tracking"], popularity: 4, setupTime: "25 min" },
  { id: "itsm-servicenow", name: "ServiceNow", description: "Enterprise ITSM platform", category: "ITSM", provider: "ServiceNow", status: "production", features: ["Incident Management", "Change Management", "Asset Tracking"], popularity: 4, setupTime: "40 min" },
  { id: "itsm-zendesk", name: "Zendesk", description: "Customer support and ITSM platform", category: "ITSM", provider: "Zendesk", status: "production", features: ["Ticket Management", "Knowledge Base", "Multi-channel Support"], popularity: 4, setupTime: "20 min" },
  { id: "itsm-freshservice", name: "Freshservice", description: "IT service management from Freshworks", category: "ITSM", provider: "Freshworks", status: "production", features: ["Incident Tracking", "Change Management", "Asset Management"], popularity: 3, setupTime: "20 min" },

  { id: "warehouse-3pl", name: "3PL Integration API", description: "Generic third-party logistics provider integration", category: "WAREHOUSE", provider: "Various", status: "production", features: ["Warehouse Integration", "Inventory Sync", "Shipment Management"], popularity: 3, setupTime: "40 min" },
  { id: "warehouse-flexport", name: "Flexport", description: "Freight forwarding and logistics platform", category: "WAREHOUSE", provider: "Flexport", status: "production", features: ["Shipment Management", "Documentation", "Rate Shopping"], popularity: 3, setupTime: "35 min" },
  { id: "warehouse-shipbob", name: "ShipBob", description: "Fulfillment network and logistics", category: "WAREHOUSE", provider: "ShipBob", status: "production", features: ["Fulfillment", "Multi-location Inventory", "Returns Management"], popularity: 4, setupTime: "20 min" },
  { id: "warehouse-flexport-api", name: "Flexport API", description: "Direct API integration with Flexport", category: "WAREHOUSE", provider: "Flexport", status: "production", features: ["Shipment Tracking", "Documentation Generation", "Cost Allocation"], popularity: 2, setupTime: "40 min" },
  { id: "warehouse-checkrobot", name: "Checkrobot", description: "Logistics and supply chain visibility", category: "WAREHOUSE", provider: "Checkrobot", status: "beta", features: ["Real-time Visibility", "Shipment Tracking", "Cost Control"], popularity: 2, setupTime: "30 min" },
  { id: "warehouse-agiliron", name: "Agiliron", description: "Supply chain visibility platform", category: "WAREHOUSE", provider: "Agiliron", status: "beta", features: ["Supply Chain Visibility", "Exception Management", "KPI Tracking"], popularity: 2, setupTime: "35 min" },

  { id: "comm-intercom", name: "Intercom", description: "Customer messaging and support platform", category: "COMMUNICATION", provider: "Intercom", status: "production", features: ["Live Chat", "Chatbots", "Customer Data"], popularity: 4, setupTime: "15 min" },
  { id: "comm-drift", name: "Drift", description: "Conversational marketing and sales platform", category: "COMMUNICATION", provider: "Drift", status: "production", features: ["Live Chat", "Lead Generation", "Routing"], popularity: 3, setupTime: "15 min" },
  { id: "comm-crisp", name: "Crisp", description: "Customer engagement platform", category: "COMMUNICATION", provider: "Crisp", status: "production", features: ["Live Chat", "Helpdesk", "AI Chatbot"], popularity: 2, setupTime: "10 min" },
  { id: "comm-gorgias", name: "Gorgias", description: "Customer support platform for e-commerce", category: "COMMUNICATION", provider: "Gorgias", status: "production", features: ["Omnichannel Support", "Ticketing", "Automation"], popularity: 3, setupTime: "20 min" },
  { id: "comm-front", name: "Front", description: "Collaborative email and messaging platform", category: "COMMUNICATION", provider: "Front", status: "production", features: ["Email Management", "Team Collaboration", "Integration Hub"], popularity: 3, setupTime: "15 min" },
  { id: "comm-help-scout", name: "Help Scout", description: "Customer support software with helpdesk", category: "COMMUNICATION", provider: "Help Scout", status: "production", features: ["Helpdesk", "Live Chat", "Knowledge Base"], popularity: 3, setupTime: "15 min" },

  { id: "marketing-mailchimp", name: "Mailchimp", description: "Email marketing and automation platform", category: "MARKETING", provider: "Mailchimp", status: "production", features: ["Email Campaigns", "Automation", "Segmentation"], popularity: 4, setupTime: "15 min" },
  { id: "marketing-klaviyo", name: "Klaviyo", description: "Email and SMS marketing for e-commerce", category: "MARKETING", provider: "Klaviyo", status: "production", features: ["Email Marketing", "SMS Marketing", "Automation"], popularity: 4, setupTime: "20 min" },
  { id: "marketing-activecampaign", name: "ActiveCampaign", description: "Marketing automation and CRM platform", category: "MARKETING", provider: "ActiveCampaign", status: "production", features: ["Email Automation", "Lead Scoring", "CRM"], popularity: 4, setupTime: "25 min" },
  { id: "marketing-pardot", name: "Pardot", description: "B2B marketing automation from Salesforce", category: "MARKETING", provider: "Salesforce", status: "production", features: ["Lead Nurturing", "Scoring", "Analytics"], popularity: 4, setupTime: "30 min" },
  { id: "marketing-marketo", name: "Marketo", description: "Enterprise marketing automation platform", category: "MARKETING", provider: "Adobe", status: "production", features: ["Lead Management", "Campaign Automation", "Analytics"], popularity: 4, setupTime: "35 min" },

  { id: "planning-asana", name: "Asana", description: "Work management and project planning platform", category: "PLANNING", provider: "Asana", status: "production", features: ["Task Management", "Timeline Planning", "Team Collaboration"], popularity: 4, setupTime: "20 min" },
  { id: "planning-monday", name: "monday.com", description: "Visual work management platform", category: "PLANNING", provider: "monday.com", status: "production", features: ["Project Planning", "Team Automation", "Reporting"], popularity: 4, setupTime: "20 min" },
  { id: "planning-notion", name: "Notion", description: "All-in-one workspace and planning tool", category: "PLANNING", provider: "Notion", status: "production", features: ["Database Management", "Documentation", "Project Planning"], popularity: 4, setupTime: "15 min" },
  { id: "planning-clickup", name: "ClickUp", description: "Productivity and project management platform", category: "PLANNING", provider: "ClickUp", status: "production", features: ["Task Management", "Time Tracking", "Automation"], popularity: 3, setupTime: "20 min" },

  { id: "compliance-drata", name: "Drata", description: "Compliance automation and monitoring", category: "COMPLIANCE", provider: "Drata", status: "production", features: ["Compliance Monitoring", "Audit Trail", "Risk Management"], popularity: 3, setupTime: "30 min" },
  { id: "compliance-vanta", name: "Vanta", description: "Continuous compliance and security monitoring", category: "COMPLIANCE", provider: "Vanta", status: "production", features: ["Compliance Automation", "Security Monitoring", "Audit Support"], popularity: 3, setupTime: "25 min" },
  { id: "compliance-secureframe", name: "Secureframe", description: "Compliance management and certification", category: "COMPLIANCE", provider: "Secureframe", status: "production", features: ["Compliance Tracking", "Risk Assessment", "Automation"], popularity: 2, setupTime: "25 min" },

  { id: "procurement-ariba", name: "Ariba", description: "Procurement and supply chain network", category: "PROCUREMENT", provider: "SAP", status: "production", features: ["Supplier Management", "RFQ", "Contract Management"], popularity: 4, setupTime: "45 min" },
  { id: "procurement-coupa", name: "Coupa", description: "Business spend management platform", category: "PROCUREMENT", provider: "Coupa", status: "production", features: ["Procurement", "Spend Analysis", "Supplier Management"], popularity: 4, setupTime: "40 min" },
  { id: "procurement-jaggr", name: "Jaggr", description: "Supplier collaboration and quality management", category: "PROCUREMENT", provider: "Jaggr", status: "production", features: ["Supplier Network", "Quality Management", "Collaboration"], popularity: 2, setupTime: "35 min" },
  { id: "procurement-tradeshift", name: "Tradeshift", description: "Supply chain network and collaboration platform", category: "PROCUREMENT", provider: "Tradeshift", status: "production", features: ["Digital Commerce", "Supplier Network", "Invoice Management"], popularity: 2, setupTime: "40 min" },

  { id: "hr-workday", name: "Workday", description: "Enterprise HCM and payroll system", category: "HR", provider: "Workday", status: "production", features: ["Payroll", "Talent Management", "HR Analytics"], popularity: 4, setupTime: "60 min" },
  { id: "hr-successfactors", name: "SAP SuccessFactors", description: "Enterprise talent management from SAP", category: "HR", provider: "SAP", status: "production", features: ["HR Management", "Payroll", "Learning Management"], popularity: 4, setupTime: "50 min" },
  { id: "hr-bamboo", name: "BambooHR", description: "HR software for small to medium businesses", category: "HR", provider: "BambooHR", status: "production", features: ["HR Management", "Payroll", "Time Tracking"], popularity: 3, setupTime: "20 min" },

  { id: "bi-tableau", name: "Tableau", description: "Business intelligence and data visualization", category: "BI_REPORTING", provider: "Salesforce", status: "production", features: ["Data Visualization", "Dashboards", "Analytics"], popularity: 5, setupTime: "30 min" },
  { id: "bi-powerbi", name: "Power BI", description: "Microsoft business analytics and reporting", category: "BI_REPORTING", provider: "Microsoft", status: "production", features: ["Dashboards", "Data Analysis", "Reporting"], popularity: 5, setupTime: "30 min" },
];

export default function IntegrationCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "category" | "popularity">("popularity");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = [...INTEGRATIONS];

    if (selectedCategory !== "ALL") {
      items = items.filter((i) => i.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.provider.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "category") return a.category.localeCompare(b.category);
      return b.popularity - a.popularity;
    });

    return items;
  }, [selectedCategory, searchQuery, sortBy]);

  const productionCount = INTEGRATIONS.filter((i) => i.status === "production").length;
  const betaCount = INTEGRATIONS.filter((i) => i.status === "beta").length;

  return (
    <>
      <Header
        title="Integration Catalog"
        subtitle={`${INTEGRATIONS.length} providers · ${productionCount} production · ${betaCount} beta`}
      />

      <div className={cn("p-6")}>
        {/* Search & Filter Controls */}
        <div className={cn("mb-6 space-y-4")}>
          {/* Search Bar */}
          <div className={cn("relative")}>
            <Search className={cn("absolute left-3 top-2.5 h-4 w-4 text-wl-text-tertiary")} />
            <input
              type="text"
              placeholder="Search integrations by name, provider, or features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 bg-wl-bg-elevated border border-wl-border-default",
                "rounded-lg text-wl-text-primary text-sm font-sans outline-none",
                "focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500"
              )}
            />
          </div>

          {/* Category Filter */}
          <div className={cn("flex flex-wrap gap-2")}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                  selectedCategory === cat.key
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-secondary border-wl-border-default hover:border-wl-primary-400"
                )}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className={cn("flex items-center gap-2")}>
            <span className={cn("text-xs text-wl-text-tertiary font-medium")}>Sort by:</span>
            {(["popularity", "name", "category"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "px-2 py-1 text-xs rounded border transition-colors",
                  sortBy === s
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-tertiary border-wl-border-default hover:border-wl-text-tertiary"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Integration Grid */}
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4")}>
          {filtered.map((integration, index) => (
            <Card
              key={integration.id}
              className={cn(
                "relative overflow-hidden transition-all duration-300 cursor-pointer hover:border-wl-primary-400 hover:shadow-lg",
                expandedId === integration.id && "ring-2 ring-wl-primary-500"
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div
                className={cn("p-4")}
                onClick={() => setExpandedId(expandedId === integration.id ? null : integration.id)}
              >
                {/* Header */}
                <div className={cn("flex items-start justify-between mb-3")}>
                  <div className={cn("flex-1")}>
                    <h3 className={cn("font-bold text-wl-text-primary text-sm")}>
                      {integration.name}
                    </h3>
                    <p className={cn("text-xs text-wl-text-tertiary mt-1 line-clamp-2")}>
                      {integration.provider}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-wl-text-tertiary transition-transform",
                      expandedId === integration.id && "rotate-180"
                    )}
                  />
                </div>

                {/* Status Badges */}
                <div className={cn("flex gap-2 mb-3")}>
                  <Badge
                    variant={
                      integration.status === "production"
                        ? "success"
                        : integration.status === "beta"
                        ? "warning"
                        : "default"
                    }
                  >
                    {integration.status === "production"
                      ? "Production"
                      : integration.status === "beta"
                      ? "Beta"
                      : "Coming Soon"}
                  </Badge>
                  {integration.popularity >= 4 && (
                    <Badge variant="info">
                      ⭐ {integration.popularity}/5
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p className={cn("text-xs text-wl-text-secondary mb-3 line-clamp-2")}>
                  {integration.description}
                </p>

                {/* Expanded Content */}
                {expandedId === integration.id && (
                  <div className={cn("border-t border-wl-border-default pt-3 mt-3 space-y-3")}>
                    {/* Features */}
                    <div>
                      <p className={cn("text-xs font-semibold text-wl-text-primary mb-2")}>
                        Features:
                      </p>
                      <div className={cn("flex flex-wrap gap-1")}>
                        {integration.features.map((feature) => (
                          <span
                            key={feature}
                            className={cn(
                              "px-2 py-1 rounded text-xs bg-wl-bg-surface text-wl-text-tertiary font-medium"
                            )}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Setup Time */}
                    <div className={cn("flex items-center gap-2 text-xs text-wl-text-secondary")}>
                      <Zap className={cn("h-3 w-3")} />
                      <span>Setup: {integration.setupTime}</span>
                    </div>

                    {/* Action Button */}
                    <Button
                      variant={integration.status === "coming_soon" ? "ghost" : "primary"}
                      size="sm"
                      disabled={integration.status === "coming_soon"}
                      className={cn("w-full mt-2")}
                    >
                      {integration.status === "coming_soon"
                        ? "Coming Soon"
                        : integration.status === "beta"
                        ? "Try Beta"
                        : "Install"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className={cn("text-center py-12")}>
            <Package className={cn("h-12 w-12 text-wl-text-tertiary mx-auto mb-3 opacity-50")} />
            <p className={cn("text-wl-text-tertiary text-sm font-medium")}>
              No integrations found matching your criteria.
            </p>
            <p className={cn("text-wl-text-tertiary text-xs mt-1")}>
              Try adjusting your search or filter options.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
