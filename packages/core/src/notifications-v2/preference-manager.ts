/**
 * Preference Manager — Customer notification preferences
 */

import {
  NotificationChannel,
  NotificationEventType,
  NotificationPreferences,
  ChannelPreference,
} from "./types.js";

/**
 * Default preferences for new customers
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  customerId: "",
  channels: {
    email: {
      enabled: true,
      eventTypes: {
        order_confirmed: true,
        delivery_scheduled: true,
        out_for_delivery: true,
        delivery_arriving: true,
        delivered: true,
        delivery_failed: true,
        rescheduled: true,
      },
    },
    sms: {
      enabled: true,
      eventTypes: {
        order_confirmed: true,
        delivery_scheduled: true,
        out_for_delivery: true,
        delivery_arriving: true,
        delivered: false,
        delivery_failed: true,
        rescheduled: true,
      },
    },
    whatsapp: {
      enabled: true,
      eventTypes: {
        order_confirmed: true,
        delivery_scheduled: true,
        out_for_delivery: true,
        delivery_arriving: false,
        delivered: false,
        delivery_failed: true,
        rescheduled: true,
      },
    },
    push: {
      enabled: true,
      eventTypes: {
        order_confirmed: true,
        delivery_scheduled: true,
        out_for_delivery: true,
        delivery_arriving: true,
        delivered: true,
        delivery_failed: true,
        rescheduled: true,
      },
    },
  },
  updatedAt: new Date(),
};

/**
 * In-memory preference store (in production, use a database)
 */
const preferenceStore = new Map<string, NotificationPreferences>();

/**
 * Preference Manager — handles customer notification preferences
 */
export class PreferenceManager {
  /**
   * Get preferences for a customer
   */
  static getPreferences(customerId: string): NotificationPreferences {
    const existing = preferenceStore.get(customerId);
    if (existing) {
      const copy = JSON.parse(JSON.stringify(existing));
      copy.updatedAt = new Date(copy.updatedAt); // Restore Date type
      return copy;
    }

    // Create default preferences for new customer
    const defaultPrefs = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
    defaultPrefs.customerId = customerId;
    defaultPrefs.updatedAt = new Date();

    preferenceStore.set(customerId, defaultPrefs);
    return { ...defaultPrefs, updatedAt: new Date(defaultPrefs.updatedAt) };
  }

  /**
   * Update preferences for a customer
   */
  static updatePreferences(customerId: string, prefs: Partial<NotificationPreferences>): void {
    const existing = this.getPreferences(customerId);

    if (prefs.channels) {
      for (const [channel, pref] of Object.entries(prefs.channels)) {
        if (pref) {
          existing.channels[channel as NotificationChannel] = {
            ...existing.channels[channel as NotificationChannel],
            ...pref,
          };
        }
      }
    }

    existing.updatedAt = new Date();
    preferenceStore.set(customerId, existing);
  }

  /**
   * Check if notification should be sent for a customer
   */
  static shouldSend(
    customerId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType
  ): boolean {
    const prefs = this.getPreferences(customerId);

    if (!prefs.channels[channel]?.enabled) {
      return false;
    }

    const eventEnabled = prefs.channels[channel]?.eventTypes?.[eventType];
    return eventEnabled !== false; // Default to true if not explicitly set to false
  }

  /**
   * Enable a channel for a customer
   */
  static enableChannel(customerId: string, channel: NotificationChannel): void {
    const prefs = this.getPreferences(customerId);
    prefs.channels[channel].enabled = true;
    prefs.updatedAt = new Date();
    preferenceStore.set(customerId, prefs);
  }

  /**
   * Disable a channel for a customer
   */
  static disableChannel(customerId: string, channel: NotificationChannel): void {
    const prefs = this.getPreferences(customerId);
    prefs.channels[channel].enabled = false;
    prefs.updatedAt = new Date();
    preferenceStore.set(customerId, prefs);
  }

  /**
   * Enable specific event type for a channel
   */
  static enableEventType(
    customerId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType
  ): void {
    const prefs = this.getPreferences(customerId);
    if (!prefs.channels[channel].eventTypes) {
      prefs.channels[channel].eventTypes = {};
    }
    prefs.channels[channel].eventTypes[eventType] = true;
    prefs.updatedAt = new Date();
    preferenceStore.set(customerId, prefs);
  }

  /**
   * Disable specific event type for a channel
   */
  static disableEventType(
    customerId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType
  ): void {
    const prefs = this.getPreferences(customerId);
    if (!prefs.channels[channel].eventTypes) {
      prefs.channels[channel].eventTypes = {};
    }
    prefs.channels[channel].eventTypes[eventType] = false;
    prefs.updatedAt = new Date();
    preferenceStore.set(customerId, prefs);
  }

  /**
   * Get available channels for an event type
   */
  static getAvailableChannels(
    customerId: string,
    eventType: NotificationEventType
  ): NotificationChannel[] {
    const prefs = this.getPreferences(customerId);
    const channels: NotificationChannel[] = [];

    for (const [channel, preference] of Object.entries(prefs.channels)) {
      if (this.shouldSend(customerId, channel as NotificationChannel, eventType)) {
        channels.push(channel as NotificationChannel);
      }
    }

    return channels;
  }

  /**
   * Reset preferences to defaults (for testing)
   */
  static resetPreferences(customerId: string): void {
    const defaultPrefs = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
    defaultPrefs.customerId = customerId;
    defaultPrefs.updatedAt = new Date();
    preferenceStore.set(customerId, defaultPrefs);
  }

  /**
   * Clear all preferences (for testing)
   */
  static clearAll(): void {
    preferenceStore.clear();
  }
}
