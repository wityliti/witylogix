/**
 * Invoicing & Payment Component Types
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type BillingRule = 'flat' | 'hourly' | 'tiered' | 'usage';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  billingRule?: BillingRule;
  amount?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  lineItems?: LineItem[];
  subtotal?: number;
  taxAmount?: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  method: 'card' | 'bank' | 'cash' | 'check';
  referenceNumber: string;
  processedAt: string;
  completedAt?: string;
}

export interface AgingBucket {
  label: string;
  range: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface RevenueDataPoint {
  month: string;
  invoiced: number;
  collected: number;
  outstanding: number;
}

export interface CourierTracking {
  id: string;
  courierName: string;
  courierAvatar: string;
  partnerLogo: string;
  currentStatus: string;
  currentPickup: string;
  currentDropoff: string;
  etaMinutes: number;
  progressPercentage: number;
  isActive: boolean;
}

export interface DeliveryETA {
  estimatedMinutes: number;
  confidenceInterval: { low: number; high: number };
  mlModelContribution: Array<{ model: string; contribution: number }>;
  trafficCondition: 'clear' | 'moderate' | 'heavy';
  weatherImpact: 'none' | 'minor' | 'major';
  historicalAccuracy: number;
}
