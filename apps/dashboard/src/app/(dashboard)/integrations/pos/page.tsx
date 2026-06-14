'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function POSIntegrationsPage() {
  return (
    <>
      <Header
        title="POS Integrations"
        subtitle="Manage point-of-sale and restaurant system connections"
        actions={<Button variant="primary">Add POS System</Button>}
      />

      <div className={cn('p-6 bg-wl-bg-root space-y-6')}>
        <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Systems</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>POS integrations</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Locations</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>synced locations</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Orders Today</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-white')}>0</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>from all systems</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue Today</CardTitle>
            </CardHeader>
            <div className={cn('p-4 pt-0')}>
              <div className={cn('text-2xl font-bold text-gray-500')}>—</div>
              <p className={cn('text-xs text-gray-500 mt-1')}>no active systems</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>POS Systems</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-400 mb-2')}>No POS systems connected</p>
            <p className={cn('text-sm text-gray-500 mb-6')}>
              Connect Toast, Square, Lightspeed, Clover, Revel, and more from the Marketplace to
              sync orders, menus, and location data directly into your dispatch workflow.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <div className={cn('p-12 text-center')}>
            <p className={cn('text-gray-500 text-sm')}>No orders yet</p>
          </div>
        </Card>
      </div>
    </>
  );
}
