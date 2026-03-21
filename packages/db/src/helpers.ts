/**
 * Type-safe model access helpers for Prisma client.
 * Use these instead of (prisma as any).modelName to avoid type casting.
 */

import { prisma } from './index';

// Type-safe model access
export const db = {
  order: prisma.order,
  driver: prisma.driver,
  route: prisma.route,
  user: prisma.user,
  shop: prisma.shop,
  customer: prisma.customer,
  deliveryZone: prisma.deliveryZone,
  webhookEndpoint: prisma.webhookEndpoint,
  webhookDelivery: prisma.webhookDelivery,
  returnRequest: prisma.returnRequest,
  integrationConnection: prisma.integrationConnection,
  notification: prisma.notification,
  invoice: prisma.invoice,
  collection: prisma.collection,
  invitation: prisma.invitation,
  authSession: prisma.authSession,
  authProvider: prisma.authProvider,
  onboardingProgress: prisma.onboardingProgress,
  routeStop: prisma.routeStop,
  workspace: prisma.workspace,
  notificationPreference: prisma.notificationPreference,
  orgMember: prisma.orgMember,
  organization: (prisma as any).organization,
  notificationTemplate: (prisma as any).notificationTemplate,
  notificationLog: (prisma as any).notificationLog,
  posCustomForm: (prisma as any).posCustomForm,
  workspaceSettings: (prisma as any).workspaceSettings,
  workspaceApiKey: (prisma as any).workspaceApiKey,
  searchIndex: (prisma as any).searchIndex,
  searchInteraction: (prisma as any).searchInteraction,
  webhookSubscription: (prisma as any).webhookSubscription,
  webhookDeliveryLog: (prisma as any).webhookDeliveryLog,
  timeSlot: (prisma as any).timeSlot,
  integrationEvent: (prisma as any).integrationEvent,
  location: (prisma as any).location,
  billingSubscription: (prisma as any).billingSubscription,
  billingPlan: (prisma as any).billingPlan,
  tenantConfig: (prisma as any).tenantConfig,
  vehicle: (prisma as any).vehicle,
  shipment: (prisma as any).shipment,
  carrier: (prisma as any).carrier,
  product: (prisma as any).product,
  campaign: (prisma as any).campaign,
  calendarRule: (prisma as any).calendarRule,
  savedView: (prisma as any).savedView,
  activityLog: (prisma as any).activityLog,
  supportTicket: (prisma as any).supportTicket,
  featureRequest: (prisma as any).featureRequest,
  payment: (prisma as any).payment,
  shippingProfile: (prisma as any).shippingProfile,
  deliveryProof: (prisma as any).deliveryProof,
  driverScore: (prisma as any).driverScore,
} as const;

export type DB = typeof db;
