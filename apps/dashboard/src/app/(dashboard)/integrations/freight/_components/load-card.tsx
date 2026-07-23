'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Zap, MapPin } from 'lucide-react';

export interface AggregatedLoad {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  weight: number;
  equipment: string;
  sources: string[];
  bestRate: number;
  avgRate: number;
  carriers: number;
  posted: string;
  pickup: string;
}

interface LoadCardProps {
  load: AggregatedLoad;
  onBook?: () => void;
  onDetails?: () => void;
}

export function LoadCard({ load, onBook, onDetails }: LoadCardProps) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default hover:border-wl-info-500/50 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-wl-text-secondary" />
              <span className="text-sm font-semibold text-wl-text-primary">
                {load.origin}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-wl-text-secondary">→</span>
              <span className="text-sm text-wl-neutral-300">{load.destination}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-wl-success-400">
              ${load.bestRate}
            </div>
            <div className="text-xs text-wl-text-secondary">best rate</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div>
            <span className="text-wl-text-secondary">Distance:</span>
            <p className="text-wl-text-primary font-medium">{load.distance} mi</p>
          </div>
          <div>
            <span className="text-wl-text-secondary">Weight:</span>
            <p className="text-wl-text-primary font-medium">{load.weight} lbs</p>
          </div>
          <div>
            <span className="text-wl-text-secondary">Equipment:</span>
            <p className="text-wl-text-primary font-medium">{load.equipment}</p>
          </div>
          <div>
            <span className="text-wl-text-secondary">Carriers:</span>
            <p className="text-wl-text-primary font-medium">{load.carriers}</p>
          </div>
          <div className="col-span-2">
            <span className="text-wl-text-secondary">Pickup:</span>
            <p className="text-wl-text-primary font-medium">{load.pickup}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {load.sources.map((source) => (
            <Badge key={source} variant="primary" className="text-xs">
              {source}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          {onDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDetails}
              className="flex-1"
            >
              <Eye className="w-3 h-3 mr-1" /> Details
            </Button>
          )}
          {onBook && (
            <Button
              variant="primary"
              size="sm"
              onClick={onBook}
              className="flex-1"
            >
              <Zap className="w-3 h-3 mr-1" /> Book Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
