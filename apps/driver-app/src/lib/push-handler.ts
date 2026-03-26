/**
 * PushNotificationHandler - Manages push notifications and deep linking
 */

export type NotificationType =
  | 'NEW_ASSIGNMENT'
  | 'ROUTE_UPDATE'
  | 'DELIVERY_REMINDER'
  | 'SCHEDULE_CHANGE'
  | 'MESSAGE'
  | 'EMERGENCY';

export interface PushPayload {
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  timestamp: number;
  notificationId?: string;
}

export interface LocalNotificationHistory {
  id: string;
  payload: PushPayload;
  displayedAt: number;
  actionTaken?: string;
}

const HISTORY_STORAGE_KEY = 'witylogix_notification_history';
const MAX_HISTORY_ITEMS = 50;
const BADGE_STORAGE_KEY = 'witylogix_badge_count';

export class PushNotificationHandler {
  private listeners: Set<(payload: PushPayload) => void> = new Set();
  private badgeCount: number = 0;

  constructor() {
    this.loadBadgeCount();
    this.setupPushListeners();
  }

  /**
   * Register for push notifications
   */
  async registerForPush(): Promise<string | null> {
    // Web-based FCM token registration
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported');
      return null;
    }

    try {
      if (Notification.permission === 'denied') {
        console.log('Notification permission denied');
        return null;
      }

      if (Notification.permission === 'granted') {
        return await this.getFCMToken();
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return await this.getFCMToken();
      }

      return null;
    } catch (error) {
      console.error('Error registering for push:', error);
      return null;
    }
  }

  /**
   * Get FCM token (mocked for web)
   */
  private async getFCMToken(): Promise<string> {
    // In production, this would interact with Firebase Cloud Messaging
    const token = `fcm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fcm_token', token);
    }
    return token;
  }

  /**
   * Setup push notification listeners
   */
  private setupPushListeners(): void {
    if (typeof window === 'undefined') return;

    // Handle service worker messages (for push events)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'PUSH_NOTIFICATION') {
          this.handleIncomingPush(event.data.payload);
        }
      });
    }

    // Simulate receiving push notifications (for testing)
    if (typeof window !== 'undefined' && !(window as any).PushNotificationHandler) {
      (window as any).PushNotificationHandler = this;
    }
  }

  /**
   * Handle incoming push notification
   */
  async handleIncomingPush(payload: PushPayload): Promise<void> {
    try {
      // Route notification by type
      switch (payload.type) {
        case 'NEW_ASSIGNMENT':
          await this.handleNewAssignment(payload);
          break;
        case 'ROUTE_UPDATE':
          await this.handleRouteUpdate(payload);
          break;
        case 'DELIVERY_REMINDER':
          await this.handleDeliveryReminder(payload);
          break;
        case 'SCHEDULE_CHANGE':
          await this.handleScheduleChange(payload);
          break;
        case 'MESSAGE':
          await this.handleMessage(payload);
          break;
        case 'EMERGENCY':
          await this.handleEmergency(payload);
          break;
        default:
          console.warn('Unknown notification type:', payload.type);
      }

      // Show local notification
      await this.showLocalNotification(payload.title, payload.body, payload.data);

      // Store in history
      this.addToHistory(payload);

      // Update badge
      this.updateBadgeCount(this.badgeCount + 1);

      // Notify listeners
      this.notifyListeners(payload);
    } catch (error) {
      console.error('Error handling incoming push:', error);
    }
  }

  /**
   * Handle new assignment notification
   */
  private async handleNewAssignment(payload: PushPayload): Promise<void> {
    const { routeId, stopCount } = payload.data;
    console.log(`New assignment: Route ${routeId} with ${stopCount} stops`);
  }

  /**
   * Handle route update notification
   */
  private async handleRouteUpdate(payload: PushPayload): Promise<void> {
    const { routeId, updatedStops } = payload.data;
    console.log(`Route ${routeId} updated with ${updatedStops} changes`);
  }

  /**
   * Handle delivery reminder notification
   */
  private async handleDeliveryReminder(payload: PushPayload): Promise<void> {
    const { shipmentId, destination } = payload.data;
    console.log(`Reminder: Deliver to ${destination}`);
  }

  /**
   * Handle schedule change notification
   */
  private async handleScheduleChange(payload: PushPayload): Promise<void> {
    const { newStartTime, newEndTime } = payload.data;
    console.log(`Schedule changed: ${newStartTime} - ${newEndTime}`);
  }

  /**
   * Handle message notification
   */
  private async handleMessage(payload: PushPayload): Promise<void> {
    const { fromName, messagePreview } = payload.data;
    console.log(`Message from ${fromName}: ${messagePreview}`);
  }

  /**
   * Handle emergency notification
   */
  private async handleEmergency(payload: PushPayload): Promise<void> {
    const { severity, location } = payload.data;
    console.log(`EMERGENCY (${severity}): ${location}`);
  }

  /**
   * Show local notification
   */
  async showLocalNotification(
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        tag: `notification_${Date.now()}`,
        badge: '/badge-icon.png',
        icon: '/notification-icon.png',
        data,
      });

      notification.onclick = () => {
        this.handleNotificationAction('click', data);
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Handle notification action (deep linking)
   */
  handleNotificationAction(action: string, data: Record<string, any>): void {
    const { type, routeId, shipmentId, stopId, messageId } = data;

    let deepLink = '/';

    switch (type || action) {
      case 'NEW_ASSIGNMENT':
        deepLink = `/routes/${routeId}`;
        break;
      case 'ROUTE_UPDATE':
        deepLink = `/routes/${routeId}`;
        break;
      case 'DELIVERY_REMINDER':
        deepLink = `/delivery/${shipmentId}`;
        break;
      case 'SCHEDULE_CHANGE':
        deepLink = '/schedule';
        break;
      case 'MESSAGE':
        deepLink = `/messages/${messageId}`;
        break;
      case 'EMERGENCY':
        deepLink = '/emergency';
        break;
      default:
        deepLink = '/home';
    }

    // Trigger navigation event (integrate with your router)
    const event = new CustomEvent('notification-action', {
      detail: { deepLink, data },
    });
    window.dispatchEvent(event);
  }

  /**
   * Update app badge count
   */
  updateBadgeCount(count: number): void {
    this.badgeCount = Math.max(0, count);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BADGE_STORAGE_KEY, String(this.badgeCount));
    }

    // Update browser badge if available
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      (navigator as any).setAppBadge(this.badgeCount);
    }

    // Dispatch event for UI updates
    const event = new CustomEvent('badge-updated', {
      detail: { count: this.badgeCount },
    });
    window.dispatchEvent(event);
  }

  /**
   * Clear badge count
   */
  clearBadge(): void {
    this.updateBadgeCount(0);
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge();
    }
  }

  /**
   * Get current badge count
   */
  getBadgeCount(): number {
    return this.badgeCount;
  }

  /**
   * Add notification to history
   */
  private addToHistory(payload: PushPayload): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const history = this.getNotificationHistory();
      const item: LocalNotificationHistory = {
        id: payload.notificationId || `notif_${Date.now()}`,
        payload,
        displayedAt: Date.now(),
      };

      history.unshift(item);
      if (history.length > MAX_HISTORY_ITEMS) {
        history.pop();
      }

      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(): LocalNotificationHistory[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load notification history:', error);
      return [];
    }
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear notification history:', error);
    }
  }

  /**
   * Load badge count from storage
   */
  private loadBadgeCount(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const count = localStorage.getItem(BADGE_STORAGE_KEY);
      this.badgeCount = count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Failed to load badge count:', error);
    }
  }

  /**
   * Subscribe to notifications
   */
  subscribe(listener: (payload: PushPayload) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(payload: PushPayload): void {
    this.listeners.forEach((listener) => listener(payload));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const pushHandler = new PushNotificationHandler();
