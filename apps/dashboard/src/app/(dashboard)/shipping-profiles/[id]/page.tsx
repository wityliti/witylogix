'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Settings,
  MapPin,
  DollarSign,
  Truck,
  Calendar,
  Save,
  X,
  Edit,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useParams, useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface ShippingProfileDetail {
  id: string;
  name: string;
  description: string | null;
  deliveryMethod: string;
  isDefault: boolean;
  isActive: boolean;
  processingTimeHours: number;
  rateType: string;
  flatRate: number | null;
  freeShippingAbove: number | null;
  minOrderAmount: number | null;
  createdAt: string;
  updatedAt: string;
  locations: Array<{
    id: string;
    name: string;
    city: string;
    province: string;
    country: string;
  }>;
  calendarRules: Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    priority: number;
  }>;
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  LOCAL_DELIVERY: 'Local Delivery',
  STORE_PICKUP: 'Store Pickup',
  STANDARD_SHIPPING: 'Standard Shipping',
  EXPRESS_SHIPPING: 'Express Shipping',
  SAME_DAY: 'Same Day',
};

const RATE_TYPE_LABELS: Record<string, string> = {
  FLAT: 'Flat Rate',
  WEIGHT_BASED: 'Weight-Based',
  DISTANCE_BASED: 'Distance-Based',
  ZONE_BASED: 'Zone-Based',
  TIERED: 'Tiered',
  CALCULATED: 'Calculated',
};

export default function ShippingProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: profile, loading, error, refetch } = useApiQuery<ShippingProfileDetail>(
    `/api/v4/shipping-profiles/${id}`,
  );

  const { execute: updateProfile, loading: saving } = useApiMutation<ShippingProfileDetail>(
    'PATCH',
    `/api/v4/shipping-profiles/${id}`,
  );

  const handleEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditDescription(profile.description ?? '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile({ name: editName, description: editDescription });
      setIsEditing(false);
      refetch();
    } catch {
      // error handled by hook
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (!profile) {
    return (
      <div className="p-6 min-h-screen bg-wl-bg-surface">
        <p className="text-wl-text-secondary">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-wl-bg-surface">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            {isEditing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-3xl font-bold bg-transparent border-b border-wl-info-500 text-wl-text-primary outline-none mb-1 w-full"
              />
            ) : (
              <h1 className="text-4xl font-bold text-wl-text-primary mb-1">{profile.name}</h1>
            )}
            <p className="text-wl-text-secondary text-sm">ID: {profile.id}</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="flex items-center gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="flex items-center gap-1.5"
                  onClick={handleCancel}
                >
                  <X size={16} /> Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                className="flex items-center gap-1.5"
                onClick={handleEdit}
              >
                <Edit size={16} /> Edit Profile
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Badge variant={profile.isActive ? 'success' : 'warning'}>
            {profile.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
          {profile.isDefault && (
            <Badge variant="primary">DEFAULT</Badge>
          )}
          <span className="text-xs text-wl-text-secondary">
            Updated: {new Date(profile.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="p-5">
            <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
              <Truck size={14} /> Delivery Method
            </p>
            <p className="text-base text-wl-text-primary font-semibold">
              {DELIVERY_METHOD_LABELS[profile.deliveryMethod] ?? profile.deliveryMethod}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="p-5">
            <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
              <DollarSign size={14} /> Flat Rate
            </p>
            <p className="text-base font-semibold text-wl-info-500">
              {profile.flatRate !== null
                ? profile.flatRate > 0
                  ? formatCurrency(Number(profile.flatRate))
                  : 'FREE'
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="p-5">
            <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
              <Settings size={14} /> Rate Type
            </p>
            <p className="text-base text-wl-text-primary font-semibold">
              {RATE_TYPE_LABELS[profile.rateType] ?? profile.rateType}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-wl-bg-surface border border-wl-border-default">
          <CardContent className="p-5">
            <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
              <Clock size={14} /> Processing Time
            </p>
            <p className="text-base text-wl-text-primary font-semibold">
              {profile.processingTimeHours}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {(profile.description || isEditing) && (
        <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
          <CardHeader className="pb-4 border-b border-wl-border-default">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle size={18} className="text-wl-info-500" /> Description
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full p-3 bg-wl-bg-root border border-wl-border-default rounded text-wl-text-primary text-sm outline-none resize-none focus:border-wl-info-500"
                rows={3}
                placeholder="Profile description..."
              />
            ) : (
              <p className="text-sm text-wl-neutral-300">{profile.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rate Configuration */}
      <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
        <CardHeader className="pb-4 border-b border-wl-border-default">
          <CardTitle className="flex items-center gap-2">
            <DollarSign size={18} className="text-wl-info-500" /> Rate Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">Flat Rate</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                {profile.flatRate !== null
                  ? profile.flatRate > 0
                    ? formatCurrency(Number(profile.flatRate))
                    : 'FREE'
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">Free Shipping Above</p>
              <p className="text-sm font-semibold text-wl-success-400">
                {profile.freeShippingAbove
                  ? formatCurrency(Number(profile.freeShippingAbove))
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-wl-text-secondary mb-1">Min Order Amount</p>
              <p className="text-sm font-semibold text-wl-text-primary">
                {profile.minOrderAmount
                  ? formatCurrency(Number(profile.minOrderAmount))
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attached Locations */}
      <Card className="bg-wl-bg-surface border border-wl-border-default mb-6">
        <CardHeader className="pb-4 border-b border-wl-border-default">
          <CardTitle className="flex items-center gap-2">
            <MapPin size={18} className="text-wl-info-500" /> Attached Locations
            <Badge variant="info" className="ml-auto">
              {profile.locations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {profile.locations.length === 0 ? (
            <p className="text-wl-text-tertiary text-sm">No locations linked to this profile.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {profile.locations.map((location) => (
                <div
                  key={location.id}
                  className="p-3 rounded bg-wl-bg-root border border-wl-border-default flex justify-between items-start"
                >
                  <div>
                    <p className="text-sm text-wl-text-secondary font-semibold">{location.name}</p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {[location.city, location.province, location.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Rules */}
      <Card className="bg-wl-bg-surface border border-wl-border-default">
        <CardHeader className="pb-4 border-b border-wl-border-default">
          <CardTitle className="flex items-center gap-2">
            <Calendar size={18} className="text-wl-info-500" /> Calendar Rules
            <Badge variant="info" className="ml-auto">
              {profile.calendarRules.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {profile.calendarRules.length === 0 ? (
            <p className="text-wl-text-tertiary text-sm">No calendar rules configured.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {profile.calendarRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded bg-wl-bg-root border border-wl-border-default flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm text-wl-text-secondary font-semibold">{rule.name}</p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      Type: {rule.type} · Priority: {rule.priority}
                    </p>
                  </div>
                  <Badge variant={rule.isActive ? 'success' : 'default'}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
