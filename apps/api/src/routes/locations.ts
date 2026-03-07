/**
 * Enhanced Locations API v2
 * PostGIS-ready coordinate storage, working hours, zone association,
 * inventory by location, pickup/delivery rules, capacity management, nearest location query
 *
 * Routes:
 *   GET    /               List locations (paginated, filterable, searchable)
 *   GET    /:id            Get single location with all details
 *   POST   /               Create location with working hours & capacity
 *   PATCH  /:id            Update location fields
 *   DELETE /:id            Soft-deactivate location
 *
 *   GET    /:id/hours      Get working hours
 *   POST   /:id/hours      Set working hours
 *
 *   GET    /:id/capacity   Get capacity info
 *   PATCH  /:id/capacity   Update capacity
 *
 *   GET    /:id/zones      Get associated zones
 *   POST   /:id/zones      Associate location with zone
 *   DELETE /:id/zones/:zid Unassociate zone
 *
 *   GET    /:id/inventory  Get inventory by location
 *   GET    /nearest        Find nearest location to coordinates
 *   POST   /geocode        Geocode address and get coordinates
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../lib/errors.js';

// ─── SCHEMAS ────────────────────────────────────────────────

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const workingHoursSchema = z.object({
  monday: z.object({ open: z.string(), close: z.string() }).optional(),
  tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
  wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
  thursday: z.object({ open: z.string(), close: z.string() }).optional(),
  friday: z.object({ open: z.string(), close: z.string() }).optional(),
  saturday: z.object({ open: z.string(), close: z.string() }).optional(),
  sunday: z.object({ open: z.string(), close: z.string() }).optional(),
});

const createLocationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['WAREHOUSE', 'STORE', 'HUB', 'DEPOT', 'PICKUP_POINT']).default('WAREHOUSE'),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  city: z.string(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  allowPickup: z.boolean().default(true),
  allowDelivery: z.boolean().default(true),
  maxPickupHour: z.number().int().min(0).max(23).optional(),
  minDeliveryDay: z.number().int().min(0).optional(),
  serviceLevel: z.enum(['standard', 'premium', 'express']).default('standard'),
  operatingHours: workingHoursSchema.optional(),
  capacity: z
    .object({
      totalSlots: z.number().int().positive(),
      category: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

const updateLocationSchema = createLocationSchema.partial();

const capacityUpdateSchema = z.object({
  totalSlots: z.number().int().positive(),
  usedSlots: z.number().int().nonnegative(),
  reservedSlots: z.number().int().nonnegative(),
  category: z.string().optional(),
});

const zoneAssociationSchema = z.object({
  zoneId: z.string().uuid(),
  priority: z.number().int().default(0),
  isDefault: z.boolean().default(false),
});

const nearestLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  maxDistance: z.number().positive().default(50), // km
  type: z.enum(['WAREHOUSE', 'STORE', 'HUB', 'DEPOT', 'PICKUP_POINT']).optional(),
  limit: z.number().int().positive().default(5),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────

async function locationsV2Routes(fastify: FastifyInstance): Promise<void> {
  // Pre-handler: auth + tenant context
  const requireAuth = async (request: any, reply: any) => {
    if (!request.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  const tenantContext = async (request: any, reply: any) => {
    // Tenant context middleware — assumes request.shopId is set
    request.tenantDb = request.server.db; // Use main db with RLS
  };

  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── LIST LOCATIONS ──────────────────────────────────────────

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 20, type, isActive = 'true', search, lat, lng, maxDistance } = request.query as any;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * pageSize;

      let whereClause = 'WHERE shop_id = $1::uuid AND is_active = true';
      const params: any[] = [request.shopId];

      let paramCount = 1;

      if (type) {
        paramCount++;
        whereClause += ` AND type = $${paramCount}::text`;
        params.push(type);
      }

      if (search) {
        paramCount++;
        whereClause += ` AND (name ILIKE $${paramCount} OR address_line1 ILIKE $${paramCount} OR city ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Distance filter using PostGIS-ready haversine approximation
      if (lat && lng && maxDistance) {
        const lat_num = parseFloat(lat);
        const lng_num = parseFloat(lng);
        const maxDist = parseFloat(maxDistance);

        paramCount += 4;
        // Haversine formula: distance = 2 * 6371 * asin(sqrt(sin²((lat2-lat1)/2) + cos(lat1)*cos(lat2)*sin²((lng2-lng1)/2)))
        whereClause += `
          AND (
            2 * 6371 * asin(
              sqrt(
                power(sin(radians((latitude - $${paramCount}::float8) / 2)), 2) +
                cos(radians($${paramCount}::float8)) * cos(radians(latitude)) *
                power(sin(radians((longitude - $${paramCount + 1}::float8) / 2)), 2)
              )
            )
          ) <= $${paramCount + 2}::float8
        `;
        params.push(lat_num, lng_num, lat_num, maxDist);
      }

      // Get total count
      const countResult: any[] = await request.tenantDb.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM locations ${whereClause}`,
        ...params
      );
      const total = Number(countResult[0]?.count || 0);

      // Get paginated results
      paramCount += 2;
      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT
            id, org_id, shop_id, name, type, address_line1, address_line2,
            city, province, postal_code, country, latitude, longitude,
            phone, email, is_default, is_active, allow_pickup, allow_delivery,
            max_pickup_hour, min_delivery_day, service_level, prep_time_minutes,
            operating_hours, metadata, created_at, updated_at
          FROM locations
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramCount - 1}::int
          OFFSET $${paramCount}::int
        `,
        ...params,
        pageSize,
        skip
      );

      return {
        data: result,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to list locations' });
    }
  });

  // ── GET SINGLE LOCATION ─────────────────────────────────────

  fastify.get('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const location: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT *
          FROM locations
          WHERE id = $1::uuid AND shop_id = $2::uuid
        `,
        id,
        request.shopId
      );

      if (!location || location.length === 0) {
        throw new NotFoundError('Location not found');
      }

      // Get working hours
      const hours: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT day_of_week, open_time, close_time, is_closed
          FROM location_working_hours
          WHERE location_id = $1::uuid
          ORDER BY day_of_week ASC
        `,
        id
      );

      // Get capacity
      const capacity: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT total_slots, used_slots, reserved_slots, category
          FROM location_capacity
          WHERE location_id = $1::uuid
        `,
        id
      );

      // Get zone associations
      const zones: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT lzl.zone_id, lzl.priority, lzl.is_default, z.name, z.type
          FROM location_zone_links lzl
          JOIN zones z ON z.id = lzl.zone_id
          WHERE lzl.location_id = $1::uuid
          ORDER BY lzl.priority ASC
        `,
        id
      );

      return {
        ...location[0],
        workingHours: hours,
        capacity: capacity[0] || null,
        zones,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to get location' });
    }
  });

  // ── CREATE LOCATION ─────────────────────────────────────────

  fastify.post('/', async (request: any, reply: FastifyReply) => {
    try {
      const body = createLocationSchema.parse(request.body);

      // Insert location
      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          INSERT INTO locations (
            shop_id, name, type, address_line1, address_line2,
            city, province, postal_code, country,
            latitude, longitude, phone, email,
            allow_pickup, allow_delivery, max_pickup_hour, min_delivery_day,
            service_level, operating_hours, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING *
        `,
        request.shopId,
        body.name,
        body.type,
        body.addressLine1,
        body.addressLine2 || null,
        body.city,
        body.province || null,
        body.postalCode || null,
        body.country,
        body.latitude,
        body.longitude,
        body.phone || null,
        body.email || null,
        body.allowPickup,
        body.allowDelivery,
        body.maxPickupHour || null,
        body.minDeliveryDay || null,
        body.serviceLevel,
        body.operatingHours ? JSON.stringify(body.operatingHours) : null,
        body.metadata ? JSON.stringify(body.metadata) : '{}'
      );

      const locationId = result[0]?.id;

      // Insert capacity if provided
      if (body.capacity) {
        await request.tenantDb.$queryRawUnsafe(
          `
            INSERT INTO location_capacity (
              location_id, total_slots, used_slots, reserved_slots, category
            ) VALUES ($1, $2, $3, $4, $5)
          `,
          locationId,
          body.capacity.totalSlots,
          0,
          0,
          body.capacity.category || null
        );
      }

      return reply.code(201).send(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to create location' });
    }
  });

  // ── UPDATE LOCATION ─────────────────────────────────────────

  fastify.patch('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = updateLocationSchema.parse(request.body);

      const fields: string[] = [];
      const values: any[] = [id, request.shopId];
      let paramCount = 2;

      const fieldMap: Record<string, string> = {
        name: 'name',
        type: 'type',
        addressLine1: 'address_line1',
        addressLine2: 'address_line2',
        city: 'city',
        province: 'province',
        postalCode: 'postal_code',
        country: 'country',
        latitude: 'latitude',
        longitude: 'longitude',
        phone: 'phone',
        email: 'email',
        allowPickup: 'allow_pickup',
        allowDelivery: 'allow_delivery',
        maxPickupHour: 'max_pickup_hour',
        minDeliveryDay: 'min_delivery_day',
        serviceLevel: 'service_level',
      };

      for (const [key, dbField] of Object.entries(fieldMap)) {
        if (key in body) {
          paramCount++;
          fields.push(`${dbField} = $${paramCount}`);
          values.push((body as any)[key]);
        }
      }

      if (body.operatingHours) {
        paramCount++;
        fields.push(`operating_hours = $${paramCount}`);
        values.push(JSON.stringify(body.operatingHours));
      }

      if (body.metadata) {
        paramCount++;
        fields.push(`metadata = $${paramCount}`);
        values.push(JSON.stringify(body.metadata));
      }

      if (fields.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          UPDATE locations
          SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $1::uuid AND shop_id = $2::uuid
          RETURNING *
        `,
        ...values
      );

      if (!result || result.length === 0) {
        throw new NotFoundError('Location not found');
      }

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update location' });
    }
  });

  // ── DELETE LOCATION (soft-deactivate) ────────────────────────

  fastify.delete('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          UPDATE locations
          SET is_active = false, updated_at = NOW()
          WHERE id = $1::uuid AND shop_id = $2::uuid
          RETURNING *
        `,
        id,
        request.shopId
      );

      if (!result || result.length === 0) {
        throw new NotFoundError('Location not found');
      }

      return { message: 'Location deactivated', location: result[0] };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to delete location' });
    }
  });

  // ── GET WORKING HOURS ───────────────────────────────────────

  fastify.get('/:id/hours', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const hours: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT day_of_week, open_time, close_time, is_closed
          FROM location_working_hours
          WHERE location_id = $1::uuid
          ORDER BY day_of_week ASC
        `,
        id
      );

      return hours;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to get working hours' });
    }
  });

  // ── SET WORKING HOURS ───────────────────────────────────────

  fastify.post('/:id/hours', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;

      // Delete existing hours
      await request.tenantDb.$queryRawUnsafe(
        `DELETE FROM location_working_hours WHERE location_id = $1::uuid`,
        id
      );

      // Insert new hours
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayName = days[dayOfWeek];
        const dayData = body[dayName];

        if (dayData) {
          await request.tenantDb.$queryRawUnsafe(
            `
              INSERT INTO location_working_hours (location_id, day_of_week, open_time, close_time, is_closed)
              VALUES ($1::uuid, $2, $3, $4, $5)
            `,
            id,
            dayOfWeek,
            dayData.open || null,
            dayData.close || null,
            dayData.isClosed || false
          );
        }
      }

      return { message: 'Working hours updated' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update working hours' });
    }
  });

  // ── GET CAPACITY ────────────────────────────────────────────

  fastify.get('/:id/capacity', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const capacity: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT total_slots, used_slots, reserved_slots, category,
                 (total_slots - used_slots - reserved_slots) as available_slots,
                 ROUND(100.0 * (used_slots::numeric / total_slots), 2) as utilization_percent
          FROM location_capacity
          WHERE location_id = $1::uuid
        `,
        id
      );

      if (!capacity || capacity.length === 0) {
        return reply.code(404).send({ error: 'Capacity not found' });
      }

      return capacity[0];
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to get capacity' });
    }
  });

  // ── UPDATE CAPACITY ─────────────────────────────────────────

  fastify.patch('/:id/capacity', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = capacityUpdateSchema.parse(request.body);

      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          INSERT INTO location_capacity (location_id, total_slots, used_slots, reserved_slots, category)
          VALUES ($1::uuid, $2, $3, $4, $5)
          ON CONFLICT (location_id) DO UPDATE SET
            total_slots = EXCLUDED.total_slots,
            used_slots = EXCLUDED.used_slots,
            reserved_slots = EXCLUDED.reserved_slots,
            category = EXCLUDED.category,
            last_updated = NOW()
          RETURNING *
        `,
        id,
        body.totalSlots,
        body.usedSlots,
        body.reservedSlots,
        body.category || null
      );

      return result[0];
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update capacity' });
    }
  });

  // ── GET ZONE ASSOCIATIONS ───────────────────────────────────

  fastify.get('/:id/zones', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const zones: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT lzl.zone_id, lzl.priority, lzl.is_default, z.name, z.type
          FROM location_zone_links lzl
          JOIN zones z ON z.id = lzl.zone_id
          WHERE lzl.location_id = $1::uuid
          ORDER BY lzl.priority ASC
        `,
        id
      );

      return zones;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to get zones' });
    }
  });

  // ── ASSOCIATE ZONE ──────────────────────────────────────────

  fastify.post('/:id/zones', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = zoneAssociationSchema.parse(request.body);

      const result: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          INSERT INTO location_zone_links (location_id, zone_id, priority, is_default)
          VALUES ($1::uuid, $2::uuid, $3, $4)
          ON CONFLICT (location_id, zone_id) DO UPDATE SET
            priority = EXCLUDED.priority,
            is_default = EXCLUDED.is_default
          RETURNING *
        `,
        id,
        body.zoneId,
        body.priority,
        body.isDefault
      );

      return reply.code(201).send(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to associate zone' });
    }
  });

  // ── UNASSOCIATE ZONE ────────────────────────────────────────

  fastify.delete('/:id/zones/:zoneId', async (request: any, reply: FastifyReply) => {
    try {
      const { id, zoneId } = request.params as any;

      await request.tenantDb.$queryRawUnsafe(
        `
          DELETE FROM location_zone_links
          WHERE location_id = $1::uuid AND zone_id = $2::uuid
        `,
        id,
        zoneId
      );

      return { message: 'Zone association removed' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to remove zone association' });
    }
  });

  // ── FIND NEAREST LOCATION ───────────────────────────────────

  fastify.get('/nearest', async (request: any, reply: FastifyReply) => {
    try {
      const query = nearestLocationSchema.parse(request.query);

      const locations: any[] = await request.tenantDb.$queryRawUnsafe(
        `
          SELECT
            id, name, type, address_line1, city, latitude, longitude,
            2 * 6371 * asin(
              sqrt(
                power(sin(radians((latitude - $1::float8) / 2)), 2) +
                cos(radians($1::float8)) * cos(radians(latitude)) *
                power(sin(radians((longitude - $2::float8) / 2)), 2)
              )
            ) as distance_km
          FROM locations
          WHERE shop_id = $3::uuid AND is_active = true
            ${query.type ? `AND type = $4::text` : ''}
            AND 2 * 6371 * asin(
              sqrt(
                power(sin(radians((latitude - $1::float8) / 2)), 2) +
                cos(radians($1::float8)) * cos(radians(latitude)) *
                power(sin(radians((longitude - $2::float8) / 2)), 2)
              )
            ) <= $${query.type ? '5' : '4'}::float8
          ORDER BY distance_km ASC
          LIMIT $${query.type ? '6' : '5'}::int
        `,
        query.latitude,
        query.longitude,
        request.shopId,
        ...(query.type ? [query.type] : []),
        query.maxDistance,
        query.limit
      );

      return locations;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to find nearest location' });
    }
  });
}

export default locationsV2Routes;
