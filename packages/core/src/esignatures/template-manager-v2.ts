/**
 * Template Manager v2
 * Manages template lifecycle, versioning, field mapping, and analytics
 */

import {
  Template,
  TemplateDocument,
  TemplateField,
  TemplateVariable,
  SignerRole,
  SignerRoleDefinition,
  FieldMapping,
  FieldType,
  AuthenticationMethod,
  type TemplateAnalytics as TemplateAnalyticsType,
} from './esignature-types';

/**
 * Template Manager
 * CRUD operations, versioning, categories, sharing
 */
export class TemplateManager {
  private templates: Map<string, Template> = new Map();
  private templateVersions: Map<string, string[]> = new Map(); // templateId -> versionIds

  /**
   * Create new template
   */
  async createTemplate(
    tenantId: string,
    userId: string,
    data: Partial<Template>,
  ): Promise<Template> {
    const template: Template = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      name: data.name || 'Untitled Template',
      version: 1,
      isPublished: false,
      isLatestPublished: false,
      createdByUserId: userId,
      documents: data.documents || [],
      roles: data.roles || [],
      fields: data.fields || [],
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
      variables: data.variables || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: data.description,
      category: data.category,
      sharedWith: data.sharedWith,
      sharePermission: data.sharePermission,
      usageCount: 0,
    };

    this.templates.set(template.id, template);
    this.templateVersions.set(template.id, [template.id]);

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Update template (creates new version if published)
   */
  async updateTemplate(templateId: string, updates: Partial<Template>): Promise<Template> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // If template is published, create a new version
    if (template.isPublished) {
      return this.createNewVersion(templateId, updates);
    }

    // Otherwise, update draft version
    const updated: Template = {
      ...template,
      ...updates,
      id: template.id,
      tenantId: template.tenantId,
      createdByUserId: template.createdByUserId,
      version: template.version,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  /**
   * Create new version of template
   */
  async createNewVersion(
    templateId: string,
    updates: Partial<Template>,
  ): Promise<Template> {
    const original = this.templates.get(templateId);
    if (!original) throw new Error(`Template ${templateId} not found`);

    const newVersion: Template = {
      ...original,
      ...updates,
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: original.version + 1,
      previousVersionId: templateId,
      isPublished: false,
      isLatestPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(newVersion.id, newVersion);

    const versions = this.templateVersions.get(templateId) || [];
    versions.push(newVersion.id);
    this.templateVersions.set(templateId, versions);

    return newVersion;
  }

  /**
   * Publish template version
   */
  async publishTemplate(templateId: string): Promise<Template> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // Unpublish previous version if exists
    const versions = this.templateVersions.get(template.previousVersionId || templateId) || [];
    for (const versionId of versions) {
      const v = this.templates.get(versionId);
      if (v && v.isLatestPublished) {
        v.isLatestPublished = false;
      }
    }

    template.isPublished = true;
    template.isLatestPublished = true;
    template.publishedAt = new Date();
    template.updatedAt = new Date();

    this.templates.set(templateId, template);
    return template;
  }

  /**
   * List templates with filters
   */
  async listTemplates(
    tenantId: string,
    filters?: {
      category?: string;
      published?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ templates: Template[]; total: number }> {
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    let results = Array.from(this.templates.values()).filter(
      t => t.tenantId === tenantId && t.isLatestPublished !== false,
    );

    if (filters?.category) {
      results = results.filter(t => t.category === filters.category);
    }

    if (filters?.published !== undefined) {
      results = results.filter(t => t.isPublished === filters.published);
    }

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return { templates: paginated, total };
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    this.templates.delete(templateId);
  }

  /**
   * Share template with users
   */
  async shareTemplate(
    templateId: string,
    userIds: string[],
    permission: 'view' | 'edit' | 'admin',
  ): Promise<Template> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    template.sharedWith = [...new Set([...(template.sharedWith || []), ...userIds])];
    template.sharePermission = permission;
    template.updatedAt = new Date();

    this.templates.set(templateId, template);
    return template;
  }

  /**
   * Add document to template
   */
  async addDocument(templateId: string, document: TemplateDocument): Promise<TemplateDocument> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    const newDoc: TemplateDocument = {
      ...document,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      orderIndex: template.documents.length,
    };

    template.documents.push(newDoc);
    template.updatedAt = new Date();
    this.templates.set(templateId, template);

    return newDoc;
  }
}

