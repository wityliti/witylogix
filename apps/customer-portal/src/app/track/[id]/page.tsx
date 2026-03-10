'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Share2, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeliveryTracking } from '@/hooks/use-delivery-tracking';
import { LiveMap } from '@/components/live-map';
import { ETACountdown } from '@/components/eta-countdown';
import { DeliveryStatusTimeline } from '@/components/delivery-status-timeline';
import { DriverInfoCard } from '@/components/driver-info-card';
import { BottomSheet } from '@/components/bottom-sheet';
import type { DeliveryTracking, DeliveryStepDetail } from '@/types';

// Mock data - replace with real API calls
const mockDeliveryData: Record<string, DeliveryTracking> = {
  'ORD-2024-001': {
    orderId: 'ORD-2024-001',
    driverId: 'DRV-123',
    driver: {
      id: 'DRV-123',
      name: 'John Martinez',
      phone: '+1-555-0123',
      email: 'john@example.com',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      vehicle: {
        type: 'Van',
        plate: 'ABC-1234',
        color: 'Blue',
      },
      rating: 4.8,
    },
    driverPosition: {
      latitude: 40.7128,
      longitude: -74.0060,
      bearing: 45,
      speed: 35,
      timestamp: new Date(),
    },
    deliveryStatus: 'out-for-delivery' as const,
    eta: new Date(Date.now() + 12 * 60000), // 12 minutes from now
    route: [
      { latitude: 40.7128, longitude: -74.0060, bearing: 45, speed: 35, timestamp: new Date() },
      { latitude: 40.7140, longitude: -74.0068, bearing: 45, speed: 35, timestamp: new Date() },
      { latitude: 40.7152, longitude: -74.0076, bearing: 45, speed: 35, timestamp: new Date() },
    ],
    destinationLatitude: 40.7164,
    destinationLongitude: -74.0084,
    isConnected: true,
    lastUpdated: new Date(),
  },
};

