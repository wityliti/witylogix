/**
 * ERP Data Normalizer
 * Normalizes data from SAP OData, NetSuite SDK, and other ERP providers
 * to unified types for consistent handling across Witylogix platform
 */

import type {
  SapBusinessPartner,
  SapSalesOrder,
  SapPurchaseOrder,
  SapProduct,
  SapInvoice,
} from './sap-odata-client.js';
import type {
  NetSuiteCustomer,
  NetSuiteSalesOrder,
  NetSuitePurchaseOrder,
  NetSuiteInvoice,
  NetSuiteItem,
  NetSuiteVendor,
} from './netsuite-sdk-client.js';
import type {
  ERPCustomer,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPAddress,
  ERPLineItem,
  ERPVendor,
} from './types.js';

// ─── UNIT OF MEASURE MAPPING ──────────────────────────────────────────────

/**
 * Standard UOM codes mapped from various ERP systems
 */
const UOM_MAPPING: Record<string, string> = {
  // SAP codes
  'ST': 'EA',
  'PC': 'EA',
  'BOX': 'BOX',
  'KG': 'KG',
  'L': 'L',
  'M': 'M',
  'CM': 'CM',
  'MM': 'MM',
  'EA': 'EA',
  'CT': 'CT', // Carton
  'PLT': 'PLT', // Pallet

  // NetSuite codes
  'Each': 'EA',
  'Box': 'BOX',
  'Case': 'CASE',
  'Kilogram': 'KG',
  'Gram': 'G',
  'Liter': 'L',
  'Meter': 'M',
  'Centimeter': 'CM',
  'Millimeter': 'MM',
  'Carton': 'CT',
  'Pallet': 'PLT',
};

/**
 * Get normalized UOM code
 */
function normalizeUOM(uom?: string): string {
  if (!uom) return 'EA'; // Default to each
  return UOM_MAPPING[uom] || uom;
}

// ─── CURRENCY NORMALIZATION ───────────────────────────────────────────────

/**
 * Valid ISO 4217 currency codes
 */
const VALID_CURRENCIES = new Set([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
  'NZD',
  'CNY',
  'INR',
  'MXN',
  'BRL',
  'ZAR',
  'SGD',
  'HKD',
  'SEK',
  'NOK',
  'DKK',
  'AED',
  'SAR',
  'KWD',
  'QAR',
  'BHD',
  'OMR',
]);

/**
 * Normalize and validate currency code
 */
function normalizeCurrency(currency?: string): string | undefined {
  if (!currency) return undefined;
  const normalized = currency.toUpperCase();
  return VALID_CURRENCIES.has(normalized) ? normalized : currency;
}

// ─── ADDRESS NORMALIZATION ───────────────────────────────────────────────

/**
 * Normalize SAP business partner address to unified format
 */
function normalizeSapAddress(sapAddress: any): ERPAddress {
  return {
    type: sapAddress.AddressType === '1' ? 'billing' : sapAddress.AddressType === '2' ? 'shipping' : 'business',
    line1: sapAddress.StreetName || '',
    line2: sapAddress.StreetNumber || undefined,
    city: sapAddress.City || '',
    state: sapAddress.RegionCode || undefined,
    postalCode: sapAddress.PostalCode || '',
    country: sapAddress.CountryCode || '',
    isDefault: sapAddress.IsDefaultAddress,
  };
}

/**
 * Normalize NetSuite address to unified format
 */
function normalizeNetSuiteAddress(nsAddress: any): ERPAddress {
  return {
    type: 'billing',
    line1: nsAddress.addr1 || '',
    line2: nsAddress.addr2 || undefined,
    city: nsAddress.city || '',
    state: nsAddress.state || undefined,
    postalCode: nsAddress.zip || '',
    country: nsAddress.country || '',
    isDefault: nsAddress.isDefault,
  };
}

// ─── NORMALIZERS ──────────────────────────────────────────────────────────

/**
 * Normalize SAP business partner to unified customer
 */
export function normalizeSapCustomer(partner: SapBusinessPartner): ERPCustomer {
  return {
    id: partner.BusinessPartner,
    externalId: partner.BusinessPartner,
    code: partner.BusinessPartner,
    name: partner.BusinessPartnerName,
    companyName: partner.BusinessPartnerName,
    taxId: undefined,
    status: partner.BusinessPartnerIsBlocked === true ? 'blocked' : 'active',
    addresses: partner.BPAddresses?.map(normalizeSapAddress),
    currency: 'USD', // Default, SAP doesn't provide at BP level
    customFields: {
      sapType: partner.BusinessPartnerType,
      sapLanguage: partner.Language,
      isNaturalPerson: partner.IsNaturalPerson,
    },
    createdAt: partner.CreationDate ? new Date(partner.CreationDate) : undefined,
    lastModifiedAt: partner.ModifiedDate ? new Date(partner.ModifiedDate) : undefined,
  };
}

