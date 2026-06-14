'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ERPPage() {
  return (
    <>
      <Header
        title="ERP & Accounting Providers"
        subtitle="Configure accounting software integrations and data synchronization"
        actions={
          <Link href="/integrations/marketplace">
            <Button variant="primary" size="sm">Browse Marketplace</Button>
          </Link>
        }
      />

      <div className={cn("p-6 space-y-6")}>
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>providers active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Synced Entities</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>entity types</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>synced records</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync Health</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-gray-500")}>—</div>
              <p className={cn("text-xs text-gray-500 mt-1")}>no active syncs</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ERP Providers</CardTitle>
          </CardHeader>
          <div className={cn("p-12 text-center")}>
            <p className={cn("text-gray-400 mb-2")}>No ERP providers connected</p>
            <p className={cn("text-sm text-gray-500 mb-6")}>
              Connect QuickBooks, Xero, SAP, Oracle NetSuite, and more from the Marketplace.
            </p>
            <Button variant="primary">Browse Marketplace</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ERP Providers</CardTitle>
          </CardHeader>
          <div className={cn("p-12 text-center")}>
            <p className={cn("text-gray-500 text-sm")}>No sync operations yet</p>
          </div>
        </Card>
      </div>
    </>
  );
}
