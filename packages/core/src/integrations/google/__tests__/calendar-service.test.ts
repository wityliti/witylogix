/**
 * Calendar Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleCalendarService } from '../calendar-service.js';
import type { OAuth2Config, OAuth2Token } from '../types.js';

describe('GoogleCalendarService', () => {
  let calendarService: GoogleCalendarService;
  const mockConfig: OAuth2Config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['calendar'],
  };

  beforeEach(() => {
    calendarService = new GoogleCalendarService(mockConfig);
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should throw if config is incomplete', () => {
      expect(() => new GoogleCalendarService({
        clientId: '',
        clientSecret: 'secret',
        redirectUri: 'http://localhost',
        scopes: [],
      })).toThrow('OAuth2 configuration is incomplete');
    });

    it('should initialize with valid config', () => {
      const service = new GoogleCalendarService(mockConfig);
      expect(service).toBeInstanceOf(GoogleCalendarService);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL', () => {
      const url = calendarService.getAuthorizationUrl('test-state');
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange auth code for token', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      const result = await calendarService.exchangeCodeForToken('test-code');

      expect(result).toHaveProperty('accessToken', 'test-access-token');
      expect(result).toHaveProperty('refreshToken', 'test-refresh-token');
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should throw on failed exchange', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(calendarService.exchangeCodeForToken('invalid-code')).rejects.toThrow();
    });
  });

  describe('setToken and getToken', () => {
    it('should set and get token', () => {
      const mockToken: OAuth2Token = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      calendarService.setToken(mockToken);
      const token = calendarService.getToken();

      expect(token).toEqual(mockToken);
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw if no refresh token available', async () => {
      await expect(calendarService.refreshAccessToken()).rejects.toThrow();
    });

    it('should refresh token', async () => {
      const oldToken: OAuth2Token = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      };

      calendarService.setToken(oldToken);

      const mockNewToken = {
        access_token: 'new-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewToken,
      });

      const result = await calendarService.refreshAccessToken();

      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('setCalendarId and getCalendarId', () => {
    it('should set and get calendar ID', () => {
      calendarService.setCalendarId('calendar-id-123');
      expect(calendarService.getCalendarId()).toBe('calendar-id-123');
    });

    it('should default to primary calendar', () => {
      expect(calendarService.getCalendarId()).toBe('primary');
    });
  });

  describe('createOrderEvent', () => {
    it('should create calendar event for order', async () => {
      const token: OAuth2Token = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      calendarService.setToken(token);

      const mockEvent = {
        id: 'event-123',
        summary: 'Delivery - John Doe',
        description: 'Order ID: order-123',
        start: { dateTime: '2024-03-15T10:00:00Z' },
        end: { dateTime: '2024-03-15T12:00:00Z' },
        location: '123 Main St',
        status: 'confirmed',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvent,
      });

      const result = await calendarService.createOrderEvent({
        orderId: 'order-123',
        customerName: 'John Doe',
        deliveryAddress: '123 Main St',
        deliveryDate: '2024-03-15T10:00:00Z',
        phoneNumber: '555-0123',
        notes: 'Leave at door',
      });

      expect(result).toHaveProperty('id', 'event-123');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('location');
    });
  });

  describe('deleteOrderEvent', () => {
    it('should delete calendar event', async () => {
      const token: OAuth2Token = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      calendarService.setToken(token);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(calendarService.deleteOrderEvent('event-123')).resolves.not.toThrow();
    });
  });
});