/**
 * Normalize NetSuite customer to unified customer
 */
export function normalizeNetSuiteCustomer(customer: NetSuiteCustomer): ERPCustomer {
  return {
    id: customer.internalId || customer.id,
    externalId: customer.internalId || customer.id,
    code: customer.entityId,
    name: customer.entityId,
    companyName: customer.companyName || customer.entityId,
    email: customer.email,
    phone: customer.phone,
    fax: customer.fax,
    website: customer.website,
    taxId: customer.taxId,
    creditLimit: customer.creditLimit,
    paymentTerms: customer.paymentTerms,
    currency: normalizeCurrency(customer.currency),
    status: customer.status || 'active',
    addresses: customer.billingAddress ? [normalizeNetSuiteAddress(customer.billingAddress)] : undefined,
    customFields: customer.customFields,
    createdAt: customer.createdDate ? new Date(customer.createdDate) : undefined,
    lastModifiedAt: customer.lastModifiedDate ? new Date(customer.lastModifiedDate) : undefined,
  };
}

/**
 * Normalize SAP business partner to unified vendor
 */
export function normalizeSapVendor(partner: SapBusinessPartner): ERPVendor {
  return {
    id: partner.BusinessPartner,
    externalId: partner.BusinessPartner,
    code: partner.BusinessPartner,
    name: partner.BusinessPartnerName,
    companyName: partner.BusinessPartnerName,
    status: partner.BusinessPartnerIsBlocked === true ? 'blocked' : 'active',
    addresses: partner.BPAddresses?.map(normalizeSapAddress),
    currency: 'USD', // Default
    customFields: {
      sapType: partner.BusinessPartnerType,
    },
    createdAt: partner.CreationDate ? new Date(partner.CreationDate) : undefined,
    lastModifiedAt: partner.ModifiedDate ? new Date(partner.ModifiedDate) : undefined,
  };
}

/**
 * Normalize NetSuite vendor to unified vendor
 */
export function normalizeNetSuiteVendor(vendor: NetSuiteVendor): ERPVendor {
  return {
    id: vendor.internalId || vendor.id,
    externalId: vendor.internalId || vendor.id,
    code: vendor.entityId,
    name: vendor.entityId,
    companyName: vendor.companyName || vendor.entityId,
    email: vendor.email,
    phone: vendor.phone,
    website: vendor.website,
    taxId: vendor.taxId,
    currency: normalizeCurrency(vendor.currency),
    paymentTerms: vendor.paymentTerms,
    status: vendor.status || 'active',
    addresses: vendor.address ? [normalizeNetSuiteAddress(vendor.address)] : undefined,
    customFields: vendor.customFields,
    createdAt: vendor.createdDate ? new Date(vendor.createdDate) : undefined,
    lastModifiedAt: vendor.lastModifiedDate ? new Date(vendor.lastModifiedDate) : undefined,
  };
}

/**
 * Normalize SAP product to unified product
 */
export function normalizeSapProduct(product: SapProduct): ERPProduct {
  const plantData = product.to_MaterialPlant?.[0];

  return {
    id: product.Material,
    externalId: product.Material,
    sku: product.Material,
    name: product.MaterialDescription || product.Material,
    description: product.MaterialDescription,
    unit: normalizeUOM(product.BaseUnit),
    quantity: plantData?.Quantity,
    status: product.Deleted === true ? 'inactive' : product.MaterialStatus === 'active' ? 'active' : 'inactive',
    customFields: {
      sapType: product.MaterialType,
      sapPlant: plantData?.Plant,
      sapStorageLocation: plantData?.StorageLocation,
      standardCost: plantData?.StandardCost,
      averageCost: plantData?.AverageCost,
      reorderPoint: plantData?.ReorderPoint,
      safetyStock: plantData?.SafetyStock,
    },
    createdAt: product.CreationDate ? new Date(product.CreationDate) : undefined,
    lastModifiedAt: product.LastModifiedDate ? new Date(product.LastModifiedDate) : undefined,
  };
}

/**
 * Normalize NetSuite item to unified product
 */
