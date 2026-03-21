/**
 * Type-safe model access helpers for Prisma client.
 * Use these instead of (prisma as any).modelName to avoid type casting.
 *
 * All 132+ Prisma models are exposed as camelCase helpers.
 */

import { prisma } from './index';

// Type-safe model access for all Prisma models
export const db = {
  // Core domain models
  order: prisma.order,
  driver: prisma.driver,
  route: prisma.route,
  routeStop: prisma.routeStop,
  user: prisma.user,
  shop: prisma.shop,
  customer: prisma.customer,
  deliveryZone: prisma.deliveryZone,

  // Webhooks
  webhookEndpoint: prisma.webhookEndpoint,
  webhookDelivery: prisma.webhookDelivery,
  webhookSubscription: prisma.webhookSubscription,
  webhookDeliveryLog: prisma.webhookDeliveryLog,
  webhookEvent: prisma.webhookEvent,
  webhookEventLog: prisma.webhookEventLog,
  webhookSecret: prisma.webhookSecret,

  // Returns & Integrations
  returnRequest: prisma.returnRequest,
  integrationConnection: prisma.integrationConnection,
  integrationEvent: prisma.integrationEvent,
  integration: prisma.integration,
  integrationApp: prisma.integrationApp,

  // Notifications
  notification: prisma.notification,
  notificationTemplate: prisma.notificationTemplate,
  notificationLog: prisma.notificationLog,
  notificationPreference: prisma.notificationPreference,
  notificationMeterEvent: prisma.notificationMeterEvent,

  // Invoicing
  invoice: prisma.invoice,
  invoiceLineItem: prisma.invoiceLineItem,
  invoiceDiscount: prisma.invoiceDiscount,
  invoiceTax: prisma.invoiceTax,
  invoicePayment: prisma.invoicePayment,
  invoiceNumberCounter: prisma.invoiceNumberCounter,

  // Collections & Products
  collection: prisma.collection,
  collectionProduct: prisma.collectionProduct,
  product: prisma.product,

  // Users & Org
  invitation: prisma.invitation,
  authSession: prisma.authSession,
  authProvider: prisma.authProvider,
  onboardingProgress: prisma.onboardingProgress,
  workspace: prisma.workspace,
  orgMember: prisma.orgMember,
  organization: prisma.organization,

  // Configuration & Settings
  workspaceSettings: prisma.workspaceSettings,
  workspaceApiKey: prisma.workspaceApiKey,
  timeSlot: prisma.timeSlot,
  location: prisma.location,
  locationCapacity: prisma.locationCapacity,
  locationWorkingHours: prisma.locationWorkingHours,
  locationZoneLink: prisma.locationZoneLink,
  billingSubscription: prisma.billingSubscription,
  billingPlan: prisma.billingPlan,
  tenantConfig: prisma.tenantConfig,

  // Vehicles & Fleet
  vehicle: prisma.vehicle,
  fleetVehicle: prisma.fleetVehicle,
  vehicleTelemetryLog: prisma.vehicleTelemetryLog,

  // Shipping & Delivery
  shipment: prisma.shipment,
  shipmentItem: prisma.shipmentItem,
  shipmentProof: prisma.shipmentProof,
  carrier: prisma.carrier,
  carrierService: prisma.carrierService,
  shippingProfile: prisma.shippingProfile,
  shippingProfileLocation: prisma.shippingProfileLocation,
  shippingRate: prisma.shippingRate,
  shippingZone: prisma.shippingZone,
  shippingZoneRate: prisma.shippingZoneRate,
  deliveryProof: prisma.deliveryProof,
  proofOfDelivery: prisma.proofOfDelivery,
  deliverySlot: prisma.deliverySlot,
  deliveryRule: prisma.deliveryRule,
  deliveryTimeSlot: prisma.deliveryTimeSlot,
  deliveryTimeline: prisma.deliveryTimeline,
  deliveryCalendarProfile: prisma.deliveryCalendarProfile,
  courierDelivery: prisma.courierDelivery,
  courierPartner: prisma.courierPartner,
  courierWebhookLog: prisma.courierWebhookLog,

  // Campaign & Marketing
  campaign: prisma.campaign,
  campaignEvent: prisma.campaignEvent,
  broadcastGroup: prisma.broadcastGroup,
  broadcastGroupMember: prisma.broadcastGroupMember,

  // Calendar & Scheduling
  calendarRule: prisma.calendarRule,
  calendarBlackout: prisma.calendarBlackout,
  calendarProfile: prisma.calendarProfile,
  calendarProfileRule: prisma.calendarProfileRule,
  calendarOperatingHours: prisma.calendarOperatingHours,
  blackoutDate: prisma.blackoutDate,
  deadlineConfig: prisma.deadlineConfig,

  // Views & UI
  savedView: prisma.savedView,
  widget: prisma.widget,

  // Activity & Logging
  activityLog: prisma.activityLog,
  supportTicket: prisma.supportTicket,
  supportMessage: prisma.supportMessage,
  featureRequest: prisma.featureRequest,

  // Payments
  payment: prisma.payment,
  paymentMethod: prisma.paymentMethod,
  paymentTransaction: prisma.paymentTransaction,
  paymentReconciliationLog: prisma.paymentReconciliationLog,
  paymentReminder: prisma.paymentReminder,

  // POS & Orders
  posCustomForm: prisma.posCustomForm,
  posConfig: prisma.posConfig,
  posOrder: prisma.posOrder,

  // Inventory
  inventoryItem: prisma.inventoryItem,
  inventoryMovement: prisma.inventoryMovement,

  // Ratings & Pricing
  rateCard: prisma.rateCard,
  surgePrice: prisma.surgePrice,

  // Roles & Permissions
  permission: prisma.permission,
  rolePermission: prisma.rolePermission,

  // CRM & ERP
  crmConnection: prisma.crmConnection,
  crmFieldMapping: prisma.crmFieldMapping,
  crmSyncLog: prisma.crmSyncLog,
  crmWebhookRegistration: prisma.crmWebhookRegistration,
  erpConnection: prisma.erpConnection,
  erpFieldMapping: prisma.erpFieldMapping,
  erpSyncLog: prisma.erpSyncLog,
  erpSyncRecord: prisma.erpSyncRecord,
  erpWebhookRegistration: prisma.erpWebhookRegistration,
  erpConflictRecord: prisma.erpConflictRecord,

  // WooCommerce
  wooCommerceConnection: prisma.wooCommerceConnection,
  wooCommerceRegisteredWebhook: prisma.wooCommerceRegisteredWebhook,
  wooCommerceSyncRecord: prisma.wooCommerceSyncRecord,
  wooCommerceWebhookLog: prisma.wooCommerceWebhookLog,

  // Telemetry & Tracking
  telematicsConnection: prisma.telematicsConnection,
  driverBehaviorEvent: prisma.driverBehaviorEvent,
  driverScore: prisma.driverScore,
  authMeterEvent: prisma.authMeterEvent,
  routingMeterEvent: prisma.routingMeterEvent,

  // Metadata
  metafield: prisma.metafield,
  metafieldDefinition: prisma.metafieldDefinition,

  // Messaging
  message: prisma.message,
  messageTemplate: prisma.messageTemplate,
  whatsAppConfig: prisma.whatsAppConfig,

  // Misc
  session: prisma.session,
  mfaDevice: prisma.mfaDevice,
  apiKey: prisma.apiKey,
  idempotencyKey: prisma.idempotencyKey,
  slotReservation: prisma.slotReservation,
  pickupRule: prisma.pickupRule,
  capacityConfig: prisma.capacityConfig,
  profileLocationLink: prisma.profileLocationLink,
  codCollection: prisma.codCollection,
  loginAttempt: prisma.loginAttempt,
  externalAuthSession: prisma.externalAuthSession,
  platformAdmin: prisma.platformAdmin,
  rateLimitOverride: prisma.rateLimitOverride,
  refund: prisma.refund,
  storeQuotaUsage: prisma.storeQuotaUsage,
  usageRecord: prisma.usageRecord,
  usageSummary: prisma.usageSummary,
} as const;

export type DB = typeof db;
