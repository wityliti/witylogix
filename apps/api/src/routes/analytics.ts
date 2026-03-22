/**
 * Analytics Routes — Dashboard KPIs, Trends, Performance Metrics
 *
 * Routes:
 *   GET /overview          Dashboard KPIs (totalDeliveries, onTimeRate, avgDeliveryTime, etc.)
 *   GET /delivery-trends   Time series delivery data (daily/weekly/monthly grouping)
 *   GET /driver-performance Driver leaderboard with delivery metrics
 *   GET /zone-performance  Zone-level metrics and performance
 *   GET /cost-breakdown    Cost analysis and breakdown
 *   GET /export            CSV export of analytics data
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

// ─── Query Params Schemas ──────────────────────────────────────

const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const overviewQuerySchema = dateRangeSchema.extend({
  zoneId: z.string().uuid().optional(),
});

const trendsQuerySchema = dateRangeSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

const driverPerformanceQuerySchema = dateRangeSchema.extend({
  sortBy: z.enum(["totalDeliveries", "onTimeRate", "avgDeliveryMinutes", "rating"]).default("totalDeliveries"),
  limit: z.number().int().positive().max(100).default(20),
});

const zonePerformanceQuerySchema = dateRangeSchema.extend({
  sortBy: z.enum(["deliveryCount", "onTimeRate", "avgDeliveryTime", "revenue"]).default("deliveryCount"),
  limit: z.number().int().positive().max(100).default(20),
});

const exportQuerySchema = z.object({
  type: z.enum(["deliveries", "drivers", "zones"]),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ─── Helper Functions ──────────────────────────────────────────

function getDateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: 30 days
  const to = dateTo ? new Date(dateTo) : new Date();
  return { from, to };
}

function getGranularityInterval(granularity: string): { unit: string; days: number } {
  switch (granularity) {
    case "weekly":
      return { unit: "week", days: 7 };
    case "monthly":
      return { unit: "month", days: 30 };
    default: // daily
      return { unit: "day", days: 1 };
  }
}

function formatDateForGrouping(date: Date, granularity: string): string {
  if (granularity === "weekly") {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toISOString().split("T")[0];
  }
  if (granularity === "monthly") {
    return date.toISOString().split("T")[0].substring(0, 7);
  }
  return date.toISOString().split("T")[0];
}

// ─── Route Plugin ──────────────────────────────────────────────

async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET OVERVIEW (Dashboard KPIs) ───────────────────────────

  fastify.get("/overview", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = overviewQuerySchema.parse(request.query);
      const { dateFrom, dateTo, zoneId } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      const where: any = {
        createdAt: { gte: from, lte: to },
      };

      if (zoneId) {
        where.location = { id: zoneId };
      }

      // Get shipment metrics
      const shipments = await (request as any).tenantDb.shipment.findMany({
        where,
        select: {
          id: true,
          status: true,
          deliveryDate: true,
          actualDelivery: true,
          shippingCost: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Get payment data for revenue
      const payments = await (request as any).tenantDb.payment.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(zoneId && { shipment: { location: { id: zoneId } } }),
        },
        select: { amount: true, status: true },
      });

      // Calculate metrics
      const totalDeliveries = shipments.length;
      const deliveredShipments = shipments.filter((s: any) => s.status === "DELIVERED");
      const onTimeDeliveries = deliveredShipments.filter(
        (s: any) => s.actualDelivery && s.deliveryDate && s.actualDelivery <= s.deliveryDate,
      ).length;

      // Average delivery time (in hours)
      let avgDeliveryTime = 0;
      if (deliveredShipments.length > 0) {
        const totalTime = deliveredShipments.reduce((sum: number, s: any) => {
          if (s.deliveryDate && s.actualDelivery) {
            const diffMs = s.actualDelivery.getTime() - s.deliveryDate.getTime();
            return sum + Math.max(0, diffMs / (1000 * 60 * 60));
          }
          return sum;
        }, 0);
        avgDeliveryTime = Math.round((totalTime / deliveredShipments.length) * 100) / 100;
      }

      // Revenue (completed payments)
      const completedPayments = payments.filter((p: any) => p.status === "COMPLETED");
      const revenue = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Cost per delivery
      const totalShippingCost = shipments.reduce((sum: number, s: any) => sum + (s.shippingCost || 0), 0);
      const costPerDelivery = totalDeliveries > 0 ? Math.round((totalShippingCost / totalDeliveries) * 100) / 100 : 0;

      // Customer satisfaction (default placeholder - would come from reviews/ratings)
      const customerSatisfaction = 4.5; // placeholder

      // On-time rate
      const onTimeRate =
        totalDeliveries > 0 ? Math.round((onTimeDeliveries / totalDeliveries) * 10000) / 100 : 0;

      return {
        data: {
          totalDeliveries,
          onTimeRate,
          avgDeliveryTime,
          customerSatisfaction,
          revenue: Math.round(revenue * 100) / 100,
          costPerDelivery,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });

  // ── GET DELIVERY TRENDS (Time Series) ───────────────────────

  fastify.get("/delivery-trends", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = trendsQuerySchema.parse(request.query);
      const { dateFrom, dateTo, granularity } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      // Fetch shipments within range
      const shipments = await (request as any).tenantDb.shipment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          deliveryDate: true,
          actualDelivery: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by date based on granularity
      const groupedData: Record<
        string,
        { deliveries: number; onTime: number; late: number; failed: number; date: string }
      > = {};

      for (const shipment of shipments) {
        const dateKey = formatDateForGrouping(shipment.createdAt as any, granularity);

        if (!groupedData[dateKey]) {
          groupedData[dateKey] = { deliveries: 0, onTime: 0, late: 0, failed: 0, date: dateKey };
        }

        groupedData[dateKey].deliveries += 1;

        if (shipment.status === "DELIVERED") {
          if (shipment.actualDelivery && shipment.deliveryDate) {
            if (shipment.actualDelivery <= shipment.deliveryDate) {
              groupedData[dateKey].onTime += 1;
            } else {
              groupedData[dateKey].late += 1;
            }
          } else {
            groupedData[dateKey].onTime += 1;
          }
        } else if (shipment.status === "FAILED") {
          groupedData[dateKey].failed += 1;
        }
      }

      const trendData = Object.values(groupedData).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      return {
        data: trendData,
        granularity,
        dateRange: { from: from.toISOString(), to: to.toISOString() },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });

  // ── GET DRIVER PERFORMANCE (Leaderboard) ────────────────────

  fastify.get("/driver-performance", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = driverPerformanceQuerySchema.parse(request.query);
      const { dateFrom, dateTo, sortBy, limit } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      // Get all drivers with shipment counts
      const drivers = await (request as any).tenantDb.driver.findMany({
        select: { id: true, name: true, rating: true },
        where: { isActive: true },
      });

      const driverMetrics: Array<{
        driverId: string;
        name: string;
        totalDeliveries: number;
        onTimeRate: number;
        avgDeliveryMinutes: number;
        rating: number;
        activeRoutes: number;
      }> = [];

      for (const driver of drivers) {
        const shipments = await (request as any).tenantDb.shipment.findMany({
          where: {
            driverId: driver.id,
            createdAt: { gte: from, lte: to },
          },
          select: {
            id: true,
            status: true,
            deliveryDate: true,
            actualDelivery: true,
            pickedUpAt: true,
          },
        });

        const totalDeliveries = shipments.filter((s: any) => s.status === "DELIVERED").length;
        const deliveredShipments = shipments.filter((s: any) => s.status === "DELIVERED");

        let onTimeRate = 0;
        if (deliveredShipments.length > 0) {
          const onTime = deliveredShipments.filter(
            (s: any) => s.actualDelivery && s.deliveryDate && s.actualDelivery <= s.deliveryDate,
          ).length;
          onTimeRate = Math.round((onTime / deliveredShipments.length) * 10000) / 100;
        }

        let avgDeliveryMinutes = 0;
        if (deliveredShipments.length > 0) {
          const totalMinutes = deliveredShipments.reduce((sum: number, s: any) => {
            if (s.pickedUpAt && s.actualDelivery) {
              const diffMs = s.actualDelivery.getTime() - s.pickedUpAt.getTime();
              return sum + diffMs / (1000 * 60);
            }
            return sum;
          }, 0);
          avgDeliveryMinutes = Math.round((totalMinutes / deliveredShipments.length) * 100) / 100;
        }

        const activeRoutes = shipments.filter((s: any) =>
          ["IN_TRANSIT", "OUT_FOR_DELIVERY", "PICKED_UP"].includes(s.status),
        ).length;

        driverMetrics.push({
          driverId: driver.id,
          name: driver.name,
          totalDeliveries,
          onTimeRate,
          avgDeliveryMinutes,
          rating: driver.rating || 0,
          activeRoutes,
        });
      }

      // Sort by specified field
      const sorted = driverMetrics.sort((a: any, b: any) => {
        if (sortBy === "totalDeliveries" || sortBy === "avgDeliveryMinutes" || sortBy === "rating") {
          return (b as any)[sortBy] - (a as any)[sortBy];
        }
        return (b as any)[sortBy] - (a as any)[sortBy]; // onTimeRate descending
      });

      return {
        data: sorted.slice(0, limit),
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        sortBy,
        limit,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });

  // ── GET ZONE PERFORMANCE ────────────────────────────────────

  fastify.get("/zone-performance", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = zonePerformanceQuerySchema.parse(request.query);
      const { dateFrom, dateTo, sortBy, limit } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      // Get all zones (locations)
      const zones = await (request as any).tenantDb.location.findMany({
        select: { id: true, name: true },
      });

      const zoneMetrics: Array<{
        zoneId: string;
        name: string;
        deliveryCount: number;
        onTimeRate: number;
        avgDeliveryTime: number;
        revenue: number;
      }> = [];

      for (const zone of zones) {
        const shipments = await (request as any).tenantDb.shipment.findMany({
          where: {
            location: { id: zone.id },
            createdAt: { gte: from, lte: to },
          },
          select: {
            id: true,
            status: true,
            deliveryDate: true,
            actualDelivery: true,
            shippingCost: true,
          },
        });

        const deliveryCount = shipments.length;
        const deliveredShipments = shipments.filter((s: any) => s.status === "DELIVERED");

        let onTimeRate = 0;
        if (deliveredShipments.length > 0) {
          const onTime = deliveredShipments.filter(
            (s: any) => s.actualDelivery && s.deliveryDate && s.actualDelivery <= s.deliveryDate,
          ).length;
          onTimeRate = Math.round((onTime / deliveredShipments.length) * 10000) / 100;
        }

        let avgDeliveryTime = 0;
        if (deliveredShipments.length > 0) {
          const totalHours = deliveredShipments.reduce((sum: number, s: any) => {
            if (s.deliveryDate && s.actualDelivery) {
              const diffMs = s.actualDelivery.getTime() - s.deliveryDate.getTime();
              return sum + Math.max(0, diffMs / (1000 * 60 * 60));
            }
            return sum;
          }, 0);
          avgDeliveryTime = Math.round((totalHours / deliveredShipments.length) * 100) / 100;
        }

        const revenue = shipments.reduce((sum: number, s: any) => sum + (s.shippingCost || 0), 0);

        if (deliveryCount > 0) {
          zoneMetrics.push({
            zoneId: zone.id,
            name: zone.name,
            deliveryCount,
            onTimeRate,
            avgDeliveryTime,
            revenue: Math.round(revenue * 100) / 100,
          });
        }
      }

      // Sort by specified field
      const sorted = zoneMetrics.sort((a: any, b: any) => {
        if (sortBy === "deliveryCount") {
          return b.deliveryCount - a.deliveryCount;
        }
        if (sortBy === "onTimeRate") {
          return b.onTimeRate - a.onTimeRate;
        }
        if (sortBy === "avgDeliveryTime") {
          return a.avgDeliveryTime - b.avgDeliveryTime;
        }
        if (sortBy === "revenue") {
          return b.revenue - a.revenue;
        }
        return b.deliveryCount - a.deliveryCount;
      });

      return {
        data: sorted.slice(0, limit),
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        sortBy,
        limit,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });

  // ── GET COST BREAKDOWN ──────────────────────────────────────

  fastify.get("/cost-breakdown", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = dateRangeSchema.parse(request.query);
      const { dateFrom, dateTo } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      // Get shipments for cost analysis
      const shipments = await (request as any).tenantDb.shipment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          id: true,
          status: true,
          shippingCost: true,
          createdAt: true,
        },
      });

      // Get payments for detailed costs
      const payments = await (request as any).tenantDb.payment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { amount: true, type: true, metadata: true },
      });

      // Calculate costs
      const totalShippingCost = shipments.reduce((sum: number, s: any) => sum + (s.shippingCost || 0), 0);
      const totalCost = totalShippingCost;

      // Break down by payment type (estimates)
      const fuelCost = Math.round(totalCost * 0.25 * 100) / 100; // ~25% fuel
      const laborCost = Math.round(totalCost * 0.50 * 100) / 100; // ~50% labor
      const carrierFees = Math.round(totalCost * 0.15 * 100) / 100; // ~15% carrier
      const otherCosts = Math.round(totalCost * 0.10 * 100) / 100; // ~10% other

      const deliveryCount = shipments.filter((s: any) => s.status === "DELIVERED").length;
      const costPerDelivery =
        deliveryCount > 0 ? Math.round((totalShippingCost / deliveryCount) * 100) / 100 : 0;

      // Generate cost trend (daily breakdown)
      const costTrend: Array<{ date: string; totalCost: number }> = [];
      const dailyBreakdown: Record<string, number> = {};

      for (const shipment of shipments) {
        const dateKey = shipment.createdAt.toISOString().split("T")[0];
        dailyBreakdown[dateKey] = (dailyBreakdown[dateKey] || 0) + (shipment.shippingCost || 0);
      }

      for (const [date, cost] of Object.entries(dailyBreakdown)) {
        costTrend.push({
          date,
          totalCost: Math.round(cost * 100) / 100,
        });
      }

      costTrend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        data: {
          totalCost: Math.round(totalCost * 100) / 100,
          fuelCost,
          laborCost,
          carrierFees,
          otherCosts,
          costPerDelivery,
          costTrend,
          dateRange: { from: from.toISOString(), to: to.toISOString() },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });

  // ── GET EXPORT (CSV Download) ──────────────────────────────

  fastify.get("/export", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = exportQuerySchema.parse(request.query);
      const { type, dateFrom, dateTo } = query;
      const { from, to } = getDateRange(dateFrom, dateTo);

      let csvContent = "";
      let filename = "";

      if (type === "deliveries") {
        filename = "deliveries_export.csv";

        // CSV Header
        csvContent = "Shipment ID,Tracking Number,Status,Delivery Date,Actual Delivery,Driver,Zone,Cost\n";

        // Fetch and format shipment data
        const shipments = await (request as any).tenantDb.shipment.findMany({
          where: { createdAt: { gte: from, lte: to } },
          include: {
            driver: { select: { name: true } },
            location: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10000, // Limit export to 10k rows
        });

        for (const shipment of shipments) {
          const row = [
            shipment.id,
            shipment.shipmentNumber,
            shipment.status,
            shipment.deliveryDate ? shipment.deliveryDate.toISOString().split("T")[0] : "",
            shipment.actualDelivery ? shipment.actualDelivery.toISOString().split("T")[0] : "",
            shipment.driver?.name || "",
            shipment.location?.name || "",
            shipment.shippingCost || 0,
          ]
            .map((val) => {
              // Escape CSV values
              if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`;
              }
              return val;
            })
            .join(",");
          csvContent += row + "\n";
        }
      } else if (type === "drivers") {
        filename = "drivers_export.csv";
        csvContent = "Driver ID,Name,Total Deliveries,On-Time Rate %,Avg Delivery Minutes,Rating\n";

        const drivers = await (request as any).tenantDb.driver.findMany({
          select: { id: true, name: true, rating: true },
          where: { isActive: true },
        });

        for (const driver of drivers) {
          const shipments = await (request as any).tenantDb.shipment.findMany({
            where: {
              driverId: driver.id,
              createdAt: { gte: from, lte: to },
            },
            select: {
              status: true,
              deliveryDate: true,
              actualDelivery: true,
              pickedUpAt: true,
            },
          });

          const totalDeliveries = shipments.filter((s: any) => s.status === "DELIVERED").length;
          const deliveredShipments = shipments.filter((s: any) => s.status === "DELIVERED");

          let onTimeRate = 0;
          if (deliveredShipments.length > 0) {
            const onTime = deliveredShipments.filter(
              (s: any) => s.actualDelivery && s.deliveryDate && s.actualDelivery <= s.deliveryDate,
            ).length;
            onTimeRate = Math.round((onTime / deliveredShipments.length) * 10000) / 100;
          }

          let avgDeliveryMinutes = 0;
          if (deliveredShipments.length > 0) {
            const totalMinutes = deliveredShipments.reduce((sum: number, s: any) => {
              if (s.pickedUpAt && s.actualDelivery) {
                return sum + (s.actualDelivery.getTime() - s.pickedUpAt.getTime()) / (1000 * 60);
              }
              return sum;
            }, 0);
            avgDeliveryMinutes = Math.round((totalMinutes / deliveredShipments.length) * 100) / 100;
          }

          const row = [driver.id, driver.name, totalDeliveries, onTimeRate, avgDeliveryMinutes, driver.rating || 0]
            .join(",");
          csvContent += row + "\n";
        }
      } else if (type === "zones") {
        filename = "zones_export.csv";
        csvContent = "Zone ID,Zone Name,Delivery Count,On-Time Rate %,Avg Delivery Hours,Revenue\n";

        const zones = await (request as any).tenantDb.location.findMany({
          select: { id: true, name: true },
        });

        for (const zone of zones) {
          const shipments = await (request as any).tenantDb.shipment.findMany({
            where: {
              location: { id: zone.id },
              createdAt: { gte: from, lte: to },
            },
            select: {
              status: true,
              deliveryDate: true,
              actualDelivery: true,
              shippingCost: true,
            },
          });

          const deliveryCount = shipments.length;
          const deliveredShipments = shipments.filter((s: any) => s.status === "DELIVERED");

          let onTimeRate = 0;
          if (deliveredShipments.length > 0) {
            const onTime = deliveredShipments.filter(
              (s: any) => s.actualDelivery && s.deliveryDate && s.actualDelivery <= s.deliveryDate,
            ).length;
            onTimeRate = Math.round((onTime / deliveredShipments.length) * 10000) / 100;
          }

          let avgDeliveryHours = 0;
          if (deliveredShipments.length > 0) {
            const totalHours = deliveredShipments.reduce((sum: number, s: any) => {
              if (s.deliveryDate && s.actualDelivery) {
                return sum + (s.actualDelivery.getTime() - s.deliveryDate.getTime()) / (1000 * 60 * 60);
              }
              return sum;
            }, 0);
            avgDeliveryHours = Math.round((totalHours / deliveredShipments.length) * 100) / 100;
          }

          const revenue = shipments.reduce((sum: number, s: any) => sum + (s.shippingCost || 0), 0);

          if (deliveryCount > 0) {
            const row = [zone.id, zone.name, deliveryCount, onTimeRate, avgDeliveryHours, revenue].join(",");
            csvContent += row + "\n";
          }
        }
      }

      // Set response headers for CSV download
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      return reply.send(csvContent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      throw error;
    }
  });
}

export default analyticsRoutes;