/**
 * Field Mapper
 * Handles anchor text detection and coordinate-based field placement
 */
export class FieldMapper {
  /**
   * Detect and place fields using anchor text
   */
  async detectFieldsByAnchorText(
    documentContent: string,
    fieldMappings: FieldMapping[],
  ): Promise<TemplateField[]> {
    const detectedFields: TemplateField[] = [];

    for (const mapping of fieldMappings) {
      const regex = mapping.caseSensitive
        ? new RegExp(mapping.wholeWord ? `\\b${mapping.anchorText}\\b` : mapping.anchorText)
        : new RegExp(
            mapping.wholeWord ? `\\b${mapping.anchorText}\\b` : mapping.anchorText,
            'i',
          );

      const match = documentContent.match(regex);
      if (match && match.index !== undefined) {
        const field: TemplateField = {
          id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          templateId: '',
          documentId: '',
          pageNumber: 1,
          fieldType: mapping.fieldType,
          roleId: mapping.roleId,
          anchorText: mapping.anchorText,
          anchorXOffset: mapping.offsetX,
          anchorYOffset: mapping.offsetY,
          xPosition: match.index + mapping.offsetX,
          yPosition: 0 + mapping.offsetY,
          width: mapping.width,
          height: 40, // Default height
          required: true,
        };

        detectedFields.push(field);
      }
    }

    return detectedFields;
  }

