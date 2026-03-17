/**
 * E-Signature Envelope Engine v2
 * Core engine for managing envelope lifecycle, status transitions, and bulk operations
 */

import {
  Envelope,
  EnvelopeStatus,
  Signer,
  SignerRole,
  EnvelopeDocument,
  AuditEvent,
  BulkSendConfiguration,
  EnvelopeMergeResult,
} from './esignature-types';

/**
 * Envelope Manager
 * Handles CRUD operations, cloning, and bulk envelope management
 */
export class EnvelopeManager {
  private envelopes: Map<string, Envelope> = new Map();

  /**
   * Create a new envelope
   */
  async createEnvelope(
    tenantId: string,
    createdByUserId: string,
    data: Partial<Envelope>,
  ): Promise<Envelope> {
    const envelope: Envelope = {
      id: `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      createdByUserId,
      name: data.name || 'Untitled Envelope',
      status: EnvelopeStatus.DRAFT,
      documents: data.documents || [],
      signers: data.signers || [],
      branding: data.branding || {
        showWatermark: true,
      },
      reminders: data.reminders || {
        enabled: true,
        firstReminderDays: 3,
        subsequentReminderDays: 5,
        maxReminders: 3,
      },
      expiration: data.expiration || {
        enabled: true,
        expirationDays: 90,
        autoVoidOnExpiration: true,
      },
      requireAllSignatures: data.requireAllSignatures ?? true,
      requireAcceptanceBeforeSigning: data.requireAcceptanceBeforeSigning ?? false,
      enableAccessControl: data.enableAccessControl ?? false,
      signatureProgress: {
        totalSigners: data.signers?.length || 0,
        signersSigned: 0,
        signersDeclined: 0,
        signersViewed: 0,
      },
      fields: data.fields || [],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      customFields: data.customFields,
      tags: data.tags,
      templateId: data.templateId,
      externalId: data.externalId,
      description: data.description,
    };

    this.envelopes.set(envelope.id, envelope);
    this.addAuditEvent(envelope.id, {
      envelopeId: envelope.id,
      eventType: 'envelope_created',
      description: `Envelope created: ${envelope.name}`,
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      timestamp: new Date(),
    });

    return envelope;
  }

  /**
   * Get envelope by ID
   */
  async getEnvelope(envelopeId: string): Promise<Envelope | null> {
    return this.envelopes.get(envelopeId) || null;
  }

  /**
   * Update envelope metadata
   */
  async updateEnvelope(
    envelopeId: string,
    updates: Partial<Envelope>,
  ): Promise<Envelope> {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);

    const updated: Envelope = {
      ...envelope,
      ...updates,
      id: envelope.id, // Prevent ID changes
      tenantId: envelope.tenantId, // Prevent tenant changes
      createdByUserId: envelope.createdByUserId, // Prevent creator changes
      updatedAt: new Date(),
    };

    this.envelopes.set(envelopeId, updated);
    this.addAuditEvent(envelopeId, {
      envelopeId,
      eventType: 'envelope_created',
      description: `Envelope updated`,
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      timestamp: new Date(),
      additionalData: { changes: updates },
    });

    return updated;
  }

  /**
   * Delete envelope
   */
  async deleteEnvelope(envelopeId: string): Promise<void> {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);

    if (envelope.status !== EnvelopeStatus.DRAFT && envelope.status !== EnvelopeStatus.DECLINED) {
      throw new Error(`Cannot delete envelope in ${envelope.status} status`);
    }

    this.envelopes.delete(envelopeId);
  }

  /**
   * Clone existing envelope
   */
  async cloneEnvelope(envelopeId: string, newName: string, userId: string): Promise<Envelope> {
    const original = this.envelopes.get(envelopeId);
    if (!original) throw new Error(`Envelope ${envelopeId} not found`);

    const cloned = await this.createEnvelope(original.tenantId, userId, {
      ...original,
      name: newName,
      documents: JSON.parse(JSON.stringify(original.documents)),
      signers: JSON.parse(JSON.stringify(original.signers)).map((s: Signer) => ({
        ...s,
        id: `signer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending',
        signedAt: undefined,
      })),
      fields: JSON.parse(JSON.stringify(original.fields)),
      templateId: original.templateId,
    });

    return cloned;
  }

  /**
   * List envelopes with pagination
   */
  async listEnvelopes(
    tenantId: string,
    filters?: {
      status?: EnvelopeStatus;
      createdByUserId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ envelopes: Envelope[]; total: number }> {
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    let results = Array.from(this.envelopes.values()).filter(e => e.tenantId === tenantId);

    if (filters?.status) {
      results = results.filter(e => e.status === filters.status);
    }

    if (filters?.createdByUserId) {
      results = results.filter(e => e.createdByUserId === filters.createdByUserId);
    }

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return { envelopes: paginated, total };
  }

  /**
   * Add signer to envelope
   */
  async addSigner(envelopeId: string, signer: Signer): Promise<Signer> {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);

    if (envelope.status !== EnvelopeStatus.DRAFT) {
      throw new Error(`Cannot add signer to envelope in ${envelope.status} status`);
    }

    const newSigner: Signer = {
      ...signer,
      id: `signer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      envelopeId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    envelope.signers.push(newSigner);
    envelope.signatureProgress.totalSigners = envelope.signers.length;
    envelope.updatedAt = new Date();

    this.envelopes.set(envelopeId, envelope);

    return newSigner;
  }

  /**
   * Add document to envelope
   */
  async addDocument(envelopeId: string, document: EnvelopeDocument): Promise<EnvelopeDocument> {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);

    if (envelope.status !== EnvelopeStatus.DRAFT) {
      throw new Error(`Cannot add document to envelope in ${envelope.status} status`);
    }

    const newDoc: EnvelopeDocument = {
      ...document,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      envelopeId,
      documentHash: this.calculateDocumentHash(document.storageKey),
      uploadedAt: new Date(),
    };

    envelope.documents.push(newDoc);
    envelope.updatedAt = new Date();
    this.envelopes.set(envelopeId, envelope);

    return newDoc;
  }

  /**
   * Private method: calculate document hash for tamper detection
   */
  private calculateDocumentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Add audit event to envelope
   */
  private addAuditEvent(envelopeId: string, event: Omit<AuditEvent, 'id'>): void {
    const envelope = this.envelopes.get(envelopeId);
    if (!envelope) return;

    const auditEvent: AuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      envelopeId,
    };

    envelope.auditTrail.push(auditEvent);
  }
}

/**
 * Envelope Validator
 * Validates envelope configuration and field placement before sending
 */
export class EnvelopeValidator {
  /**
   * Validate field placement on documents
   */
  validateFieldPlacement(envelope: Envelope): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of envelope.fields || []) {
      // Find document
      const doc = envelope.documents.find(d => d.id === field.documentId);
      if (!doc) {
        errors.push(`Field ${field.id}: Document ${field.documentId} not found`);
        continue;
      }

      // Validate page number
      if (field.pageNumber < 1 || field.pageNumber > doc.pageCount) {
        errors.push(`Field ${field.id}: Page ${field.pageNumber} out of range (1-${doc.pageCount})`);
      }

      // Validate coordinates
      if (field.xPosition < 0 || field.yPosition < 0) {
        errors.push(`Field ${field.id}: Negative coordinates not allowed`);
      }

      if (field.width <= 0 || field.height <= 0) {
        errors.push(`Field ${field.id}: Invalid field dimensions`);
      }

      // Validate anchor text if provided
      if (field.anchorText && field.anchorText.length === 0) {
        errors.push(`Field ${field.id}: Anchor text cannot be empty`);
      }

      // Validate required fields have corresponding signers
      if (field.required) {
        const signer = envelope.signers.find(s => s.id === field.roleId);
        if (!signer) {
          errors.push(`Field ${field.id}: No signer assigned`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate signer routing order
   */
  validateSignerRouting(envelope: Envelope): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate routing orders
    const orders = envelope.signers.map(s => s.routingOrder);
    const duplicates = orders.filter((item, index) => orders.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate routing orders found: ${duplicates.join(', ')}`);
    }

    // Check for gaps in routing order
    const sortedOrders = [...new Set(orders)].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i + 1) {
        errors.push(`Routing order gap: expected ${i + 1}, got ${sortedOrders[i]}`);
      }
    }

    // Check for required signers
    if (envelope.signers.filter(s => s.role === SignerRole.SIGNER).length === 0) {
      errors.push('Envelope must have at least one signer with SIGNER role');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Comprehensive envelope validation
   */
  validateEnvelope(envelope: Envelope): { valid: boolean; allErrors: string[] } {
    const allErrors: string[] = [];

    // Basic validations
    if (!envelope.name || envelope.name.trim().length === 0) {
      allErrors.push('Envelope name is required');
    }

    if (envelope.documents.length === 0) {
      allErrors.push('Envelope must contain at least one document');
    }

    if (envelope.signers.length === 0) {
      allErrors.push('Envelope must have at least one signer');
    }

    // Field placement validation
    const fieldValidation = this.validateFieldPlacement(envelope);
    allErrors.push(...fieldValidation.errors);

    // Signer routing validation
    const routingValidation = this.validateSignerRouting(envelope);
    allErrors.push(...routingValidation.errors);

    return { valid: allErrors.length === 0, allErrors };
  }
}

