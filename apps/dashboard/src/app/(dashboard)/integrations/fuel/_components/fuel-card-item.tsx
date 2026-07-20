'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Trash2, Settings } from 'lucide-react';

export type CardStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";
export type AssignmentType = "DRIVER" | "VEHICLE" | "BOTH";

export interface FuelCard {
  id: string;
  provider: string;
  cardNumber: string;
  status: CardStatus;
  assignedTo: string;
  assignmentType: AssignmentType;
  driver?: string;
  vehicle?: string;
  createdDate: string;
  lastUsed: string;
  monthlyLimit: number;
  monthlySpend: number;
  transactions: number;
}

interface FuelCardItemProps {
  card: FuelCard;
  onView?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
}

const statusVariant = (status: CardStatus) => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'default';
    case 'SUSPENDED':
      return 'danger';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
};

export function FuelCardItem({
  card,
  onView,
  onDelete,
  onSettings,
}: FuelCardItemProps) {
  const spendPercentage = (card.monthlySpend / card.monthlyLimit) * 100;

  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-wl-text-primary">
              {card.cardNumber}
            </h3>
            <p className="text-xs text-wl-text-secondary mt-1">{card.provider}</p>
          </div>
          <Badge variant={statusVariant(card.status) as any}>
            {card.status}
          </Badge>
        </div>

        <div className="space-y-2 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Assigned to:</span>
            <span className="text-white font-medium">{card.assignedTo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Last Used:</span>
            <span className="text-white font-medium">{card.lastUsed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Transactions:</span>
            <span className="text-white font-medium">{card.transactions}</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-wl-text-secondary">Monthly Spend</span>
            <span className="text-xs text-white font-medium">
              ${card.monthlySpend} / ${card.monthlyLimit}
            </span>
          </div>
          <div className="w-full bg-wl-bg-root rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                spendPercentage > 90
                  ? 'bg-wl-danger-500'
                  : spendPercentage > 70
                  ? 'bg-wl-warning-500'
                  : 'bg-wl-success-500'
              )}
              style={{ width: `${Math.min(spendPercentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onView}
              className="flex-1"
            >
              <Eye className="w-3 h-3 mr-1" /> View
            </Button>
          )}
          {onSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="flex-1"
            >
              <Settings className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="flex-1 text-wl-danger-400 hover:text-wl-danger-400"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