  /**
   * Validate coordinate-based field placement
   */
  validateCoordinatePlacement(
    field: TemplateField,
    pageWidth: number = 612,
    pageHeight: number = 792,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (field.xPosition < 0 || field.yPosition < 0) {
      errors.push(`Negative coordinates not allowed`);
    }

    if (field.xPosition + field.width > pageWidth) {
      errors.push(`Field extends beyond page width`);
    }

    if (field.yPosition + field.height > pageHeight) {
      errors.push(`Field extends beyond page height`);
    }

    if (field.width <= 0 || field.height <= 0) {
      errors.push(`Invalid field dimensions`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert anchor-based positioning to coordinates
   */
  async resolveAnchorToCoordinates(
    field: TemplateField,
    documentContent: string,
  ): Promise<{ x: number; y: number }> {
    if (!field.anchorText) {
      return { x: field.xPosition, y: field.yPosition };
    }

    // Simple resolution: find anchor text and offset from it
    const anchorIndex = documentContent.indexOf(field.anchorText);
    if (anchorIndex === -1) {
      return { x: field.xPosition, y: field.yPosition };
    }

    // This is a simplified version; real implementation would need PDF parsing
    const approximateX = (anchorIndex % 100) * 6; // Rough approximation
    const approximateY = Math.floor(anchorIndex / 100) * 15; // Rough approximation

    return {
      x: approximateX + (field.anchorXOffset || 0),
      y: approximateY + (field.anchorYOffset || 0),
    };
  }

  /**
   * Create tab group for grouped fields
   */
  createTabGroup(
    fields: TemplateField[],
    groupName: string,
  ): { groupId: string; fields: TemplateField[] } {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add group metadata to fields
    const groupedFields = fields.map(f => ({
      ...f,
      label: f.label ? `${groupName}_${f.label}` : groupName,
    }));

    return { groupId, fields: groupedFields };
  }
}

/**
 * Role Manager
 * Manages signer roles, routing order, and conditional logic
 */
export class RoleManager {
  private roles: Map<string, SignerRoleDefinition> = new Map();

  /**
   * Define new signer role
   */
  async defineRole(
    templateId: string,
    roleData: Partial<SignerRoleDefinition>,
  ): Promise<SignerRoleDefinition> {
    const role: SignerRoleDefinition = {
      id: `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      name: roleData.name || 'Signer',
      routingOrder: roleData.routingOrder || 1,
      signerRole: roleData.signerRole || SignerRole.SIGNER,
      authenticationMethod: roleData.authenticationMethod || AuthenticationMethod.EMAIL,
      requireIdVerification: roleData.requireIdVerification ?? false,
      allowDelegation: roleData.allowDelegation ?? false,
      delegateToEmail: roleData.delegateToEmail,
      conditionalLogic: roleData.conditionalLogic,
    };

    this.roles.set(role.id, role);
    return role;
  }

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<SignerRoleDefinition | null> {
    return this.roles.get(roleId) || null;
  }

  /**
   * List roles for template in routing order
   */
  async listRolesByTemplate(templateId: string): Promise<SignerRoleDefinition[]> {
    const templateRoles = Array.from(this.roles.values()).filter(r => r.templateId === templateId);
    return templateRoles.sort((a, b) => a.routingOrder - b.routingOrder);
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, updates: Partial<SignerRoleDefinition>): Promise<SignerRoleDefinition> {
    const role = this.roles.get(roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);

    const updated: SignerRoleDefinition = {
      ...role,
      ...updates,
      id: role.id,
      templateId: role.templateId,
    };

    this.roles.set(roleId, updated);
    return updated;
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    this.roles.delete(roleId);
  }

  /**
   * Evaluate conditional routing logic
   */
  evaluateConditionalRouting(
    role: SignerRoleDefinition,
    context: Record<string, any>,
  ): boolean {
    if (!role.conditionalLogic) return true;

    try {
      // Simple expression evaluation (in production, use safer evaluator)
      const func = new Function('context', `return ${role.conditionalLogic}`);
      return func(context) as boolean;
    } catch {
      return true; // Default to including if condition fails
    }
  }
}

/**
 * Variable Manager
 * Manages template variables and default values
 */
export class VariableManager {
  private variables: Map<string, TemplateVariable> = new Map();

  /**
   * Add variable to template
   */
  async addVariable(
    templateId: string,
    variableData: Partial<TemplateVariable>,
  ): Promise<TemplateVariable> {
    const variable: TemplateVariable = {
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      name: variableData.name || '',
      displayName: variableData.displayName || variableData.name || '',
      type: variableData.type || 'text',
      defaultValue: variableData.defaultValue,
      required: variableData.required ?? false,
      validationRule: variableData.validationRule,
      description: variableData.description,
    };

    this.variables.set(variable.id, variable);
    return variable;
  }

  /**
   * Get variable by ID
   */
  async getVariable(variableId: string): Promise<TemplateVariable | null> {
    return this.variables.get(variableId) || null;
  }

  /**
   * List variables for template
   */
  async listVariablesByTemplate(templateId: string): Promise<TemplateVariable[]> {
    return Array.from(this.variables.values()).filter(v => v.templateId === templateId);
  }

  /**
   * Validate variable value against rules
   */
  validateVariableValue(
    variable: TemplateVariable,
    value: string,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (variable.required && (!value || value.trim().length === 0)) {
      errors.push(`${variable.displayName} is required`);
      return { valid: false, errors };
    }

    // Type validation
    switch (variable.type) {
      case 'email':
        if (value && !value.includes('@')) {
          errors.push(`${variable.displayName} must be a valid email`);
        }
        break;
      case 'phone':
        if (value && !/^\d{10,}$/.test(value.replace(/\D/g, ''))) {
          errors.push(`${variable.displayName} must be a valid phone number`);
        }
        break;
      case 'date':
        if (value && isNaN(Date.parse(value))) {
          errors.push(`${variable.displayName} must be a valid date`);
        }
        break;
      case 'number':
        if (value && isNaN(Number(value))) {
          errors.push(`${variable.displayName} must be a valid number`);
        }
        break;
    }

    // Custom validation rule
    if (variable.validationRule && value) {
      try {
        const regex = new RegExp(variable.validationRule);
        if (!regex.test(value)) {
          errors.push(`${variable.displayName} does not match required format`);
        }
      } catch {
        errors.push(`Invalid validation rule for ${variable.displayName}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Substitute variables in template
   */
  async substituteVariables(
    templateText: string,
    variables: Record<string, string>,
  ): Promise<string> {
    let result = templateText;

    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    });

    return result;
  }
}

/**
 * TemplateAnalyticsManager
 * Tracks usage, completion rates, and performance metrics
 */
export class TemplateAnalyticsManager {
  private analytics: Map<string, TemplateAnalyticsType> = new Map();

  /**
   * Initialize analytics for template
   */
  async initializeAnalytics(templateId: string): Promise<TemplateAnalyticsType> {
    const analytics: TemplateAnalyticsType = {
      templateId,
      tenantId: '',
      totalEnvelopesCreated: 0,
      totalEnvelopesSigned: 0,
      totalEnvelopesDeclined: 0,
      completionRate: 0,
      averageCompletionDays: 0,
      averageSigningTimeMinutes: 0,
      declineRate: 0,
      declineReasons: {},
      updatedAt: new Date(),
    };

    this.analytics.set(templateId, analytics);
    return analytics;
  }

  /**
   * Record envelope creation
   */
  async recordEnvelopeCreated(templateId: string): Promise<void> {
    const analytics = this.analytics.get(templateId);
    if (analytics) {
      analytics.totalEnvelopesCreated++;
      analytics.updatedAt = new Date();
    }
  }

  /**
   * Record envelope completion
   */
  async recordEnvelopeCompleted(
    templateId: string,
    completionDays: number,
    signingTimeMinutes: number,
  ): Promise<void> {
    const analytics = this.analytics.get(templateId);
    if (analytics) {
      analytics.totalEnvelopesSigned++;

      // Update averages
      const totalCompleted = analytics.totalEnvelopesSigned;
      analytics.averageCompletionDays =
        (analytics.averageCompletionDays * (totalCompleted - 1) + completionDays) / totalCompleted;
      analytics.averageSigningTimeMinutes =
        (analytics.averageSigningTimeMinutes * (totalCompleted - 1) + signingTimeMinutes) / totalCompleted;

      // Update completion rate
      const totalAttempts = analytics.totalEnvelopesCreated;
      analytics.completionRate = totalAttempts > 0 ? (totalCompleted / totalAttempts) * 100 : 0;

      analytics.updatedAt = new Date();
    }
  }

  /**
   * Record envelope decline
   */
  async recordEnvelopeDeclined(templateId: string, reason?: string): Promise<void> {
    const analytics = this.analytics.get(templateId);
    if (analytics) {
      analytics.totalEnvelopesDeclined++;

      if (reason) {
        analytics.declineReasons[reason] = (analytics.declineReasons[reason] || 0) + 1;
      }

      // Update decline rate
      const totalAttempts = analytics.totalEnvelopesCreated;
      analytics.declineRate = totalAttempts > 0 ? (analytics.totalEnvelopesDeclined / totalAttempts) * 100 : 0;

      analytics.updatedAt = new Date();
    }
  }

  /**
   * Get analytics for template
   */
  async getAnalytics(templateId: string): Promise<TemplateAnalyticsType | null> {
    return this.analytics.get(templateId) || null;
  }

  /**
   * Get peak usage time
   */
  async getPeakUsageTime(templateId: string): Promise<{ day?: string; hour?: number } | null> {
    const analytics = this.analytics.get(templateId);
    return analytics ? { day: analytics.peakUsageDay, hour: analytics.peakUsageHour } : null;
  }
}
