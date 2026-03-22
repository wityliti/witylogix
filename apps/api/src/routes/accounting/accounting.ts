/**
 * Accounting Integration Routes
 * OAuth flows, sync operations, and accounting status management
 *
 * Routes:
 *   POST   /accounting/connect/:provider       — Initiate OAuth flow
 *   GET    /accounting/callback/:provider      — OAuth callback handler
 *   GET    /accounting/status                  — Get connection status
 *   POST   /accounting/sync/invoice/:id        — Sync single invoice
 *   POST   /accounting/sync/batch              — Sync multiple invoices
 *   GET    /accounting/sync/history            — Get sync log
 *   DELETE /accounting/disconnect/:provider    — Disconnect provider
 *   POST   /accounting/reconcile               — Reconcile accounts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@witylogix/db';
import { QuickBooksAdapter, XeroAdapter, AccountingSyncService } from '@witylogix/core/integrations/accounting';
import { requireAuth } from '../../middleware/auth.js';
import { tenantContext } from '../../middleware/tenant.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../lib/errors.js';

// ─── SCHEMAS ─────────────────────────────────────────────────────────

const connectSchema = z.object({
  provider: z.enum(['quickbooks', 'xero']),
  state: z.string().optional(),
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  realmId: z.string().optional(), // QB specific
  redirectUri: z.string().url().optional(),
});

const syncInvoiceSchema = z.object({
  force: z.boolean().optional(),
  autoRetry: z.boolean().optional().default(true),
});

const batchSyncSchema = z.object({
  invoiceIds: z.array(z.string().uuid()),
  providers: z.array(z.enum(['quickbooks', 'xero'])).optional(),
  force: z.boolean().optional(),
});

const syncHistorySchema = z.object({
  provider: z.enum(['quickbooks', 'xero']).optional(),
  invoiceId: z.string().uuid().optional(),
  status: z.enum(['pending', 'synced', 'failed', 'skipped']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const reconcileSchema = z.object({
  provider: z.enum(['quickbooks', 'xero']),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});

// ─── REGISTER ROUTES ────────────────────────────────────────────────

export async function registerAccountingRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── OAuth Connect ──────────────────────────────────────────────

  /**
   * POST /accounting/connect/:provider
   * Initiate OAuth flow for accounting provider
   */
  fastify.post<{ Params: { provider: 'quickbooks' | 'xero' } }>(
    '/accounting/connect/:provider',
    {
      onRequest: [requireAuth, tenantContext],
      schema: {
        params: z.object({ provider: z.enum(['quickbooks', 'xero']) }),
        querystring: connectSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: 'quickbooks' | 'xero' };
      const { state } = request.query as { state?: string };
      const tenantId = request.user.tenantId;

      // INTEGRATION: Get provider config from environment
      let authUrl: string;

      if (provider === 'quickbooks') {
        const qbConfig = {
          clientId: process.env.QB_CLIENT_ID || '',
          clientSecret: process.env.QB_CLIENT_SECRET || '',
          redirectUri: `${process.env.API_BASE_URL}/accounting/callback/quickbooks`,
        };

        const adapter = new QuickBooksAdapter(qbConfig);
        authUrl = adapter.getAuthorizationUrl(state);
      } else {
        const xeroConfig = {
          clientId: process.env.XERO_CLIENT_ID || '',
          clientSecret: process.env.XERO_CLIENT_SECRET || '',
          redirectUri: `${process.env.API_BASE_URL}/accounting/callback/xero`,
        };

        const adapter = new XeroAdapter(xeroConfig);
        authUrl = adapter.getAuthorizationUrl(state);
      }

      // Store state in session for verification on callback
      // INTEGRATION: Store in Redis or session store
      request.session = request.session || {};
      (request.session as any).accountingState = state;
      (request.session as any).accountingProvider = provider;
      (request.session as any).accountingTenantId = tenantId;

      return reply.redirect(authUrl);
    },
  );

  // ─── OAuth Callback ─────────────────────────────────────────────

  /**
   * GET /accounting/callback/:provider
   * Handle OAuth callback from accounting provider
   */
  fastify.get<{ Params: { provider: 'quickbooks' | 'xero' } }>(
    '/accounting/callback/:provider',
    {
      schema: {
        params: z.object({ provider: z.enum(['quickbooks', 'xero']) }),
        querystring: callbackSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: 'quickbooks' | 'xero' };
      const { code, state, realmId } = request.query as { code: string; state?: string; realmId?: string };

      if (!code) {
        throw new ValidationError('Authorization code required');
      }

      // Verify state
      const sessionState = (request.session as any)?.accountingState;
      if (state && sessionState && state !== sessionState) {
        throw new ValidationError('Invalid state parameter');
      }

      const tenantId = (request.session as any)?.accountingTenantId;
      if (!tenantId) {
        throw new ForbiddenError('No tenant context in session');
      }

      try {
        let connection;

        if (provider === 'quickbooks') {
          if (!realmId) {
            throw new ValidationError('QB realmId required');
          }

          const qbConfig = {
            clientId: process.env.QB_CLIENT_ID || '',
            clientSecret: process.env.QB_CLIENT_SECRET || '',
            redirectUri: `${process.env.API_BASE_URL}/accounting/callback/quickbooks`,
          };

          const adapter = new QuickBooksAdapter(qbConfig);
          // INTEGRATION: Authenticate with QB
          connection = await adapter.authenticate(code, realmId);
        } else {
          const xeroConfig = {
            clientId: process.env.XERO_CLIENT_ID || '',
            clientSecret: process.env.XERO_CLIENT_SECRET || '',
            redirectUri: `${process.env.API_BASE_URL}/accounting/callback/xero`,
          };

          const adapter = new XeroAdapter(xeroConfig);
          // INTEGRATION: Authenticate with Xero
          const authResult = await adapter.authenticate(code);
          connection = authResult;
        }

        // Save connection to database
        const savedConnection = await (prisma as any).accountingConnection.create({
          data: {
            tenantId,
            provider,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            accountId: connection.accountId,
            email: connection.email,
            isActive: true,
            lastSyncAt: null,
          },
        });

        return reply.redirect(`/settings/accounting?success=connected&provider=${provider}`);
      } catch (error) {
        console.error(`[OAuth] Error during ${provider} callback:`, error);
        return reply.redirect(`/settings/accounting?error=auth_failed&provider=${provider}`);
      }
    },
  );

  // ─── Connection Status ──────────────────────────────────────────

  /**
   * GET /accounting/status
   * Get accounting connection status
   */
  fastify.get(
    '/accounting/status',
    { onRequest: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = request.user.tenantId;

      const connections = await (prisma as any).accountingConnection.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true,
          provider: true,
          email: true,
          isActive: true,
          lastSyncAt: true,
          createdAt: true,
        },
      });

      const syncCounts = await Promise.all(
        connections.map(async (conn: typeof connections[0]) => {
          const syncedCount = await (prisma as any).accountingSyncRecord.count({
            where: {
              connectionId: conn.id,
              syncStatus: 'synced',
            },
          });

          const failedCount = await (prisma as any).accountingSyncRecord.count({
            where: {
              connectionId: conn.id,
              syncStatus: 'failed',
            },
          });

          return { ...conn, syncedCount, failedCount };
        }),
      );

      return reply.send({
        connections: syncCounts,
        hasConnections: connections.length > 0,
      });
    },
  );

  // ─── Sync Single Invoice ────────────────────────────────────────

  /**
   * POST /accounting/sync/invoice/:id
   * Sync single invoice to accounting provider
   */
  fastify.post<{ Params: { id: string } }>(
    '/accounting/sync/invoice/:id',
    {
      onRequest: [requireAuth, tenantContext],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: syncInvoiceSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { force, autoRetry } = request.body as { force?: boolean; autoRetry?: boolean };
      const tenantId = request.user.tenantId;

      // Fetch invoice
      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice || invoice.tenantId !== tenantId) {
        throw new NotFoundError(`Invoice not found: ${id}`);
      }

      if (invoice.status === 'draft') {
        throw new ValidationError('Cannot sync draft invoices. Finalize first.');
      }

      // Get active connections
      const connections = await (prisma as any).accountingConnection.findMany({
        where: { tenantId, isActive: true },
      });

      if (connections.length === 0) {
        throw new ValidationError('No active accounting connections');
      }

      // Sync to all active providers
      const syncService = new AccountingSyncService(prisma);
      const results = await Promise.allSettled(
        connections.map((conn: typeof connections[0]) => syncService.syncInvoice(invoice as any, conn.provider, { force, autoRetry })),
      );

      const successful = results.filter((r: PromiseSettledResult<any>) => r.status === 'fulfilled');
      const failed = results.filter((r: PromiseSettledResult<any>) => r.status === 'rejected');

      return reply.send({
        invoiceId: id,
        totalProviders: connections.length,
        synced: successful.length,
        failed: failed.length,
        results: successful.map((r: any) => ({
          provider: r.value.provider,
          status: r.value.syncStatus,
          externalId: r.value.externalId,
          syncedAt: r.value.syncedAt,
        })),
      });
    },
  );

  // ─── Batch Sync ─────────────────────────────────────────────────

  /**
   * POST /accounting/sync/batch
   * Sync multiple invoices to accounting providers
   */
  fastify.post(
    '/accounting/sync/batch',
    {
      onRequest: [requireAuth, tenantContext],
      schema: {
        body: batchSyncSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceIds, providers, force } = request.body as {
        invoiceIds: string[];
        providers?: ('quickbooks' | 'xero')[];
        force?: boolean;
      };
      const tenantId = request.user.tenantId;

      if (invoiceIds.length === 0) {
        throw new ValidationError('At least one invoice required');
      }

      // Fetch invoices
      const invoices = await prisma.invoice.findMany({
        where: { id: { in: invoiceIds }, tenantId },
      });

      if (invoices.length === 0) {
        throw new NotFoundError('No invoices found');
      }

      // Get connections to sync
      const connections = await (prisma as any).accountingConnection.findMany({
        where: {
          tenantId,
          isActive: true,
          ...(providers && providers.length > 0 ? { provider: { in: providers } } : {}),
        },
      });

      if (connections.length === 0) {
        throw new ValidationError('No active accounting connections');
      }

      // Sync all invoices
      const syncService = new AccountingSyncService(prisma);
      const results: Record<string, any> = {};

      for (const invoice of invoices) {
        results[invoice.id] = {
          syncs: [],
        };

        for (const connection of connections) {
          try {
            const syncRecord = await syncService.syncInvoice(invoice as any, connection.provider, {
              force,
              autoRetry: true,
            });

            results[invoice.id].syncs.push({
              provider: connection.provider,
              status: syncRecord.syncStatus,
              externalId: syncRecord.externalId,
            });
          } catch (error) {
            results[invoice.id].syncs.push({
              provider: connection.provider,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return reply.send({
        invoicesSynced: invoices.length,
        providersUsed: connections.length,
        results,
      });
    },
  );

  // ─── Sync History ───────────────────────────────────────────────

  /**
   * GET /accounting/sync/history
   * Get sync operation history and log
   */
  fastify.get(
    '/accounting/sync/history',
    {
      onRequest: [requireAuth, tenantContext],
      schema: {
        querystring: syncHistorySchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider, invoiceId, status, limit, offset } = request.query as {
        provider?: 'quickbooks' | 'xero';
        invoiceId?: string;
        status?: 'pending' | 'synced' | 'failed' | 'skipped';
        limit: number;
        offset: number;
      };
      const tenantId = request.user.tenantId;

      const where: any = { tenantId };
      if (provider) where.provider = provider;
      if (invoiceId) where.invoiceId = invoiceId;
      if (status) where.syncStatus = status;

      const [records, total] = await Promise.all([
        (prisma as any).accountingSyncRecord.findMany({
          where,
          include: {
            connection: {
              select: { provider: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        (prisma as any).accountingSyncRecord.count({ where }),
      ]);

      return reply.send({
        records: records.map((r: any) => ({
          id: r.id,
          invoiceId: r.invoiceId,
          provider: r.provider,
          status: r.syncStatus,
          externalId: r.externalId,
          errorMessage: r.errorMessage,
          syncedAt: r.syncedAt,
          createdAt: r.createdAt,
        })),
        total,
        limit,
        offset,
      });
    },
  );

  // ─── Disconnect Provider ────────────────────────────────────────

  /**
   * DELETE /accounting/disconnect/:provider
   * Disconnect accounting provider
   */
  fastify.delete<{ Params: { provider: 'quickbooks' | 'xero' } }>(
    '/accounting/disconnect/:provider',
    { onRequest: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: 'quickbooks' | 'xero' };
      const tenantId = request.user.tenantId;

      const connection = await (prisma as any).accountingConnection.findFirst({
        where: { tenantId, provider, isActive: true },
      });

      if (!connection) {
        throw new NotFoundError(`No active connection for provider: ${provider}`);
      }

      // Deactivate connection
      await (prisma as any).accountingConnection.update({
        where: { id: connection.id },
        data: { isActive: false },
      });

      return reply.send({
        success: true,
        provider,
        message: `Disconnected from ${provider}`,
      });
    },
  );

  // ─── Reconcile ──────────────────────────────────────────────────

  /**
   * POST /accounting/reconcile
   * Reconcile accounts between Witylogix and accounting provider
   */
  fastify.post(
    '/accounting/reconcile',
    {
      onRequest: [requireAuth, tenantContext],
      schema: {
        body: reconcileSchema,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider, fromDate, toDate } = request.body as {
        provider: 'quickbooks' | 'xero';
        fromDate: Date;
        toDate: Date;
      };
      const tenantId = request.user.tenantId;

      if (fromDate > toDate) {
        throw new ValidationError('fromDate must be before toDate');
      }

      const connection = await (prisma as any).accountingConnection.findFirst({
        where: { tenantId, provider, isActive: true },
      });

      if (!connection) {
        throw new NotFoundError(`No active connection for provider: ${provider}`);
      }

      const syncService = new AccountingSyncService(prisma);
      const result = await syncService.reconcile(tenantId, provider, {
        from: fromDate,
        to: toDate,
      });

      return reply.send({
        provider,
        dateRange: { from: fromDate, to: toDate },
        ...result,
      });
    },
  );
}
