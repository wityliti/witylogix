/**
 * CRM Integration Sub-Routes
 *
 * Registered at /api/v4/integrations/crm
 *
 *   GET  /providers       — List CRM connections (Salesforce / HubSpot)
 *   GET  /sync-logs       — Recent sync log entries for this tenant
 *   GET  /field-mappings  — Field mappings for a connection
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@witylogix/db';
import { requireAuth } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';

async function crmIntegrationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // GET /providers  — CRM connections as provider cards
  fastify.get('/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;

    const connections = await prisma.cRMConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const providers = connections.map((conn) => ({
      id: conn.id,
      name: conn.provider === 'salesforce' ? 'Salesforce' : conn.provider === 'hubspot' ? 'HubSpot' : conn.provider,
      logo: conn.provider,
      status: conn.isActive ? ('connected' as const) : ('disconnected' as const),
      lastSync: conn.lastSyncAt?.toISOString() ?? '',
      syncCount: 0,
      contactsCount: 0,
      dealsCount: 0,
    }));

    return { data: providers, meta: { total: providers.length } };
  });

  // GET /sync-logs  — Recent sync history
  fastify.get('/sync-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;

    const logs = await prisma.cRMSyncLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const items = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      type: log.recordType as 'contact' | 'deal' | 'activity' | 'field',
      direction: log.direction as 'push' | 'pull' | 'bidirectional',
      status: log.status === 'synced' ? ('success' as const) : log.status === 'failed' ? ('failed' as const) : ('pending' as const),
      details: log.errorMessage ?? `${log.syncType} ${log.recordType}`,
      recordsAffected: 1,
    }));

    return { data: items, meta: { total: items.length } };
  });

  // GET /field-mappings  — Field mappings (optionally filtered by connectionId)
  fastify.get('/field-mappings', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { connectionId } = request.query as { connectionId?: string };

    const connections = await prisma.cRMConnection.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const connectionIds = connections.map((c) => c.id);
    if (connectionIds.length === 0) return { data: [], meta: { total: 0 } };

    const mappings = await prisma.cRMFieldMapping.findMany({
      where: {
        connectionId: connectionId ?? { in: connectionIds },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = mappings.map((m) => ({
      id: m.id,
      witylogixField: m.witylogixField,
      crmField: m.crmField,
      type: 'string' as const,
      required: m.isRequired,
      customMapping: true,
    }));

    return { data: items, meta: { total: items.length } };
  });
}

export default crmIntegrationRoutes;