export function normalizeNetSuiteProduct(item: NetSuiteItem): ERPProduct {
  return {
    id: item.internalId || item.id,
    externalId: item.internalId || item.id,
    sku: item.itemId,
    name: item.displayName || item.itemId,
    description: item.description,
    unit: normalizeUOM(item.saleUnit || item.baseUnit),
    quantity: item.quantityOnHand,
    cost: item.cost,
    status: item.isInvtItem === false ? 'inactive' : 'active',
    customFields: {
      nsType: item.type,
      conversionRate: item.conversionRate,
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      department: item.department,
      class: item.class,
      location: item.location,
      isSerialNumbered: item.isSerialNumbered,
      isLotNumbered: item.isLotNumbered,
    },
    createdAt: item.createdDate ? new Date(item.createdDate) : undefined,
    lastModifiedAt: item.lastModifiedDate ? new Date(item.lastModifiedDate) : undefined,
  };
}

/**
 * Normalize SAP sales order line items
 */
function normalizeSapOrderItems(items: any[]): ERPLineItem[] {
  return items.map((item) => ({
    lineNumber: parseInt(item.SalesOrderItem, 10),
    itemId: item.Material,
    itemCode: item.Material,
    itemName: item.MaterialDescription || item.Material,
    quantity: item.OrderQuantity || 0,
    unitPrice: item.NetAmount && item.OrderQuantity ? item.NetAmount / item.OrderQuantity : 0,
    unit: normalizeUOM(item.OrderQuantityUnit),
    taxRate: item.TotalTaxAmount && item.OrderQuantity ? item.TotalTaxAmount / item.OrderQuantity : undefined,
    totalAmount: item.TotalAmount || 0,
  }));
}

/**
 * Normalize NetSuite order line items
 */
function normalizeNetSuiteOrderItems(items: any[]): ERPLineItem[] {
  return items.map((item, idx) => ({
    lineNumber: item.line || idx + 1,
    itemId: item.item,
    itemCode: item.item,
    itemName: item.itemName || item.item,
    description: item.description,
    quantity: item.quantity || 0,
    unitPrice: item.rate || 0,
    discountPercent: typeof item.discount === 'number' ? item.discount : undefined,
    totalAmount: item.amount || 0,
  }));
}

/**
 * Normalize SAP sales order to unified order
 */
export function normalizeSapSalesOrder(order: SapSalesOrder): ERPOrder {
  return {
    id: order.SalesOrder,
    externalId: order.SalesOrder,
    orderNumber: order.SalesOrder,
    orderDate: order.DocumentDate ? new Date(order.DocumentDate) : new Date(),
    customerId: order.Bill_Cust || '',
    currency: normalizeCurrency(order.OrderCurrency),
    status: order.OrderStatus === 'confirmed' ? 'confirmed' : 'pending',
    lineItems: normalizeSapOrderItems(order.SOItems || []),
    subtotal: order.NetAmount,
    taxAmount: order.TaxAmount,
    total: order.TotalAmount || 0,
    customFields: {
      sapType: order.SalesOrderType,
      sapStatus: order.OrderStatus,
      incoterms: order.Incoterms1,
    },
    createdAt: order.CreationDate ? new Date(order.CreationDate) : undefined,
    lastModifiedAt: undefined,
  };
}

/**
 * Normalize NetSuite sales order to unified order
 */
export function normalizeNetSuiteSalesOrder(order: NetSuiteSalesOrder): ERPOrder {
  return {
    id: order.internalId || order.id,
    externalId: order.internalId || order.id,
    orderNumber: order.tranId,
    orderDate: order.tranDate instanceof Date ? order.tranDate : new Date(order.tranDate as string),
    customerId: order.entity,
    customerName: order.entityName,
    currency: normalizeCurrency(order.currency),
    status: order.status as any,
    lineItems: normalizeNetSuiteOrderItems(order.items || []),
    subtotal: order.subtotal,
    discountAmount: order.discountTotal,
    taxAmount: order.taxTotal,
    total: order.total || 0,
    shippingAddress: order.shippingAddress ? normalizeNetSuiteAddress(order.shippingAddress) : undefined,
    billingAddress: order.billingAddress ? normalizeNetSuiteAddress(order.billingAddress) : undefined,
    customFields: order.customFields,
    createdAt: order.createdDate ? new Date(order.createdDate) : undefined,
    lastModifiedAt: order.lastModifiedDate ? new Date(order.lastModifiedDate) : undefined,
  };
}

/**
 * Normalize SAP purchase order to unified order
 */