export default function TrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [deliveryData] = useState<DeliveryTracking | null>(
    mockDeliveryData[orderId] || null
  );
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [routeProgress, setRouteProgress] = useState(0);

  const { driverPosition, deliveryStatus, eta, isConnected } = useDeliveryTracking({
    orderId,
    token: 'mock-token',
  });

  // Use mock data or hook data
  const activeData = deliveryData && {
    ...deliveryData,
    driverPosition: driverPosition || deliveryData.driverPosition,
    deliveryStatus: deliveryStatus || deliveryData.deliveryStatus,
    eta: eta || deliveryData.eta,
    isConnected,
  };

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate route progress
  useEffect(() => {
    if (activeData) {
      const now = Date.now();
      const createdTime = new Date('2024-03-11T14:00:00').getTime();
      const etaTime = activeData.eta.getTime();
      const elapsedPercent = Math.max(
        0,
        Math.min(100, ((now - createdTime) / (etaTime - createdTime)) * 100)
      );
      setRouteProgress(Math.round(elapsedPercent));
    }
  }, [activeData]);

  if (!activeData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-wl-text-secondary mb-4">Delivery not found</p>
          <button
            onClick={() => router.back()}
            className={cn(
              'px-4 py-2 rounded-md',
              'bg-wl-primary-500 text-white font-medium',
              'hover:bg-wl-primary-600 transition-colors'
            )}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const statusSteps: DeliveryStepDetail[] = [
    {
      step: 'ordered',
      status: 'completed',
      timestamp: new Date(Date.now() - 45 * 60000),
      details: 'Your order was placed',
    },
    {
      step: 'confirmed',
      status: 'completed',
      timestamp: new Date(Date.now() - 40 * 60000),
      details: 'Order confirmed by store',
      expandedInfo: {
        driverAssigned: 'John Martinez',
      },
    },
    {
      step: 'dispatched',
      status: 'completed',
      timestamp: new Date(Date.now() - 20 * 60000),
      details: 'Driver started delivery route',
      expandedInfo: {
        estimatedTime: activeData.eta,
      },
    },
    {
      step: 'out-for-delivery',
      status: 'current',
      timestamp: new Date(Date.now() - 5 * 60000),
      details: activeData.driver.name + ' is on the way',
    },
    {
      step: 'nearby',
      status: 'pending',
      details: 'Driver will arrive soon',
    },
    {
      step: 'delivered',
      status: 'pending',
      details: 'Order will be marked as delivered',
    },
  ];

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-wl-bg-root">
      {/* Desktop: Full-width map with sidebar */}
      {!isMobile && (
        <>
          {/* Map Section */}
          <div className="flex-1 relative">
            <LiveMap
              driverPosition={activeData.driverPosition}
              destinationLat={activeData.destinationLatitude}
              destinationLng={activeData.destinationLongitude}
              route={activeData.route}
              isConnected={activeData.isConnected}
            />

            {/* Share Button */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/track/${orderId}`;
                navigator.clipboard.writeText(url);
                alert('Tracking link copied to clipboard!');
              }}
              className={cn(
                'absolute top-6 right-6 z-10',
                'flex items-center gap-2 px-4 py-3 rounded-md',
                'bg-white/90 backdrop-blur-sm shadow-md',
                'text-wl-text-primary font-medium text-sm',
                'hover:bg-white transition-colors'
              )}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>

          {/* Sidebar */}
          <div className={cn(
            'w-96 flex flex-col border-l border-wl-border-subtle',
            'bg-wl-bg-root overflow-y-auto'
          )}>
            <div className="p-6 space-y-6">
              {/* ETA Section */}
              <ETACountdown
                eta={activeData.eta}
                routeProgress={routeProgress}
                lastUpdated={activeData.lastUpdated}
              />

              {/* Driver Info */}
              <DriverInfoCard
                driver={activeData.driver}
                isConnected={activeData.isConnected}
              />

              {/* Order Items */}
              <div className={cn(
                'rounded-lg border border-wl-border-subtle',
                'bg-wl-bg-surface p-6 space-y-3'
              )}>
                <h3 className="font-semibold text-wl-text-primary">Delivery Items</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-wl-text-secondary">2x Fresh Vegetables Bundle</span>
                    <span className="text-sm font-medium text-wl-text-primary">$24.99</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-wl-text-secondary">1x Organic Milk (1L)</span>
                    <span className="text-sm font-medium text-wl-text-primary">$5.99</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-wl-text-secondary">1x Whole Wheat Bread</span>
                    <span className="text-sm font-medium text-wl-text-primary">$3.49</span>
                  </div>
                  <div className="pt-2 border-t border-wl-border-subtle">
                    <div className="flex justify-between">
                      <span className="font-semibold text-wl-text-primary">Total</span>
                      <span className="font-semibold text-wl-text-primary">$34.47</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Instructions */}
              <div className={cn(
                'rounded-lg border border-wl-border-subtle',
                'bg-wl-bg-elevated p-4 flex gap-3'
              )}>
                <MapPin className="w-4 h-4 text-wl-info-500 flex-shrink-0 mt-1" />
                <p className="text-sm text-wl-text-secondary">
                  <span className="font-medium">Delivery Note:</span> Please leave package at front door if no one answers. Thank you!
                </p>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold text-wl-text-primary mb-4">Delivery Status</h3>
                <DeliveryStatusTimeline steps={statusSteps} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile: Map full screen with bottom sheet */}
      {isMobile && (
        <>
          <div className="flex-1 relative">
            <LiveMap
              driverPosition={activeData.driverPosition}
              destinationLat={activeData.destinationLatitude}
              destinationLng={activeData.destinationLongitude}
              route={activeData.route}
              isConnected={activeData.isConnected}
            />

            {/* Mobile Top Button Bar */}
            <div className={cn(
              'absolute top-4 left-4 right-4 z-10',
              'flex gap-3'
            )}>
              <button
                onClick={() => setShowDetailsSheet(true)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md',
                  'bg-white/90 backdrop-blur-sm shadow-md',
                  'text-wl-text-primary font-medium text-sm',
                  'hover:bg-white transition-colors'
                )}
              >
                <Clock className="w-4 h-4" />
                Details
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/track/${orderId}`;
                  navigator.clipboard.writeText(url);
                  alert('Link copied!');
                }}
                className={cn(
                  'px-4 py-3 rounded-md',
                  'bg-white/90 backdrop-blur-sm shadow-md',
                  'text-wl-text-primary font-medium',
                  'hover:bg-white transition-colors'
                )}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Bottom Sheet */}
          <BottomSheet
            isOpen={showDetailsSheet}
            onClose={() => setShowDetailsSheet(false)}
            title="Delivery Details"
            snapPoints={[120, 280, 500]}
          >
            <div className="space-y-6 pb-6">
              {/* ETA Section */}
              <ETACountdown
                eta={activeData.eta}
                routeProgress={routeProgress}
                lastUpdated={activeData.lastUpdated}
              />

              {/* Driver Info */}
              <DriverInfoCard
                driver={activeData.driver}
                isConnected={activeData.isConnected}
              />

              {/* Order Items */}
              <div className="space-y-3">
                <h3 className="font-semibold text-wl-text-primary">Items</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-wl-text-secondary">2x Vegetables Bundle</span>
                    <span className="font-medium">$24.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-wl-text-secondary">1x Milk (1L)</span>
                    <span className="font-medium">$5.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-wl-text-secondary">1x Bread</span>
                    <span className="font-medium">$3.49</span>
                  </div>
                  <div className="pt-2 border-t border-wl-border-subtle flex justify-between font-semibold">
                    <span>Total</span>
                    <span>$34.47</span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold text-wl-text-primary mb-3">Status</h3>
                <DeliveryStatusTimeline steps={statusSteps} />
              </div>
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
