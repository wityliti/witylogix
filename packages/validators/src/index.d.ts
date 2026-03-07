/**
 * @witylogix/validators — Shared Zod schemas
 * JIT package: consuming apps transpile directly from src/
 */
import { z } from "zod";
export declare const uuidSchema: z.ZodString;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
}, {
    limit?: number | undefined;
    page?: number | undefined;
}>;
export declare const coordinatesSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
}, {
    latitude: number;
    longitude: number;
}>;
export declare const createOrderSchema: z.ZodObject<{
    shopifyOrderId: z.ZodString;
    shopifyOrderNumber: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerEmail: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    province: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    deliveryDate: z.ZodOptional<z.ZodString>;
    timeSlotId: z.ZodOptional<z.ZodString>;
    totalPrice: z.ZodOptional<z.ZodNumber>;
    totalWeight: z.ZodOptional<z.ZodNumber>;
    itemCount: z.ZodDefault<z.ZodNumber>;
    lineItems: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    notes: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    shopifyOrderId: string;
    itemCount: number;
    lineItems: Record<string, unknown>[];
    tags: string[];
    shopifyOrderNumber?: string | undefined;
    customerName?: string | undefined;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    province?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    deliveryDate?: string | undefined;
    timeSlotId?: string | undefined;
    totalPrice?: number | undefined;
    totalWeight?: number | undefined;
    notes?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}, {
    shopifyOrderId: string;
    shopifyOrderNumber?: string | undefined;
    customerName?: string | undefined;
    customerEmail?: string | undefined;
    customerPhone?: string | undefined;
    addressLine1?: string | undefined;
    addressLine2?: string | undefined;
    city?: string | undefined;
    province?: string | undefined;
    postalCode?: string | undefined;
    country?: string | undefined;
    deliveryDate?: string | undefined;
    timeSlotId?: string | undefined;
    totalPrice?: number | undefined;
    totalWeight?: number | undefined;
    itemCount?: number | undefined;
    lineItems?: Record<string, unknown>[] | undefined;
    tags?: string[] | undefined;
    notes?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
}>;
export declare const updateOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING", "ACCEPTED", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "FAILED", "RETURNED", "CANCELLED"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "ACCEPTED" | "ASSIGNED" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "ARRIVED" | "DELIVERED" | "FAILED" | "RETURNED" | "CANCELLED";
    notes?: string | undefined;
}, {
    status: "PENDING" | "ACCEPTED" | "ASSIGNED" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "ARRIVED" | "DELIVERED" | "FAILED" | "RETURNED" | "CANCELLED";
    notes?: string | undefined;
}>;
export declare const createDriverSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodString;
    vehicleType: z.ZodDefault<z.ZodEnum<["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"]>>;
    vehiclePlate: z.ZodOptional<z.ZodString>;
    maxCapacity: z.ZodDefault<z.ZodNumber>;
    maxWeight: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone: string;
    vehicleType: "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";
    maxCapacity: number;
    email?: string | undefined;
    vehiclePlate?: string | undefined;
    maxWeight?: number | undefined;
}, {
    name: string;
    phone: string;
    email?: string | undefined;
    vehicleType?: "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK" | undefined;
    vehiclePlate?: string | undefined;
    maxCapacity?: number | undefined;
    maxWeight?: number | undefined;
}>;
export declare const updateDriverLocationSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    heading: z.ZodOptional<z.ZodNumber>;
    speed: z.ZodOptional<z.ZodNumber>;
    accuracy: z.ZodOptional<z.ZodNumber>;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    latitude: number;
    longitude: number;
    heading?: number | undefined;
    speed?: number | undefined;
    accuracy?: number | undefined;
}, {
    timestamp: number;
    latitude: number;
    longitude: number;
    heading?: number | undefined;
    speed?: number | undefined;
    accuracy?: number | undefined;
}>;
export declare const createDeliveryZoneSchema: z.ZodObject<{
    name: z.ZodString;
    boundary: z.ZodArray<z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
    }, {
        latitude: number;
        longitude: number;
    }>, "many">;
    baseRate: z.ZodDefault<z.ZodNumber>;
    perKmRate: z.ZodDefault<z.ZodNumber>;
    minOrder: z.ZodDefault<z.ZodNumber>;
    freeAbove: z.ZodOptional<z.ZodNumber>;
    priority: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    boundary: {
        latitude: number;
        longitude: number;
    }[];
    baseRate: number;
    perKmRate: number;
    minOrder: number;
    priority: number;
    freeAbove?: number | undefined;
}, {
    name: string;
    boundary: {
        latitude: number;
        longitude: number;
    }[];
    baseRate?: number | undefined;
    perKmRate?: number | undefined;
    minOrder?: number | undefined;
    freeAbove?: number | undefined;
    priority?: number | undefined;
}>;
export declare const carrierRateRequestSchema: z.ZodObject<{
    rate: z.ZodObject<{
        origin: z.ZodObject<{
            country: z.ZodString;
            postal_code: z.ZodString;
            province: z.ZodString;
            city: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        }, {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        }>;
        destination: z.ZodObject<{
            country: z.ZodString;
            postal_code: z.ZodString;
            province: z.ZodString;
            city: z.ZodString;
            address1: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        }, {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        }>;
        items: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            quantity: z.ZodNumber;
            grams: z.ZodNumber;
            price: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }, {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }>, "many">;
        currency: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        origin: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        };
        destination: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        };
        items: {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }[];
    }, {
        currency: string;
        origin: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        };
        destination: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        };
        items: {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    rate: {
        currency: string;
        origin: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        };
        destination: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        };
        items: {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }[];
    };
}, {
    rate: {
        currency: string;
        origin: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
        };
        destination: {
            city: string;
            province: string;
            country: string;
            postal_code: string;
            address1?: string | undefined;
        };
        items: {
            name: string;
            quantity: number;
            grams: number;
            price: number;
        }[];
    };
}>;
export declare const optimizeRouteSchema: z.ZodObject<{
    depot: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        address: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
        address?: string | undefined;
    }, {
        lat: number;
        lng: number;
        address?: string | undefined;
    }>;
    orderIds: z.ZodArray<z.ZodString, "many">;
    vehicleIds: z.ZodArray<z.ZodString, "many">;
    options: z.ZodOptional<z.ZodObject<{
        timeLimit: z.ZodDefault<z.ZodNumber>;
        returnToDepot: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        timeLimit: number;
        returnToDepot: boolean;
    }, {
        timeLimit?: number | undefined;
        returnToDepot?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    orderIds: string[];
    depot: {
        lat: number;
        lng: number;
        address?: string | undefined;
    };
    vehicleIds: string[];
    options?: {
        timeLimit: number;
        returnToDepot: boolean;
    } | undefined;
}, {
    orderIds: string[];
    depot: {
        lat: number;
        lng: number;
        address?: string | undefined;
    };
    vehicleIds: string[];
    options?: {
        timeLimit?: number | undefined;
        returnToDepot?: boolean | undefined;
    } | undefined;
}>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type CreateDriver = z.infer<typeof createDriverSchema>;
export type UpdateDriverLocation = z.infer<typeof updateDriverLocationSchema>;
export type CreateDeliveryZone = z.infer<typeof createDeliveryZoneSchema>;
export type OptimizeRoute = z.infer<typeof optimizeRouteSchema>;
//# sourceMappingURL=index.d.ts.map