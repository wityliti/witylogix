'use client';

import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FreightIntegrationsPage() {
  return (
    <>
      <Header
        title="Freight Integrations"
        subtitle="Manage load boards, rates, bookings, and compliance"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Available Loads</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>across all providers</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Booked This Month</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>loads booked</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>load boards active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Market Rate</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-gray-500")}>—</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Freight Load Boards</CardTitle>
          </CardHeader>
          <div className={cn("p-12 text-center")}>
            <p className={cn("text-gray-400 mb-2")}>No freight providers connected</p>
            <p className={cn("text-sm text-gray-500 mb-6")}>
              Connect DAT, Truckstop, 123Loadboard, Direct Freight, and more from the Marketplace to aggregate loads and compare rates.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <div className={cn("p-12 text-center")}>
            <p className={cn("text-gray-500 text-sm")}>No bookings yet</p>
          </div>
        </Card>
      </div>
    </>
  );
}
