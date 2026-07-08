/**
 * @witylogix/sdk - TypeScript SDK for the Witylogix delivery logistics API
 */

import { WitylogixClient } from "./client";
import { OrdersResource } from "./resources/orders";
import { DriversResource } from "./resources/drivers";
import { ZonesResource } from "./resources/zones";
import { ShipmentsResource } from "./resources/shipments";

/**
 * Extended client with resource accessors
 */
export class Witylogix extends WitylogixClient {
  public orders: OrdersResource;
  public drivers: DriversResource;
  public zones: ZonesResource;
  public shipments: ShipmentsResource;

  constructor(config: any) {
    super(config);
    this.orders = new OrdersResource(this);
    this.drivers = new DriversResource(this);
    this.zones = new ZonesResource(this);
    this.shipments = new ShipmentsResource(this);
  }
}

// ============================================================================
// Exports
// ============================================================================

// Main client
export { WitylogixClient };

// Resources
export {
  OrdersResource,
  DriversResource,
  ZonesResource,
  ShipmentsResource,
} from "./resources";

export type {
  CreateOrderData,
  UpdateOrderData,
  CreateDriverData,
  UpdateDriverData,
  CreateZoneData,
  UpdateZoneData,
  CreateShipmentData,
  UpdateShipmentData,
} from "./resources";

// Types
export type {
  Order,
  OrderStatus,
  OrderItem,
  Driver,
  DriverStatus,
  DriverLocation,
  Zone,
  ZoneStatus,
  ZoneCheckResult,
  Shipment,
  ShipmentStatus,
  ShipmentTracking,
  TrackingEvent,
  Location,
  Dimensions,
  TimeSlot,
  ListParams,
  PaginatedResponse,
  ApiErrorResponse,
  ClientConfig,
  RequestOptions,
} from "./types";

// Errors
export {
  ApiError,
  AuthError,
  NotFoundError,
  RateLimitError,
  BadRequestError,
  ServerError,
  NetworkError,
  ConfigError,
} from "./errors";

// Default export
export default Witylogix;
