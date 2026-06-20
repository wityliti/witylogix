'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';

export default function FreightIntegrationsPage() {
  return (
    <>
      <Header
        title="Freight Integrations"
        subtitle="Manage load boards, rates, bookings, and compliance"
        actions={
          <Link href="/integrations/marketplace">
            <Button variant="primary" size="sm">Browse Marketplace</Button>
          </Link>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>Freight Load Boards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-12 text-center">
              <Truck className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
              <p className="text-wl-text-secondary mb-1">Freight integrations coming soon</p>
              <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                Load board connections for DAT, Truckstop, 123Loadboard, and Direct Freight are
                not yet available in the marketplace. Check back soon or contact support to
                request early access.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/integrations/marketplace">
                  <Button variant="ghost">Browse Marketplace</Button>
                </Link>
                <Link href="/support">
                  <Button variant="primary">Request Access</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
