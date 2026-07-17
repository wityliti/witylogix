'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DeliveryStatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  variant: 'success' | 'info' | 'warning' | 'danger';
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variantClasses = {
  success: 'text-wl-success-400',
  info: 'text-cyan-400',
  warning: 'text-yellow-400',
  danger: 'text-wl-danger-400',
};

const cardBorders = {
  success: '',
  info: '',
  warning: '',
  danger: 'border border-wl-danger-500/20',
};

export function DeliveryStatsCard({
  title,
  value,
  subtitle,
  variant,
  action,
}: DeliveryStatsCardProps) {
  return (
    <Card className={`bg-wl-bg-elevated border-wl-border-default ${cardBorders[variant]}`}>
      <CardContent className="pt-6">
        <h4 className="text-xs uppercase tracking-wide text-wl-text-tertiary font-semibold mb-3">
          {title}
        </h4>
        <div className={`text-3xl font-bold ${variantClasses[variant]}`}>
          {value}
        </div>
        <div className="text-xs text-wl-text-tertiary mt-2">{subtitle}</div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-wl-text-tertiary"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
