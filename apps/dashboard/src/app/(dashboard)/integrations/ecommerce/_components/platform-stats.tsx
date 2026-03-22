'use client';

import { Card, CardContent } from '@/components/ui/card';

interface PlatformStatsProps {
  connected: number;
  totalProducts: number;
  totalOrders: number;
  syncErrors: number;
}

export function PlatformStats({
  connected,
  totalProducts,
  totalOrders,
  syncErrors,
}: PlatformStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-white">{connected}</div>
          <p className="text-sm text-gray-500 mt-1">Connected Platforms</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-white">
            {totalProducts.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 mt-1">Total Products Synced</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-white">
            {totalOrders.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 mt-1">Total Orders Synced</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-white">{syncErrors}</div>
          <p className="text-sm text-gray-500 mt-1">Sync Errors</p>
        </CardContent>
      </Card>
    </div>
  );
}
