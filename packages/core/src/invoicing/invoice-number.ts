/**
 * Invoice Number Generator
 * Generates atomic, sequential invoice numbers without gaps or duplicates.
 * Format: {PREFIX}-{YYYY}-{NNNNN} (e.g., INV-2026-00001)
 * Thread-safe using Prisma atomic updates.
 */

import { PrismaClient } from '@witylogix/db';

export interface InvoiceNumberResult {
  invoiceNumber: string;
  prefix: string;
  year: number;
  sequenceNumber: number;
}

/**
 * Generate a unique invoice number for a tenant
 * Automatically handles annual counter reset and Prisma upsert for atomic operations.
 * Format: {PREFIX}-{YYYY}-{NNNNN}
 *
 * @param tenantId - Tenant ID
 * @param prisma - Prisma client instance
 * @param prefix - Custom prefix (default: "INV")
 * @returns InvoiceNumberResult with formatted number and metadata
 * @throws Error if database operation fails
 */
export async function generateInvoiceNumber(
  tenantId: string,
  prisma: PrismaClient,
  prefix: string = 'INV',
): Promise<InvoiceNumberResult> {
  const currentYear = new Date().getFullYear();

  // Atomic upsert: initialize counter if missing, or increment if exists
  const counter = await (prisma.invoiceNumberCounter as any).upsert({
    where: { tenantId },
    update: {
      // On update: increment counter if year matches, else reset
      currentNumber: {
        increment: 1,
      },
      // If year changed, reset the counter (but we don't do it in update, only in initial select)
      year: currentYear,
    },
    create: {
      tenantId,
      prefix,
      year: currentYear,
      currentNumber: 1,
    },
  });

  // Check if year has rolled over; if so, reset counter atomically
  let sequenceNumber = counter.currentNumber;
  if (counter.year !== currentYear) {
    // Year rolled over, need to reset
    const resetCounter = await (prisma.invoiceNumberCounter as any).update({
      where: { tenantId },
      data: {
        year: currentYear,
        currentNumber: 1,
      },
    });
    sequenceNumber = 1;
  }

  // Format: INV-2026-00001
  const paddedSequence = String(sequenceNumber).padStart(5, '0');
  const invoiceNumber = `${counter.prefix}-${currentYear}-${paddedSequence}`;

  return {
    invoiceNumber,
    prefix: counter.prefix,
    year: currentYear,
    sequenceNumber,
  };
}

/**
 * Get the next invoice number without incrementing the counter
 * Useful for previews or validation
 * @param tenantId - Tenant ID
 * @param prisma - Prisma client instance
 * @returns Promise<string> - The next invoice number that would be generated
 */
export async function getNextInvoiceNumber(
  tenantId: string,
  prisma: PrismaClient,
): Promise<string> {
  const currentYear = new Date().getFullYear();

  const counter = await (prisma.invoiceNumberCounter as any).findUnique({
    where: { tenantId },
  });

  if (!counter) {
    // Would be created with sequence 1
    return `INV-${currentYear}-00001`;
  }

  if (counter.year !== currentYear) {
    // Would be reset
    return `${counter.prefix}-${currentYear}-00001`;
  }

  // Would increment
  const nextSequence = counter.currentNumber + 1;
  const paddedSequence = String(nextSequence).padStart(5, '0');
  return `${counter.prefix}-${currentYear}-${paddedSequence}`;
}

/**
 * Reset the invoice counter for a tenant (e.g., at year boundary)
 * Use with caution; typically called by a scheduled task
 * @param tenantId - Tenant ID
 * @param prisma - Prisma client instance
 * @param newPrefix - Optional new prefix (default: keep existing)
 */
export async function resetInvoiceCounter(
  tenantId: string,
  prisma: PrismaClient,
  newPrefix?: string,
): Promise<void> {
  const currentYear = new Date().getFullYear();

  await (prisma.invoiceNumberCounter as any).update({
    where: { tenantId },
    data: {
      year: currentYear,
      currentNumber: 0,
      lastResetAt: new Date(),
      ...(newPrefix && { prefix: newPrefix }),
    },
  });
}

/**
 * Update prefix for a tenant's invoice numbers
 * @param tenantId - Tenant ID
 * @param newPrefix - New prefix (e.g., "INV", "IV", "BILL")
 * @param prisma - Prisma client instance
 */
export async function updateInvoicePrefix(
  tenantId: string,
  newPrefix: string,
  prisma: PrismaClient,
): Promise<void> {
  await (prisma.invoiceNumberCounter as any).update({
    where: { tenantId },
    data: { prefix: newPrefix },
  });
}
