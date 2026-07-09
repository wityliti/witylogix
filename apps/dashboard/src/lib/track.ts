'use client';

import { api } from '@/lib/api';

export function track(eventType: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  void api
    .post('/api/v4/analytics/events', { eventType, source: 'dashboard', properties }, { keepalive: true })
    .catch(() => {
      // telemetry is best-effort; never block UI
    });
}