/**
 * Envelope Status Tracker
 * State machine for managing envelope lifecycle and transitions
 */
export class EnvelopeStatusTracker {
  private stateTransitions: Map<EnvelopeStatus, EnvelopeStatus[]> = new Map([
    [EnvelopeStatus.DRAFT, [EnvelopeStatus.SENT, EnvelopeStatus.VOIDED]],
    [EnvelopeStatus.SENT, [EnvelopeStatus.DELIVERED, EnvelopeStatus.VOIDED]],
    [EnvelopeStatus.DELIVERED, [EnvelopeStatus.SIGNED, EnvelopeStatus.DECLINED, EnvelopeStatus.VOIDED, EnvelopeStatus.EXPIRED]],
    [EnvelopeStatus.SIGNED, [EnvelopeStatus.COMPLETED, EnvelopeStatus.DECLINED, EnvelopeStatus.VOIDED]],
    [EnvelopeStatus.COMPLETED, [EnvelopeStatus.VOIDED]],
    [EnvelopeStatus.DECLINED, [EnvelopeStatus.SENT, EnvelopeStatus.VOIDED]],
    [EnvelopeStatus.VOIDED, []],
    [EnvelopeStatus.EXPIRED, [EnvelopeStatus.VOIDED]],
  ]);

  /**
   * Transition envelope to new status
   */
  async transitionStatus(
    envelope: Envelope,
    newStatus: EnvelopeStatus,
  ): Promise<{ success: boolean; error?: string }> {
    const validTransitions = this.stateTransitions.get(envelope.status) || [];

    if (!validTransitions.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid transition from ${envelope.status} to ${newStatus}`,
      };
    }

    const previousStatus = envelope.status;
    envelope.status = newStatus;
    envelope.updatedAt = new Date();

    // Set timestamps for specific transitions
    if (newStatus === EnvelopeStatus.SENT) {
      envelope.sentAt = new Date();
    } else if (newStatus === EnvelopeStatus.COMPLETED) {
      envelope.completedAt = new Date();
    } else if (newStatus === EnvelopeStatus.VOIDED) {
      envelope.voidedAt = new Date();
    }

    return { success: true };
  }

  /**
   * Check if status transition is valid
   */
  canTransition(currentStatus: EnvelopeStatus, targetStatus: EnvelopeStatus): boolean {
    const validTransitions = this.stateTransitions.get(currentStatus) || [];
    return validTransitions.includes(targetStatus);
  }
}

/**
 * Bulk Send Manager
 * Handles CSV import, variable substitution, and batch envelope processing
 */
export class BulkSendManager {
  private envelopeManager: EnvelopeManager;

  constructor(envelopeManager: EnvelopeManager) {
    this.envelopeManager = envelopeManager;
  }

  /**
   * Import and parse CSV for bulk sending
   */
  async importCsvData(
    csvContent: string,
    config: BulkSendConfiguration,
  ): Promise<Array<Record<string, string>>> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row);
    }

    return rows;
  }

  /**
   * Substitute template variables in envelope
   */
  async substituteVariables(
    template: any,
    variables: Record<string, string>,
  ): Promise<Envelope> {
    // Clone template and replace variables
    const envelopeData = JSON.parse(JSON.stringify(template));

    const substitute = (obj: any): any => {
      if (typeof obj === 'string') {
        let result = obj;
        Object.entries(variables).forEach(([key, value]) => {
          result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
        return result;
      } else if (Array.isArray(obj)) {
        return obj.map(substitute);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        Object.entries(obj).forEach(([key, value]) => {
          result[key] = substitute(value);
        });
        return result;
      }
      return obj;
    };

    return substitute(envelopeData);
  }

  /**
   * Process batch of envelopes
   */
  async processBatch(
    templateId: string,
    csvRows: Array<Record<string, string>>,
    config: BulkSendConfiguration,
  ): Promise<{
    successful: string[];
    failed: Array<{ rowIndex: number; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];

      try {
        // Map CSV row to template variables
        const variables: Record<string, string> = {};
        Object.entries(config.fieldMappings).forEach(([csvColumn, templateVar]) => {
          variables[templateVar] = row[csvColumn] || '';
        });

        // Validate recipient email
        const recipientEmail = row[config.recipientColumn];
        if (!recipientEmail || !recipientEmail.includes('@')) {
          throw new Error('Invalid recipient email');
        }

        // Substitute variables in envelope template
        const envelope = await this.substituteVariables({ templateId }, variables);

        // TODO: Save envelope to database
        successful.push(recipientEmail);
      } catch (error) {
        failed.push({
          rowIndex: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }
}

/**
 * Envelope Merger
 * Combines multiple envelopes or documents into single signing envelope
 */
export class EnvelopeMerger {
  /**
   * Merge multiple envelopes into one
   */
  async mergeEnvelopes(
    sourceEnvelopeIds: string[],
    newEnvelopeName: string,
    tenantId: string,
    userId: string,
    envelopeManager: EnvelopeManager,
  ): Promise<EnvelopeMergeResult> {
    const result: EnvelopeMergeResult = {
      newEnvelopeId: '',
      mergedDocumentCount: 0,
      totalPageCount: 0,
      mergedFieldCount: 0,
      createdAt: new Date(),
      status: 'success',
      errors: [],
    };

    try {
      // Collect all documents and signers from source envelopes
      const mergedDocuments: EnvelopeDocument[] = [];
      const mergedSigners: Map<string, Signer> = new Map();
      const mergedFields: any[] = [];
      let pageOffset = 0;

      for (const envelopeId of sourceEnvelopeIds) {
        const envelope = await envelopeManager.getEnvelope(envelopeId);
        if (!envelope) {
          result.errors?.push({
            envelopeId,
            error: 'Envelope not found',
          });
          continue;
        }

        // Merge documents
        for (const doc of envelope.documents) {
          mergedDocuments.push({
            ...doc,
            id: `doc_merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          });
        }

        result.mergedDocumentCount += envelope.documents.length;
        result.totalPageCount += envelope.documents.reduce((sum, d) => sum + d.pageCount, 0);

        // Merge unique signers
        for (const signer of envelope.signers) {
          const key = `${signer.email}_${signer.role}`;
          if (!mergedSigners.has(key)) {
            mergedSigners.set(key, { ...signer });
          }
        }

        // Merge fields with updated page offsets
        for (const field of envelope.fields || []) {
          mergedFields.push({
            ...field,
            pageNumber: field.pageNumber + pageOffset,
          });
        }

        result.mergedFieldCount += envelope.fields?.length || 0;
        pageOffset += envelope.documents.reduce((sum, d) => sum + d.pageCount, 0);
      }

      // Create new merged envelope
      const newEnvelope = await envelopeManager.createEnvelope(tenantId, userId, {
        name: newEnvelopeName,
        documents: mergedDocuments,
        signers: Array.from(mergedSigners.values()),
        fields: mergedFields,
      });

      result.newEnvelopeId = newEnvelope.id;
      return result;
    } catch (error) {
      result.status = 'failed';
      result.errors = [{ envelopeId: '', error: error instanceof Error ? error.message : 'Unknown error' }];
      return result;
    }
  }
}
