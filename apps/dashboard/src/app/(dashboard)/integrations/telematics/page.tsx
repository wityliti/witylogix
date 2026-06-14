'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TelematicsPage() {
  return (
    <>
      <Header
        title="Telematics Providers"
        subtitle="Configure vehicle tracking and telemetry data integration"
        actions={<Button variant="primary">Add Connection</Button>}
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>providers active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tracked Vehicles</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>total mapped devices</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>synced total</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Errors/Week</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-gray-500")}>—</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connected Providers</CardTitle>
          </CardHeader>
          <div className={cn("p-12 text-center")}>
            <p className={cn("text-gray-400 mb-2")}>No telematics providers connected</p>
            <p className={cn("text-sm text-gray-500 mb-6")}>
              Connect Samsara, Geotab, Flespi, Verizon Connect, Trimble, and more from the Marketplace.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
