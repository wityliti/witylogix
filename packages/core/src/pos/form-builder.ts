/**
 * Form Builder
 * Utilities for creating, managing, and validating custom forms
 */

import { prisma } from '@witylogix/db';
import type { PosFormInput, CustomFormField } from './types';

/**
 * Creates a new custom form
 * @param prisma - Prisma client
 * @param input - Form input
 * @returns Created form
 * @throws Error if validation fails
 */
export async function createForm(prisma: any, input: PosFormInput): Promise<any> {
  if (!input.shopId) {
    throw new Error('shopId is required');
  }
  if (!input.name) {
    throw new Error('name is required');
  }
  if (!input.fields || input.fields.length === 0) {
    throw new Error('fields must contain at least one field');
  }

  // Validate all fields
  input.fields.forEach((field, index) => {
    if (!field.name) {
      throw new Error(`Field ${index}: name is required`);
    }
    if (!field.type) {
      throw new Error(`Field ${index}: type is required`);
    }
    if (!field.label) {
      throw new Error(`Field ${index}: label is required`);
    }
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      throw new Error(`Field ${index}: select type requires options`);
    }
  });

  try {
    const form = await db.posCustomForm.create({
      data: {
        shopId: input.shopId,
        name: input.name,
        fields: input.fields,
        isDefault: input.isDefault ?? false,
      },
    });
    return form;
  } catch (error) {
    throw new Error(`Failed to create custom form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a specific custom form
 * @param prisma - Prisma client
 * @param formId - Form ID
 * @returns Form or null
 */
export async function getForm(prisma: any, formId: string): Promise<any> {
  if (!formId) {
    throw new Error('formId is required');
  }

  try {
    const form = await db.posCustomForm.findUnique({
      where: { id: formId },
    });
    return form;
  } catch (error) {
    throw new Error(`Failed to get custom form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List all custom forms for a shop
 * @param prisma - Prisma client
 * @param shopId - Shop ID
 * @returns Array of forms
 */
export async function listForms(prisma: any, shopId: string): Promise<any[]> {
  if (!shopId) {
    throw new Error('shopId is required');
  }

  try {
    const forms = await db.posCustomForm.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    });
    return forms;
  } catch (error) {
    throw new Error(`Failed to list custom forms: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a custom form
 * @param prisma - Prisma client
 * @param formId - Form ID
 * @param updates - Partial updates
 * @returns Updated form
 */
export async function updateForm(
  prisma: any,
  formId: string,
  updates: Partial<PosFormInput>,
): Promise<any> {
  if (!formId) {
    throw new Error('formId is required');
  }

  // Validate fields if provided
  if (updates.fields) {
    if (updates.fields.length === 0) {
      throw new Error('fields must contain at least one field');
    }

    updates.fields.forEach((field, index) => {
      if (!field.name) {
        throw new Error(`Field ${index}: name is required`);
      }
      if (!field.type) {
        throw new Error(`Field ${index}: type is required`);
      }
      if (!field.label) {
        throw new Error(`Field ${index}: label is required`);
      }
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        throw new Error(`Field ${index}: select type requires options`);
      }
    });
  }

  try {
    const form = await db.posCustomForm.update({
      where: { id: formId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.fields && { fields: updates.fields }),
        ...(updates.isDefault !== undefined && { isDefault: updates.isDefault }),
      },
    });
    return form;
  } catch (error) {
    throw new Error(`Failed to update custom form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a custom form
 * @param prisma - Prisma client
 * @param formId - Form ID
 */
export async function deleteForm(prisma: any, formId: string): Promise<void> {
  if (!formId) {
    throw new Error('formId is required');
  }

  try {
    await db.posCustomForm.delete({
      where: { id: formId },
    });
  } catch (error) {
    throw new Error(`Failed to delete custom form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate form submission data
 * @param form - Form definition
 * @param data - Submission data
 * @returns Validation result with errors
 */
export function validateSubmission(
  form: any,
  data: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form || !form.fields) {
    return { valid: false, errors: ['Invalid form definition'] };
  }

  const fields = form.fields as CustomFormField[];

  fields.forEach((field) => {
    const value = data[field.name];

    // Check required fields
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors.push(`${field.label} is required`);
        return;
      }
    }

    // Skip validation if not required and empty
    if (!field.required && (value === undefined || value === null || value === '')) {
      return;
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          errors.push(`${field.label} must be a valid email address`);
        }
        break;

      case 'phone':
        if (typeof value !== 'string' || !isValidPhone(value)) {
          errors.push(`${field.label} must be a valid phone number`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`${field.label} must be a number`);
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(String(value)))) {
          errors.push(`${field.label} must be a valid date`);
        }
        break;

      case 'select':
        if (!field.options?.includes(String(value))) {
          errors.push(`${field.label} has an invalid value`);
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          errors.push(`${field.label} must be a boolean value`);
        }
        break;

      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          errors.push(`${field.label} must be text`);
        }
        break;
    }

    // Custom validation regex
    if (field.validation && typeof value === 'string') {
      try {
        const regex = new RegExp(field.validation);
        if (!regex.test(value)) {
          errors.push(`${field.label} does not match required format`);
        }
      } catch {
        errors.push(`Invalid validation regex for ${field.label}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the default form for a shop
 * @param prisma - Prisma client
 * @param shopId - Shop ID
 * @returns Default form or null
 */
export async function getDefaultForm(prisma: any, shopId: string): Promise<any> {
  if (!shopId) {
    throw new Error('shopId is required');
  }

  try {
    const form = await db.posCustomForm.findFirst({
      where: {
        shopId,
        isDefault: true,
      },
    });
    return form;
  } catch (error) {
    throw new Error(`Failed to get default form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate email address format
 * @param email - Email to validate
 * @returns True if valid email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns True if valid phone number
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}
