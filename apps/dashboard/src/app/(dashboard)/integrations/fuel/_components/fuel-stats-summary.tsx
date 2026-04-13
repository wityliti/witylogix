'use client';

import { cn } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';

interface FuelStatsSummaryProps {
  activeCards: number;
  suspendedCards: number;
  monthlySpend: number;
  avgPricePerGallon: number;
  fraudAlerts: number;
}

export function FuelStatsSummary({
  activeCards,
  suspendedCards,
  monthlySpend,
  avgPricePerGallon,
  fraudAlerts,
}: FuelStatsSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <StatCard
        label="Active Cards"
        value={activeCards.toString()}
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <StatCard
        label="Suspended"
        value={suspendedCards.toString()}
        icon={<AlertTriangle className="w-4 h-4" />}
      />
      <StatCard
        label="Monthly Spend"
        value={`$${monthlySpend.toLocaleString()}`}
        icon={<DollarSign className="w-4 h-4" />}
      />
      <StatCard
        label="Avg Price/Gal"
        value={`$${avgPricePerGallon.toFixed(2)}`}
        icon={<TrendingDown className="w-4 h-4" />}
      />
      <StatCard
        label="Fraud Alerts"
        value={fraudAlerts.toString()}
        icon={<AlertTriangle className="w-4 h-4" />}
      />
    </div>
  );
}
