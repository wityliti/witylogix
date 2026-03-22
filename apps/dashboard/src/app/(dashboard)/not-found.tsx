'use client';

import { useEffect, useState } from 'react';
import { Search, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Dashboard 404 Not Found page
 * Displayed when a route within the dashboard group doesn't exist
 */
export default function DashboardNotFound() {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    setIsAnimated(true);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-wl-bg-root px-4 py-12">
      <div className="w-full max-w-md">
        {/* Animated illustration */}
        <div
          className={cn(
            'mb-8 flex justify-center transition-all duration-700',
            isAnimated ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
        >
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Magnifying glass */}
            <circle
              cx="90"
              cy="80"
              r="35"
              fill="none"
              stroke="var(--wl-primary-500)"
              strokeWidth="3"
            />
            <line
              x1="115"
              y1="105"
              x2="140"
              y2="130"
              stroke="var(--wl-primary-500)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Question mark inside glass */}
            <text
              x="90"
              y="95"
              textAnchor="middle"
              fontSize="48"
              fontWeight="bold"
              fill="var(--wl-primary-500)"
              className={cn(
                'transition-all duration-500',
                isAnimated ? 'animate-bounce' : ''
              )}
            >
              ?
            </text>
          </svg>
        </div>

        {/* Content */}
        <div
          className={cn(
            'text-center transition-all duration-700 delay-200',
            isAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          <h1 className="mb-2 text-4xl font-bold text-wl-text-primary">
            404
          </h1>
          <h2 className="mb-2 text-xl font-semibold text-wl-text-primary">
            Page Not Found
          </h2>
          <p className="mb-6 text-wl-text-secondary">
            The dashboard page you're looking for doesn't exist or has been moved.
          </p>

          {/* Search suggestion */}
          <div className="mb-8 rounded-lg border border-wl-border-subtle bg-wl-bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 text-wl-text-secondary">
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">Looking for a feature?</span>
            </div>
            <p className="text-xs text-wl-text-tertiary">
              Use the sidebar menu or command palette (Cmd+K) to find what you need.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => (window.location.href = '/dashboard')}
              className="w-full"
            >
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.history.back()}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-wl-text-tertiary">
          Need help? Contact{' '}
          <a
            href="mailto:support@witylogix.com"
            className="text-wl-primary-500 transition-colors hover:text-wl-primary-400"
          >
            support
          </a>
        </div>
      </div>
    </div>
  );
}
