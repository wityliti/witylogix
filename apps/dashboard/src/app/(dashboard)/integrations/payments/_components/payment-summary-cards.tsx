'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentSummaryCardsProps {
  totalVolume: number;
  totalFees: number;
  connectedProviders: number;
}

export function PaymentSummaryCards({
  totalVolume,
  totalFees,
  connectedProviders,
}: PaymentSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 border-[#3b82f6]/30">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-[#3b82f6] uppercase">
            Total Volume
          </p>
          <p className="text-3xl font-bold text-[#3b82f6] mt-2">
            ${totalVolume.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#3b82f6] mt-2">
            Across all providers
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/30">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-[#3b82f6] uppercase">
            Total Fees
          </p>
          <p className="text-3xl font-bold text-blue-400 mt-2">
            ${totalFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-[#3b82f6] mt-2">
            {((totalFees / totalVolume) * 100).toFixed(2)}% of volume
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30">
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-[#3b82f6] uppercase">
            Connected Providers
          </p>
          <p className="text-3xl font-bold text-green-400 mt-2">
            {connectedProviders}
          </p>
          <p className="text-xs text-[#3b82f6] mt-2">
            Active integrations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
