/**
 * Order Validation Step
 * Validates order data before processing (items, addresses, customer exists)
 * Compensation: no-op (read-only operation)
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface ValidateOrderInput {
  orderId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  itemCount: number;
  totalWeight?: number;
  totalPrice?: number;
  lineItems?: Array<{
    name: string;
    quantity: number;
    weight?: number;
    price?: number;
  }>;
}

export interface ValidateOrderOutput {
  isValid: boolean;
  validatedOrderId: string;
  customerId: string;
  validationWarnings: string[];
}

/**
 * Validates order data integrity
 * - Checks all required fields are present
 * - Validates address format
 * - Ensures customer info is valid
 * - Verifies line items data
 */
export const validateOrderStep: WorkflowStep<
  ValidateOrderInput,
  ValidateOrderOutput
> = {
  name: "validateOrder",
  description: "Validate order data integrity",

  async invoke(
    input: ValidateOrderInput,
    context: WorkflowContext,
  ): Promise<StepResult<ValidateOrderOutput>> {
    const logger = context.logger;
    logger?.info("Starting order validation", { orderId: input.orderId });

    try {
      const validationWarnings: string[] = [];

      // ─── Required Fields Check ──────────────────────────────────────
      if (!input.orderId || input.orderId.trim().length === 0) {
        return {
          success: false,
          error: "Order ID is required",
          code: "INVALID_ORDER_ID",
        };
      }

      if (!input.addressLine1 || input.addressLine1.trim().length === 0) {
        return {
          success: false,
          error: "Delivery address line 1 is required",
          code: "INVALID_ADDRESS",
        };
      }

      if (!input.city || input.city.trim().length === 0) {
        return {
          success: false,
          error: "City is required",
          code: "INVALID_CITY",
        };
      }

      if (!input.postalCode || input.postalCode.trim().length === 0) {
        return {
          success: false,
          error: "Postal code is required",
          code: "INVALID_POSTAL_CODE",
        };
      }

      if (!input.country || input.country.trim().length === 0) {
        return {
          success: false,
          error: "Country is required",
          code: "INVALID_COUNTRY",
        };
      }

      // ─── Address Format Validation ──────────────────────────────────
      if (input.addressLine1.length > 256) {
        validationWarnings.push("Address line 1 is very long (>256 chars)");
      }

      if (input.postalCode.length > 20) {
        validationWarnings.push("Postal code format may be invalid");
      }

      // ─── Postal Code Format by Country ──────────────────────────────
      const postalCodePatterns: Record<string, RegExp> = {
        CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, // Canadian postal code
        US: /^\d{5}(-\d{4})?$/, // US ZIP code
        GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, // UK postcode
        IN: /^\d{6}$/, // Indian PIN code
      };

      const pattern = postalCodePatterns[input.country.toUpperCase()];
      if (pattern && !pattern.test(input.postalCode.replace(/\s/g, ""))) {
        validationWarnings.push(
          `Postal code "${input.postalCode}" does not match ${input.country} format`,
        );
      }

      // ─── Item Count & Weight Validation ─────────────────────────────
      if (input.itemCount <= 0) {
        return {
          success: false,
          error: "Order must contain at least 1 item",
          code: "INVALID_ITEM_COUNT",
        };
      }

      if (input.totalWeight !== undefined) {
        if (input.totalWeight <= 0) {
          validationWarnings.push("Total weight should be positive");
        }
        if (input.totalWeight > 500) {
          validationWarnings.push("Order weight exceeds 500 kg (unusual)");
        }
      }

      // ─── Price Validation ──────────────────────────────────────────
      if (input.totalPrice !== undefined) {
        if (input.totalPrice < 0) {
          return {
            success: false,
            error: "Order price cannot be negative",
            code: "INVALID_PRICE",
          };
        }
      }

      // ─── Line Items Validation ─────────────────────────────────────
      if (input.lineItems && input.lineItems.length > 0) {
        let itemCount = 0;
        for (const item of input.lineItems) {
          if (!item.name || item.name.trim().length === 0) {
            return {
              success: false,
              error: "All line items must have a name",
              code: "INVALID_LINE_ITEM",
            };
          }

          if (item.quantity <= 0) {
            return {
              success: false,
              error: `Invalid quantity for item "${item.name}"`,
              code: "INVALID_LINE_ITEM_QUANTITY",
            };
          }

          itemCount += item.quantity;

          if (item.weight !== undefined && item.weight < 0) {
            validationWarnings.push(
              `Line item "${item.name}" has negative weight`,
            );
          }

          if (item.price !== undefined && item.price < 0) {
            validationWarnings.push(
              `Line item "${item.name}" has negative price`,
            );
          }
        }

        if (itemCount !== input.itemCount) {
          validationWarnings.push(
            `Item count mismatch: header says ${input.itemCount}, but items sum to ${itemCount}`,
          );
        }
      }

      // ─── Customer Info Validation ──────────────────────────────────
      // At least one contact method should be available
      const hasContact =
        (input.customerEmail && input.customerEmail.trim().length > 0) ||
        (input.customerPhone && input.customerPhone.trim().length > 0);

      if (!hasContact) {
        validationWarnings.push("Order has no customer email or phone");
      }

      // Email format validation (if provided)
      if (input.customerEmail && input.customerEmail.trim().length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.customerEmail)) {
          validationWarnings.push(
            `Invalid email format: "${input.customerEmail}"`,
          );
        }
      }

      // Phone format validation (if provided)
      if (input.customerPhone && input.customerPhone.trim().length > 0) {
        // Basic phone validation: should have digits
        if (!/\d{7,}/.test(input.customerPhone.replace(/\D/g, ""))) {
          validationWarnings.push(
            `Phone number too short: "${input.customerPhone}"`,
          );
        }
      }

      // ─── Generate Customer ID if not provided ──────────────────────
      let customerId = input.customerId || `GUEST_${input.orderId}`;

      logger?.info("Order validation completed", {
        orderId: input.orderId,
        isValid: true,
        warningCount: validationWarnings.length,
      });

      return {
        success: true,
        data: {
          isValid: true,
          validatedOrderId: input.orderId,
          customerId,
          validationWarnings,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Order validation failed", { error: errorMsg });
      return {
        success: false,
        error: `Validation error: ${errorMsg}`,
        code: "VALIDATION_ERROR",
      };
    }
  },

  // No compensation needed — validation is a read-only operation
};