export function normalizeSapPurchaseOrder(order: SapPurchaseOrder): ERPOrder {
  return {
    id: order.PurchaseOrder,
    externalId: order.PurchaseOrder,
    orderNumber: order.PurchaseOrder,
    orderDate: order.DocumentDate ? new Date(order.DocumentDate) : new Date(),
    customerId: order.Vendor || '',
    currency: normalizeCurrency(order.DocumentCurrency),
    status: order.DocumentStatus === 'released' ? 'confirmed' : 'pending',
    lineItems: (order.to_PurchaseOrderItem || []).map((item: any) => ({
      lineNumber: parseInt(item.PurchaseOrderItem, 10),
      itemId: item.Material,
      itemCode: item.Material,
      itemName: item.MaterialName || item.Material,
      quantity: item.OrderQuantity || 0,
      unitPrice: item.NetAmount && item.OrderQuantity ? item.NetAmount / item.OrderQuantity : 0,
      totalAmount: item.TotalAmount || 0,
    })),
    subtotal: order.NetAmount,
    taxAmount: order.TaxAmount,
    total: order.TotalAmount || 0,
    customFields: {
      sapStatus: order.DocumentStatus,
    },
    createdAt: order.CreationDate ? new Date(order.CreationDate) : undefined,
    lastModifiedAt: undefined,
  };
}

/**
 * Normalize NetSuite purchase order to unified order
 */
export function normalizeNetSuitePurchaseOrder(order: NetSuitePurchaseOrder): ERPOrder {
  return {
    id: order.internalId || order.id,
    externalId: order.internalId || order.id,
    orderNumber: order.tranId,
    orderDate: order.tranDate instanceof Date ? order.tranDate : new Date(order.tranDate as string),
    customerId: order.entity,
    customerName: order.entityName,
    currency: normalizeCurrency(order.currency),
    status: order.status as any,
    lineItems: normalizeNetSuiteOrderItems(order.items || []),
    subtotal: order.subtotal,
    discountAmount: order.discountTotal,
    taxAmount: order.taxTotal,
    total: order.total || 0,
    customFields: order.customFields,
    createdAt: order.createdDate ? new Date(order.createdDate) : undefined,
    lastModifiedAt: order.lastModifiedDate ? new Date(order.lastModifiedDate) : undefined,
  };
}

/**
 * Normalize SAP invoice to unified invoice
 */
export function normalizeSapInvoice(invoice: SapInvoice): ERPInvoice {
  return {
    id: invoice.BillingDocument,
    externalId: invoice.BillingDocument,
    invoiceNumber: invoice.BillingDocument,
    invoiceDate: invoice.DocumentDate ? new Date(invoice.DocumentDate) : new Date(),
    dueDate: invoice.DocumentDate ? new Date(invoice.DocumentDate) : new Date(),
    customerId: invoice.BillingCustomer || '',
    currency: normalizeCurrency(invoice.DocumentCurrency),
    status: invoice.BillingDocumentStatus === 'completed' ? 'paid' : 'posted',
    lineItems: (invoice.to_BillingDocumentItem || []).map((item: any) => ({
      lineNumber: parseInt(item.BillingDocumentItem, 10),
      itemId: item.Material,
      itemCode: item.Material,
      itemName: item.MaterialDescription || item.Material,
      quantity: item.BilledQuantity || 0,
      unitPrice: item.NetAmount && item.BilledQuantity ? item.NetAmount / item.BilledQuantity : 0,
      totalAmount: item.GrossAmount || 0,
    })),
    subtotal: invoice.TotalNetAmount,
    taxAmount: invoice.TotalTaxAmount,
    total: invoice.TotalGrossAmount || 0,
    customFields: {
      sapType: invoice.BillingDocumentType,
      salesOrderRef: invoice.ReferenceSDDocument,
    },
    createdAt: invoice.CreationDate ? new Date(invoice.CreationDate) : undefined,
    lastModifiedAt: undefined,
  };
}

/**
 * Normalize NetSuite invoice to unified invoice
 */
export function normalizeNetSuiteInvoice(invoice: NetSuiteInvoice): ERPInvoice {
  return {
    id: invoice.internalId || invoice.id,
    externalId: invoice.internalId || invoice.id,
    invoiceNumber: invoice.tranId,
    invoiceDate: invoice.tranDate instanceof Date ? invoice.tranDate : new Date(invoice.tranDate as string),
    dueDate: invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate as string),
    customerId: invoice.entity,
    customerName: invoice.entityName,
    currency: normalizeCurrency(invoice.currency),
    status: invoice.status as any,
    lineItems: normalizeNetSuiteOrderItems(invoice.items || []),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountTotal,
    taxAmount: invoice.taxTotal,
    total: invoice.total || 0,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountRemaining,
    billingAddress: invoice.billingAddress ? normalizeNetSuiteAddress(invoice.billingAddress) : undefined,
    shippingAddress: invoice.shippingAddress ? normalizeNetSuiteAddress(invoice.shippingAddress) : undefined,
    customFields: invoice.customFields,
    createdAt: invoice.createdDate ? new Date(invoice.createdDate) : undefined,
    lastModifiedAt: invoice.lastModifiedDate ? new Date(invoice.lastModifiedDate) : undefined,
  };
}
