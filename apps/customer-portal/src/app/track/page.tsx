'use client';

import { useState } from 'react';
import { format, addMinutes } from 'date-fns';
import { MapPin, Phone, MessageCircle, AlertCircle, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveTracking } from '@/types';

// Mock live tracking data
const mockTracking: LiveTracking = {
  orderId: '1',
  driverId: 'DRV-001',
  driver: {
    id: 'DRV-001',
    name: 'Michael Johnson',
    phone: '(555) 123-4567',
    email: 'michael.johnson@witylogix.com',
    photo: '\u{1F468}\u200D\u{1F4BC}',
    vehicle: {
      type: 'Van',
      plate: 'WLX-2024',
      color: 'Blue',
    },
    rating: 4.8,
  },
  currentLocation: {
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: new Date(),
  },
  remainingStops: 3,
  eta: addMinutes(new Date(), 25),
  route: [
    { latitude: 37.7849, longitude: -122.4094 },
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.7649, longitude: -122.4294 },
  ],
};

export default function TrackPage() {
  const [selectedOrder, setSelectedOrder] = useState('1');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const minutesRemaining = Math.ceil(
    (mockTracking.eta.getTime() - new Date().getTime()) / (1000 * 60)
  );

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Live Tracking</h1>
        <p className="page-subtitle">Real-time delivery tracking</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-2">
          <div className={cn(
            'section-card overflow-hidden aspect-video',
            'flex items-center justify-center relative p-0'
          )}>
            {/* Map background pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            {/* Route visualization */}
            <svg
              className="absolute inset-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polyline
                points="10%,10% 50%,30% 90%,50%"
                fill="none"
                stroke="#5B8DEE"
                strokeWidth="3"
                opacity="0.5"
              />
            </svg>

            {/* Driver position */}
            <div className="absolute z-10 left-1/2 top-1/3 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative animate-pulse">
                <div className={cn(
                  'w-6 h-6 rounded-full',
                  'bg-wl-primary-500 border-2 border-white',
                  'shadow-lg'
                )} />
                <div className={cn(
                  'absolute inset-0 rounded-full',
                  'border-2 border-wl-primary-500',
                  'animate-ping'
                )} />
              </div>
            </div>

            {/* Destination pin */}
            <div className="absolute z-10 right-1/4 bottom-1/4">
              <MapPin size={32} className="text-wl-danger-500" fill="currentColor" />
            </div>

            {/* Info overlay */}
            <div className={cn(
              'absolute bottom-0 left-0 right-0 z-20',
              'bg-gradient-to-t from-black/80 to-transparent',
              'p-4 text-white'
            )}>
              <p className="text-sm font-medium">Last updated: {format(lastUpdate, 'p')}</p>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="flex flex-col gap-6 stagger-1">
          {/* ETA Card */}
          <div className="stat-card">
            <span className="label">Estimated Arrival</span>
            <span className="value text-3xl sm:text-4xl mono">
              {minutesRemaining} min
            </span>
            <span className="label">
              Around {format(mockTracking.eta, 'p')}
            </span>
          </div>

          {/* Driver Info */}
          <div className="section-card stagger-2">
            <h3 className="font-bold text-wl-text-primary mb-4">Driver</h3>

            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'w-12 h-12 rounded-full',
                'bg-wl-primary-500/20 flex items-center justify-center',
                'text-2xl'
              )}>
                {mockTracking.driver.photo}
              </div>
              <div>
                <p className="font-medium text-wl-text-primary">
                  {mockTracking.driver.name}
                </p>
                <p className="text-xs text-wl-text-tertiary">
                  {mockTracking.driver.vehicle.color} {mockTracking.driver.vehicle.type}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`tel:${mockTracking.driver.phone}`}
                className="btn btn-primary flex items-center justify-center gap-2 text-sm"
              >
                <Phone size={16} />
                Call Driver
              </a>
              <a
                href={`sms:${mockTracking.driver.phone}`}
                className="btn btn-secondary flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle size={16} />
                Message
              </a>
            </div>
          </div>

          {/* Delivery Status */}
          <div className="section-card stagger-3">
            <h3 className="font-bold text-wl-text-primary mb-4">
              Delivery Status
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-wl-primary-500" />
                <div>
                  <p className="text-sm font-medium text-wl-text-primary">
                    Out for Delivery
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Driver left the warehouse
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-wl-neutral-700" />
                <div>
                  <p className="text-sm font-medium text-wl-text-secondary">
                    {mockTracking.remainingStops} more stop{mockTracking.remainingStops !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-wl-text-tertiary">
                    Before your delivery
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="section-card stagger-4">
            <h3 className="font-bold text-wl-text-primary mb-3">
              Delivery Address
            </h3>
            <p className="text-sm text-wl-text-primary">
              123 Main St, Apt 4B
            </p>
            <p className="text-sm text-wl-text-secondary">
              San Francisco, CA 94105
            </p>
          </div>

          {/* Alert Box */}
          <div className={cn(
            'section-card border-l-2 border-wl-warning-500',
            'flex gap-3 stagger-5'
          )}>
            <AlertCircle size={20} className="text-wl-warning-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-wl-warning-500 mb-1">
                Heads up!
              </p>
              <p className="text-xs text-wl-text-secondary">
                Make sure someone is available at your delivery address
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setLastUpdate(new Date())}
          className="btn btn-ghost flex items-center gap-2"
        >
          <Navigation size={16} />
          Refresh Location
        </button>
      </div>
    </div>
  );
}
