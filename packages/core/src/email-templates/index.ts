/**
 * Email Templates - Barrel Export
 * Exports all email templates and utilities
 */

// Types
export type {
  EmailTemplate,
  OrderItem,
  OrderEmailData,
  ShippingEmailData,
  DeliveryEmailData,
  ReturnItem,
  ReturnEmailData,
  EmailData,
} from "./types";

// Template Engine
export {
  renderTemplate,
  interpolate,
  formatCurrency,
  formatDate,
  formatTime,
} from "./template-engine";

// Base Layout
export { baseLayout } from "./templates/base-layout";
export type { BaseLayoutProps } from "./templates/base-layout";

// Templates
export { orderConfirmedTemplate } from "./templates/order-confirmed";
export { orderShippedTemplate } from "./templates/order-shipped";
export { outForDeliveryTemplate } from "./templates/out-for-delivery";
export { deliveredTemplate } from "./templates/delivered";
export { returnInitiatedTemplate } from "./templates/return-initiated";
export { returnRefundedTemplate } from "./templates/return-refunded";
