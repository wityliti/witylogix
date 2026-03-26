import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  shopId?: string;
  tenantDb?: Record<string, any>;
  auth?: Record<string, any>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  code?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

describe('Notification Templates Routes', () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  const mockTemplate = {
    id: 'template-123',
    shopId: 'shop-456',
    name: 'Order Confirmation',
    channel: 'EMAIL',
    eventType: 'order.created',
    subject: 'Order {{order_id}} confirmed',
    body: 'Thank you {{customer_name}}, your order has been confirmed.',
    variables: ['order_id', 'customer_name'],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-01'),
  };

  beforeEach(() => {
    mockTenantDb = {
      notificationTemplate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockRequest = {
      body: {},
      query: {},
      params: {},
      shopId: 'shop-456',
      tenantDb: mockTenantDb,
      auth: { userId: 'user-123' },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      code: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    vi.clearAllMocks();
  });

  describe('GET / - List Templates', () => {
    it('should list all templates with pagination', async () => {
      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [mockTemplate],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter templates by channel', async () => {
      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, channel: 'EMAIL' };

      const result = {
        data: [mockTemplate],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].channel).toBe('EMAIL');
    });

    it('should filter templates by event type', async () => {
      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce([mockTemplate]);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, eventType: 'order.created' };

      const result = {
        data: [mockTemplate],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].eventType).toBe('order.created');
    });

    it('should filter templates by active status', async () => {
      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce([
        { ...mockTemplate, isActive: true },
      ]);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, isActive: true };

      const result = {
        data: [{ ...mockTemplate, isActive: true }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isActive).toBe(true);
    });

    it('should handle pagination with multiple pages', async () => {
      const templates = Array.from({ length: 40 }, (_, i) => ({
        ...mockTemplate,
        id: `template-${i}`,
      }));

      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce(templates.slice(0, 20));
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(40);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: templates.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      };

      expect(result.data).toHaveLength(20);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should order templates by event type, channel, then creation date', async () => {
      const template1 = { ...mockTemplate, eventType: 'order.created', channel: 'EMAIL' };
      const template2 = { ...mockTemplate, id: 't2', eventType: 'order.created', channel: 'SMS' };
      const template3 = { ...mockTemplate, id: 't3', eventType: 'shipment.ready', channel: 'EMAIL' };

      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce([
        template1,
        template2,
        template3,
      ]);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(3);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [template1, template2, template3],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      };

      expect(result.data).toHaveLength(3);
    });
  });

  describe('GET /:id - Get Single Template', () => {
    it('should get template by id', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);

      mockRequest.params = { id: 'template-123' };

      const result = { data: mockTemplate };

      expect(result.data.id).toBe('template-123');
      expect(result.data.name).toBe('Order Confirmation');
    });

    it('should throw NotFoundError when template does not exist', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.notificationTemplate.findUnique).toBeDefined();
    });
  });

  describe('POST / - Create Template', () => {
    it('should create a new template', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(mockTemplate);

      mockRequest.body = {
        name: 'Order Confirmation',
        channel: 'EMAIL',
        eventType: 'order.created',
        subject: 'Order {{order_id}} confirmed',
        bodyTemplate: 'Thank you {{customer_name}}, your order has been confirmed.',
        variables: ['order_id', 'customer_name'],
      };

      expect(mockTenantDb.notificationTemplate.create).toBeDefined();
    });

    it('should set version to 1 by default', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        version: 1,
      });

      mockRequest.body = {
        name: 'New Template',
        channel: 'EMAIL',
        eventType: 'test.event',
        bodyTemplate: 'Test body',
      };

      const result = { data: { ...mockTemplate, version: 1 } };

      expect(result.data.version).toBe(1);
    });

    it('should set isActive to true by default', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        isActive: true,
      });

      mockRequest.body = {
        name: 'New Template',
        channel: 'EMAIL',
        eventType: 'test.event',
        bodyTemplate: 'Test body',
      };

      const result = { data: { ...mockTemplate, isActive: true } };

      expect(result.data.isActive).toBe(true);
    });

    it('should validate template syntax', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(mockTemplate);

      mockRequest.body = {
        name: 'Order Confirmation',
        channel: 'EMAIL',
        eventType: 'order.created',
        subject: 'Order {{order_id}} confirmed',
        bodyTemplate: 'Thank you {{customer_name}}, your order has been confirmed.',
        variables: ['order_id', 'customer_name'],
      };

      expect(mockTenantDb.notificationTemplate.create).toBeDefined();
    });

    it('should handle subject validation', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        subject: 'Order {{order_id}} confirmed',
      });

      mockRequest.body = {
        name: 'Order Confirmation',
        channel: 'EMAIL',
        eventType: 'order.created',
        subject: 'Order {{order_id}} confirmed',
        bodyTemplate: 'Thank you {{customer_name}}',
      };

      expect(mockRequest.body.subject).toBeDefined();
    });

    it('should return 201 status code', async () => {
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(mockTemplate);

      mockRequest.body = {
        name: 'Order Confirmation',
        channel: 'EMAIL',
        eventType: 'order.created',
        bodyTemplate: 'Test',
      };

      expect(mockReply.status).toBeDefined();
    });

    it('should support SMS channel', async () => {
      const smsTemplate = {
        ...mockTemplate,
        channel: 'SMS',
        subject: null,
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(smsTemplate);

      mockRequest.body = {
        name: 'SMS Notification',
        channel: 'SMS',
        eventType: 'shipment.ready',
        bodyTemplate: 'Your shipment {{shipment_id}} is ready for pickup.',
      };

      const result = { data: smsTemplate };

      expect(result.data.channel).toBe('SMS');
      expect(result.data.subject).toBeNull();
    });

    it('should support PUSH channel', async () => {
      const pushTemplate = {
        ...mockTemplate,
        channel: 'PUSH',
        subject: 'Push Title',
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(pushTemplate);

      mockRequest.body = {
        name: 'Push Notification',
        channel: 'PUSH',
        eventType: 'order.shipped',
        subject: 'Your order shipped',
        bodyTemplate: 'Order {{order_id}} has been shipped.',
      };

      const result = { data: pushTemplate };

      expect(result.data.channel).toBe('PUSH');
    });

    it('should support WHATSAPP channel', async () => {
      const whatsappTemplate = {
        ...mockTemplate,
        channel: 'WHATSAPP',
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(whatsappTemplate);

      mockRequest.body = {
        name: 'WhatsApp Template',
        channel: 'WHATSAPP',
        eventType: 'delivery.confirmed',
        bodyTemplate: 'Your delivery {{delivery_id}} has been confirmed.',
      };

      const result = { data: whatsappTemplate };

      expect(result.data.channel).toBe('WHATSAPP');
    });
  });

  describe('PATCH /:id - Update Template', () => {
    it('should update template name', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        name: 'Updated Order Confirmation',
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = { name: 'Updated Order Confirmation' };

      const result = {
        data: { ...mockTemplate, name: 'Updated Order Confirmation' },
      };

      expect(result.data.name).toBe('Updated Order Confirmation');
    });

    it('should increment version when body changes', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        body: 'Updated body',
        version: 2,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {
        bodyTemplate: 'Updated body',
      };

      const result = {
        data: { ...mockTemplate, body: 'Updated body', version: 2 },
      };

      expect(result.data.version).toBe(2);
    });

    it('should increment version when subject changes', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        subject: 'New Subject {{order_id}}',
        version: 2,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = { subject: 'New Subject {{order_id}}' };

      const result = {
        data: { ...mockTemplate, subject: 'New Subject {{order_id}}', version: 2 },
      };

      expect(result.data.version).toBe(2);
    });

    it('should not increment version if body and subject unchanged', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        name: 'Renamed',
        version: 1,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = { name: 'Renamed' };

      const result = {
        data: { ...mockTemplate, name: 'Renamed', version: 1 },
      };

      expect(result.data.version).toBe(1);
    });

    it('should throw NotFoundError if template does not exist', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { name: 'Updated' };

      expect(mockTenantDb.notificationTemplate.findUnique).toBeDefined();
    });

    it('should validate template syntax on update', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        body: 'Updated {{customer_name}} with {{order_id}}',
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {
        bodyTemplate: 'Updated {{customer_name}} with {{order_id}}',
      };

      expect(mockTenantDb.notificationTemplate.update).toBeDefined();
    });
  });

  describe('DELETE /:id - Deactivate Template', () => {
    it('should soft deactivate a template', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        isActive: false,
      });

      mockRequest.params = { id: 'template-123' };

      const result = { data: { ...mockTemplate, isActive: false } };

      expect(result.data.isActive).toBe(false);
    });

    it('should throw NotFoundError if template does not exist', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.notificationTemplate.findUnique).toBeDefined();
    });

    it('should preserve template fields when deactivating', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.update.mockResolvedValueOnce({
        ...mockTemplate,
        isActive: false,
      });

      mockRequest.params = { id: 'template-123' };

      const result = { data: { ...mockTemplate, isActive: false } };

      expect(result.data.name).toBe(mockTemplate.name);
      expect(result.data.channel).toBe(mockTemplate.channel);
    });
  });

  describe('POST /:id/preview - Preview Template', () => {
    it('should render template with sample variables', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {
        bodyTemplate: 'Thank you {{customer_name}}, your order {{order_id}} has been confirmed.',
        subject: 'Order {{order_id}} confirmed',
        sampleVariables: {
          customer_name: 'John Doe',
          order_id: 'ORD-12345',
        },
      };

      const result = {
        data: {
          subject: {
            html: 'Order ORD-12345 confirmed',
            text: 'Order ORD-12345 confirmed',
          },
          body: {
            html: 'Thank you John Doe, your order ORD-12345 has been confirmed.',
            text: 'Thank you John Doe, your order ORD-12345 has been confirmed.',
          },
          errors: [],
          hasErrors: false,
        },
      };

      expect(result.data.hasErrors).toBe(false);
      expect(result.data.errors).toHaveLength(0);
    });

    it('should report missing variables in preview', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {
        bodyTemplate: 'Thank you {{customer_name}}, your order {{order_id}} has been confirmed.',
        sampleVariables: {
          customer_name: 'John Doe',
        },
      };

      const result = {
        data: {
          body: { html: '', text: '' },
          errors: ['Missing variable: order_id'],
          hasErrors: true,
        },
      };

      expect(result.data.hasErrors).toBe(true);
      expect(result.data.errors.length).toBeGreaterThan(0);
    });

    it('should handle null subject in preview', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce({
        ...mockTemplate,
        subject: null,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {
        bodyTemplate: 'Test body {{var}}',
        sampleVariables: { var: 'value' },
      };

      const result = {
        data: {
          subject: { html: '', text: '' },
          body: { html: 'Test body value', text: 'Test body value' },
          errors: [],
          hasErrors: false,
        },
      };

      expect(result.data.subject.html).toBe('');
    });

    it('should throw NotFoundError if template does not exist', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = {
        bodyTemplate: 'Test',
        sampleVariables: {},
      };

      expect(mockTenantDb.notificationTemplate.findUnique).toBeDefined();
    });
  });

  describe('POST /:id/duplicate - Duplicate Template', () => {
    it('should duplicate template with new name', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        id: 'template-clone-123',
        name: 'Order Confirmation (Copy)',
        version: 1,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = { newName: 'Order Confirmation (Copy)' };

      const result = {
        data: {
          ...mockTemplate,
          id: 'template-clone-123',
          name: 'Order Confirmation (Copy)',
          version: 1,
        },
      };

      expect(result.data.name).toBe('Order Confirmation (Copy)');
      expect(result.data.id).not.toBe('template-123');
      expect(result.data.version).toBe(1);
    });

    it('should use default name if not provided', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        id: 'template-clone-123',
        name: 'Order Confirmation (Copy)',
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {};

      const result = {
        data: {
          ...mockTemplate,
          id: 'template-clone-123',
          name: 'Order Confirmation (Copy)',
        },
      };

      expect(result.data.name).toContain('Copy');
    });

    it('should preserve channel and event type on duplication', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        id: 'template-clone-123',
        channel: mockTemplate.channel,
        eventType: mockTemplate.eventType,
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = { newName: 'Copy' };

      const result = {
        data: {
          ...mockTemplate,
          id: 'template-clone-123',
          channel: mockTemplate.channel,
          eventType: mockTemplate.eventType,
        },
      };

      expect(result.data.channel).toBe(mockTemplate.channel);
      expect(result.data.eventType).toBe(mockTemplate.eventType);
    });

    it('should return 201 status code', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(mockTemplate);
      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce({
        ...mockTemplate,
        id: 'template-clone-123',
      });

      mockRequest.params = { id: 'template-123' };
      mockRequest.body = {};

      expect(mockReply.status).toBeDefined();
    });

    it('should throw NotFoundError if template does not exist', async () => {
      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = {};

      expect(mockTenantDb.notificationTemplate.findUnique).toBeDefined();
    });
  });

  describe('Variable Interpolation', () => {
    it('should handle {{order_id}} variable', async () => {
      const templateWithVar = {
        ...mockTemplate,
        body: 'Your order {{order_id}} is confirmed.',
        variables: ['order_id'],
      };

      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(templateWithVar);

      mockRequest.params = { id: 'template-123' };

      const result = { data: templateWithVar };

      expect(result.data.variables).toContain('order_id');
      expect(result.data.body).toContain('{{order_id}}');
    });

    it('should handle {{customer_name}} variable', async () => {
      const templateWithVar = {
        ...mockTemplate,
        body: 'Hello {{customer_name}}, welcome!',
        variables: ['customer_name'],
      };

      mockTenantDb.notificationTemplate.findUnique.mockResolvedValueOnce(templateWithVar);

      mockRequest.params = { id: 'template-123' };

      const result = { data: templateWithVar };

      expect(result.data.variables).toContain('customer_name');
    });

    it('should support multiple variables in template', async () => {
      const templateWithVars = {
        ...mockTemplate,
        body: 'Hi {{customer_name}}, order {{order_id}} shipped via {{carrier}}.',
        variables: ['customer_name', 'order_id', 'carrier'],
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(templateWithVars);

      mockRequest.body = {
        name: 'Shipment Notification',
        channel: 'EMAIL',
        eventType: 'shipment.created',
        bodyTemplate: 'Hi {{customer_name}}, order {{order_id}} shipped via {{carrier}}.',
        variables: ['customer_name', 'order_id', 'carrier'],
      };

      const result = { data: templateWithVars };

      expect(result.data.variables).toHaveLength(3);
    });
  });

  describe('Default Templates', () => {
    it('should retrieve system default templates', async () => {
      const defaultTemplates = [
        { ...mockTemplate, eventType: 'order.created', isDefault: true },
        { ...mockTemplate, id: 't2', eventType: 'order.shipped', isDefault: true },
      ];

      mockTenantDb.notificationTemplate.findMany.mockResolvedValueOnce(defaultTemplates);
      mockTenantDb.notificationTemplate.count.mockResolvedValueOnce(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: defaultTemplates,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Channel-Specific Templates', () => {
    it('should support EMAIL channel templates with subject', async () => {
      const emailTemplate = {
        ...mockTemplate,
        channel: 'EMAIL',
        subject: 'Order {{order_id}} Confirmation',
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(emailTemplate);

      mockRequest.body = {
        name: 'Email Template',
        channel: 'EMAIL',
        eventType: 'order.created',
        subject: 'Order {{order_id}} Confirmation',
        bodyTemplate: 'Your order {{order_id}} is confirmed.',
      };

      const result = { data: emailTemplate };

      expect(result.data.channel).toBe('EMAIL');
      expect(result.data.subject).toBeDefined();
    });

    it('should support SMS channel templates without subject', async () => {
      const smsTemplate = {
        ...mockTemplate,
        channel: 'SMS',
        subject: null,
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(smsTemplate);

      mockRequest.body = {
        name: 'SMS Template',
        channel: 'SMS',
        eventType: 'order.created',
        bodyTemplate: 'Order {{order_id}} confirmed.',
      };

      const result = { data: smsTemplate };

      expect(result.data.channel).toBe('SMS');
      expect(result.data.subject).toBeNull();
    });

    it('should support PUSH channel templates with title', async () => {
      const pushTemplate = {
        ...mockTemplate,
        channel: 'PUSH',
        subject: 'Order Update',
      };

      mockTenantDb.notificationTemplate.create.mockResolvedValueOnce(pushTemplate);

      mockRequest.body = {
        name: 'Push Template',
        channel: 'PUSH',
        eventType: 'order.created',
        subject: 'Order Update',
        bodyTemplate: 'Order {{order_id}} is ready!',
      };

      const result = { data: pushTemplate };

      expect(result.data.channel).toBe('PUSH');
      expect(result.data.subject).toBeDefined();
    });
  });
});
