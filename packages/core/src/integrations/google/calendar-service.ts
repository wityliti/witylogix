/**
 * Google Calendar Service
 * Handles OAuth2 flow and calendar event management for order tracking
 */

import { z } from "zod";
import type {
  CalendarEvent,
  CalendarSyncResult,
  OAuth2Config,
  OAuth2Token,
} from "./types.js";

/**
 * Validation schemas
 */
const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]),
  organizer: z
    .object({
      email: z.string().email(),
      displayName: z.string().optional(),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        responseStatus: z.enum([
          "accepted",
          "declined",
          "tentative",
          "needsAction",
        ]),
      }),
    )
    .optional(),
  extendedProperties: z
    .object({
      shared: z.record(z.string()).optional(),
      private: z.record(z.string()).optional(),
    })
    .optional(),
});

const OAuth2TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number(),
  tokenType: z.enum(["Bearer"]),
});

/**
 * Google Calendar Service class
 */
export class GoogleCalendarService {
  private config: OAuth2Config;
  private token: OAuth2Token | null = null;
  private calendarId: string = "primary";
  private apiUrl = "https://www.googleapis.com/calendar/v3";

  constructor(config: OAuth2Config) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error("OAuth2 configuration is incomplete");
    }
    this.config = config;
  }

  /**
   * Set the access token
   */
  setToken(token: OAuth2Token): void {
    this.token = token;
  }

  /**
   * Get current token
   */
  getToken(): OAuth2Token | null {
    return this.token;
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<OAuth2Token> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const token: OAuth2Token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: "Bearer",
    };

    this.token = OAuth2TokenSchema.parse(token);
    return this.token;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuth2Token> {
    if (!this.token?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.token.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const newToken: OAuth2Token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: "Bearer",
    };

    this.token = OAuth2TokenSchema.parse(newToken);
    return this.token;
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.token) {
      throw new Error("No token set. Please authenticate first.");
    }

    if (Date.now() >= this.token.expiresAt) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make an authenticated request to Google Calendar API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema,
  ): Promise<T> {
    await this.ensureValidToken();

    if (!this.token) {
      throw new Error("No token available");
    }

    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Calendar API Error [${response.status}]: ${error || response.statusText}`,
      );
    }

    const data: unknown = await response.json();

    if (schema) {
      try {
        return schema.parse(data) as T;
      } catch (validationError) {
        console.error("Validation error:", validationError);
        throw new Error("Invalid response format from Calendar API");
      }
    }

    return data as T;
  }

  /**
   * Create a calendar event for an order
   */
  async createOrderEvent(orderData: {
    orderId: string;
    customerName: string;
    deliveryAddress: string;
    deliveryDate: string; // ISO 8601
    deliveryTime?: string; // e.g., "10:00 AM - 12:00 PM"
    phoneNumber?: string;
    notes?: string;
    locationId?: string;
  }): Promise<CalendarEvent> {
    const startDateTime = new Date(orderData.deliveryDate);
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 2); // Default 2 hour slot

    const event = {
      summary: `Delivery - ${orderData.customerName}`,
      description: `Order ID: ${orderData.orderId}\nAddress: ${orderData.deliveryAddress}${orderData.phoneNumber ? `\nPhone: ${orderData.phoneNumber}` : ""}${orderData.notes ? `\nNotes: ${orderData.notes}` : ""}`,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() },
      location: orderData.deliveryAddress,
      extendedProperties: {
        private: {
          orderId: orderData.orderId,
          locationId: orderData.locationId || "",
        },
      },
    };

    const response = await this.request<any>(
      `/calendars/${this.calendarId}/events`,
      {
        method: "POST",
        body: JSON.stringify(event),
      },
    );

    return this.parseCalendarEvent(response);
  }

  /**
   * Update a calendar event
   */
  async updateOrderEvent(
    eventId: string,
    updates: Partial<{
      summary: string;
      description: string;
      startTime: string;
      endTime: string;
      location: string;
    }>,
  ): Promise<CalendarEvent> {
    // First, get the current event
    const currentEvent = await this.request<any>(
      `/calendars/${this.calendarId}/events/${eventId}`,
    );

    // Prepare update
    const updatedEvent = {
      ...currentEvent,
      summary: updates.summary || currentEvent.summary,
      description: updates.description || currentEvent.description,
      location: updates.location || currentEvent.location,
    };

    if (updates.startTime) {
      updatedEvent.start = {
        dateTime: new Date(updates.startTime).toISOString(),
      };
    }

    if (updates.endTime) {
      updatedEvent.end = { dateTime: new Date(updates.endTime).toISOString() };
    }

    const response = await this.request<any>(
      `/calendars/${this.calendarId}/events/${eventId}`,
      {
        method: "PUT",
        body: JSON.stringify(updatedEvent),
      },
    );

    return this.parseCalendarEvent(response);
  }

  /**
   * Delete a calendar event
   */
  async deleteOrderEvent(eventId: string): Promise<void> {
    await this.request(`/calendars/${this.calendarId}/events/${eventId}`, {
      method: "DELETE",
    });
  }

  /**
   * Sync pickup orders to calendar for a date range
   */
  async syncPickupOrders(
    locationId: string,
    dateRange: { startDate: string; endDate: string },
    orders: Array<{
      id: string;
      customerName: string;
      address: string;
      pickupTime: string;
      phoneNumber?: string;
      notes?: string;
    }>,
  ): Promise<CalendarSyncResult> {
    const result: CalendarSyncResult = {
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const order of orders) {
      try {
        // Check if event already exists
        const existingEvents = await this.request<any>(
          `/calendars/${this.calendarId}/events?q=${encodeURIComponent(order.id)}`,
        );

        if (existingEvents.items?.length > 0) {
          // Update existing event
          const eventId = existingEvents.items[0].id;
          await this.updateOrderEvent(eventId, {
            summary: `Pickup - ${order.customerName}`,
            location: order.address,
          });
        } else {
          // Create new event
          await this.createOrderEvent({
            orderId: order.id,
            customerName: order.customerName,
            deliveryAddress: order.address,
            deliveryDate: order.pickupTime,
            phoneNumber: order.phoneNumber,
            notes: order.notes,
            locationId,
          });
        }

        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          orderId: order.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Parse Google Calendar API event to CalendarEvent
   */
  private parseCalendarEvent(apiEvent: any): CalendarEvent {
    return CalendarEventSchema.parse({
      id: apiEvent.id,
      summary: apiEvent.summary,
      description: apiEvent.description,
      startTime: apiEvent.start?.dateTime || apiEvent.start?.date,
      endTime: apiEvent.end?.dateTime || apiEvent.end?.date,
      location: apiEvent.location,
      status: apiEvent.status,
      organizer: apiEvent.organizer,
      attendees: apiEvent.attendees,
      extendedProperties: apiEvent.extendedProperties,
    });
  }

  /**
   * Set which calendar to use
   */
  setCalendarId(calendarId: string): void {
    this.calendarId = calendarId;
  }

  /**
   * Get calendar ID
   */
  getCalendarId(): string {
    return this.calendarId;
  }
}

/**
 * Create Google Calendar service instance
 */
export function createGoogleCalendarService(
  config: OAuth2Config,
): GoogleCalendarService {
  return new GoogleCalendarService(config);
}
