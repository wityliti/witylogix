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
} as const;

export type DB = typeof db;
