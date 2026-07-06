/**
 * Delivery Rules Engine Types
 * Defines all types used in the delivery rules system without external dependencies
 */

/**
 * Supported comparison operators for rule conditions
 */
export type ConditionOperator =
  | "eq" // Equal
  | "neq" // Not equal
  | "gt" // Greater than
  | "gte" // Greater than or equal
  | "lt" // Less than
  | "lte" // Less than or equal
  | "in" // In array
  | "notIn" // Not in array
  | "between" // Between two values
  | "contains" // String contains
  | "startsWith" // String starts with
  | "endsWith"; // String ends with

/**
 * A condition that must be evaluated
 */
export interface DeliveryRuleCondition {
  field: string; // Path to field (dot notation: 'order.weight')
  operator: ConditionOperator;
  value: unknown; // Value to compare against
}

/**
 * Types of actions that can be applied when a rule matches
 */
export type ActionType =
  | "SET_RATE"
  | "BLOCK"
  | "APPLY_DISCOUNT"
  | "SET_TIME_SLOT"
  | "ADD_FEE"
  | "REQUIRE_SIGNATURE"
  | "MARK_FRAGILE";

/**
 * Parameters for different action types
 */
export interface ActionParams {
  rate?: number; // For SET_RATE
  discount?: number; // For APPLY_DISCOUNT
  fee?: number; // For ADD_FEE
  timeSlots?: TimeSlot[]; // For SET_TIME_SLOT
  reason?: string; // For BLOCK
  riskLevel?: "low" | "medium" | "high"; // For MARK_FRAGILE
}

/**
 * An action to apply when rule conditions match
 */
export interface DeliveryRuleAction {
  type: ActionType;
  params: ActionParams;
  priority?: number; // Execution order for multiple actions
}

/**
 * Available time slot for delivery
 */
export interface TimeSlot {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  available: boolean;
  maxOrders?: number;
}

/**
 * Context passed to rule evaluation
 */
export interface RuleEvaluationContext {
  order: OrderContext;
  customer: CustomerContext;
  zone?: ZoneContext;
  timeSlot?: TimeSlot;
  cart?: CartContext;
}

/**
 * Order-related context
 */
export interface OrderContext {
  id?: string;
  total: number;
  weight?: number;
  itemCount: number;
  lineItems?: LineItemContext[];
  shippingAddress?: AddressContext;
  notes?: string;
}

/**
 * Cart-related context
 */
export interface CartContext {
  total: number;
  itemCount: number;
  weight?: number;
  hasFragileItems?: boolean;
  requiresSignature?: boolean;
}

/**
 * Line item in order
 */
export interface LineItemContext {
  productId: string;
  variantId?: string;
  quantity: number;
  weight?: number;
  price: number;
  requiresSignature?: boolean;
  isFragile?: boolean;
}

/**
 * Customer-related context
 */
export interface CustomerContext {
  id?: string;
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  postalCode?: string;
  isRecurring?: boolean;
  totalOrders?: number;
}

/**
 * Shipping zone context
 */
export interface ZoneContext {
  id?: string;
  name?: string;
  region?: string;
  serviceType?: "LOCAL" | "STANDARD" | "PICKUP";
}

/**
 * Shipping address context
 */
export interface AddressContext {
  country?: string;
  province?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Result of rule evaluation
 */
export interface RuleResult {
  allowed: boolean;
  rate?: number;
  discount?: number;
  fee?: number;
  timeSlots?: TimeSlot[];
  requiresSignature?: boolean;
  isFragile?: boolean;
  message?: string;
  appliedRuleIds?: string[];
  riskLevel?: "low" | "medium" | "high";
}

/**
 * Delivery rule stored in database
 */
export interface DeliveryRuleData {
  id: string;
  shopId: string;
  name: string;
  type: "LOCAL" | "PICKUP" | "STANDARD";
  conditions: DeliveryRuleCondition[];
  actions: DeliveryRuleAction[];
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Evaluation mode for multiple matching rules
 */
export type RuleEvaluationMode =
  | "first-match"
  | "all-match"
  | "highest-priority";

/**
 * Options for rule evaluation
 */
export interface EvaluationOptions {
  mode?: RuleEvaluationMode;
  includeAllMatches?: boolean;
  stopOnBlock?: boolean;
}
