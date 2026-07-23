'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Upload, GripVertical, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Stop, Priority } from '@/hooks/use-route-planner';

interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Search addresses via Nominatim (OpenStreetMap) — free, keyless geocoding.
 * Rate limit: 1 request/second per the usage policy.
 */
async function searchAddresses(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 3) return [];
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    if (!res.ok) return [];
    const data: NominatimResult[] = await res.json();
    return data;
  } catch {
    return [];
  }
}

interface StopListEditorProps {
  stops: Stop[];
  onAddStop: (stop: Omit<Stop, 'id'>) => void;
  onUpdateStop: (stopId: string, updates: Partial<Stop>) => void;
  onRemoveStop: (stopId: string) => void;
  onReorderStops: (fromIndex: number, toIndex: number) => void;
  onImportCSV: (csvData: string) => void;
}

const priorityVariant = (p: Priority): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<Priority, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    normal: 'default',
    high: 'warning',
    urgent: 'danger',
  };
  return map[p];
};

const priorityColor = (p: Priority): string => {
  const colors: Record<Priority, string> = {
    normal: '#6b7280',
    high: '#f59e0b',
    urgent: '#ef4444',
  };
  return colors[p];
};

export function StopListEditor({
  stops,
  onAddStop,
  onUpdateStop,
  onRemoveStop,
  onReorderStops,
  onImportCSV,
}: StopListEditorProps) {
  const [newAddress, setNewAddress] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddressChange = useCallback((value: string) => {
    setNewAddress(value);
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchAddresses(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
    }, 500); // 500 ms debounce to respect Nominatim rate limit
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSelectSuggestion = (result: NominatimResult) => {
    setNewAddress('');
    setSuggestions([]);
    setShowSuggestions(false);
    onAddStop({
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      priority: 'normal',
      notes: '',
    });
  };

  const handleAddManually = () => {
    if (newAddress.trim()) {
      onAddStop({
        address: newAddress,
        priority: 'normal',
        notes: '',
      });
      setNewAddress('');
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        onImportCSV(csv);
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorderStops(draggedIndex, index);
      setDraggedIndex(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddManually();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Input Section */}
      <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-wl-text-primary">
            Add Delivery Stops
          </div>

          {/* Address Input */}
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for an address (powered by OpenStreetMap)..."
                value={newAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                onKeyPress={handleKeyPress}
                className={cn(
                  'w-full px-4 py-2 rounded-md text-sm pr-8',
                  'bg-wl-bg-surface text-wl-text-primary',
                  'border border-wl-border-default',
                  'placeholder-wl-text-tertiary',
                  'focus:outline-none focus:border-wl-primary-500 focus:ring-1 focus:ring-wl-primary-500',
                  'transition-colors'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary animate-spin" />
              )}
            </div>

            {/* Autocomplete Suggestions from Nominatim */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-wl-bg-elevated border border-wl-border-default rounded-md shadow-lg z-10">
                {suggestions.map((result, idx) => (
                  <button
                    key={result.place_id}
                    onClick={() => handleSelectSuggestion(result)}
                    className={cn(
                      'w-full px-4 py-2 text-sm text-left text-wl-text-primary',
                      'hover:bg-wl-bg-overlay transition-colors',
                      idx < suggestions.length - 1 ? 'border-b border-wl-border-default' : ''
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
                      <span className="truncate">{result.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddManually}
              disabled={!newAddress.trim()}
            >
              <Plus className="w-4 h-4" />
              Add Stop
            </Button>

            <label>
              <Button
                variant="secondary"
                size="sm"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4" />
                  Import CSV
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
              />
            </label>
          </div>

          {/* CSV Format Help */}
          <div className="text-xs text-wl-text-tertiary bg-wl-bg-surface p-2 rounded">
            CSV format: address, latitude, longitude, notes, priority
          </div>
        </div>
      </Card>

      {/* Stops List */}
      {stops.length > 0 ? (
        <Card className="p-4 bg-wl-bg-elevated border-wl-border-default">
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
              <div className="w-6" />
              <div className="flex-1">Address</div>
              <div className="w-24">Priority</div>
              <div className="w-20">Time Window</div>
              <div className="w-12" />
            </div>

            {/* Stops */}
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {stops.map((stop, index) => (
                <div
                  key={stop.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-md',
                    'bg-wl-bg-surface border border-wl-border-default',
                    'hover:border-wl-border-strong transition-colors',
                    draggedIndex === index && 'opacity-50'
                  )}
                >
                  {/* Drag Handle */}
                  <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-wl-text-tertiary">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Stop Number */}
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      backgroundColor: 'var(--wl-primary-500)',
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Address */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-wl-text-primary truncate">
                      {stop.address}
                    </div>
                    {stop.notes && (
                      <div className="text-xs text-wl-text-tertiary mt-1">
                        {stop.notes}
                      </div>
                    )}
                  </div>

                  {/* Priority Badge */}
                  <Badge variant={priorityVariant(stop.priority)} className="flex-shrink-0">
                    {stop.priority}
                  </Badge>

                  {/* Time Window */}
                  <div className="flex-shrink-0 w-20 text-xs text-wl-text-secondary">
                    {stop.timeWindow ? (
                      <div className="text-center">
                        <div>{stop.timeWindow.earliest}</div>
                        <div className="text-wl-text-tertiary">-</div>
                        <div>{stop.timeWindow.latest}</div>
                      </div>
                    ) : (
                      <span className="text-wl-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => onRemoveStop(stop.id)}
                    className={cn(
                      'flex-shrink-0 p-1 rounded-md text-wl-text-tertiary',
                      'hover:bg-wl-danger-bg hover:text-wl-danger-400',
                      'transition-colors'
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-wl-border-default text-xs text-wl-text-tertiary">
              <span>
                {stops.length} stop{stops.length !== 1 ? 's' : ''} added
              </span>
              <span>
                {stops.filter((s) => s.priority === 'urgent').length} urgent ·{' '}
                {stops.filter((s) => s.priority === 'high').length} high priority
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 bg-wl-bg-surface border border-dashed border-wl-border-default text-center">
          <div className="text-wl-text-tertiary text-sm">
            No stops added yet. Add at least 2 stops to create a route.
          </div>
        </Card>
      )}

      {/* Validation Message */}
      {stops.length > 0 && stops.length < 2 && (
        <div className="text-sm text-wl-danger-400 bg-wl-danger-bg/10 px-3 py-2 rounded-md border border-wl-danger-400/20">
          Add at least 2 stops to proceed
        </div>
      )}
    </div>
  );
}
