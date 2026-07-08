'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary component
 * Catches unhandled errors in the root layout and provides recovery options
 * Must be a client component
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Log error for monitoring/reporting
    console.error('Global error boundary caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  if (!isClient) {
    return null;
  }

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body className="wl-noise">
        <div className={cn('flex min-h-screen bg-wl-bg-root')}>
          <main className={cn('flex-1 min-h-screen')}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <div
                className={cn(
                  'w-full max-w-md rounded-lg border border-white/10',
                  'bg-wl-bg-elevated p-8',
                  'shadow-lg backdrop-blur-sm'
                )}
              >
                {/* Error header */}
                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      Critical Error
                    </h1>
                    <p className="text-sm text-wl-text-secondary">
                      Something unexpected happened
                    </p>
                  </div>
                </div>

                {/* Error message */}
                <div className="mb-6 p-4 rounded-md bg-red-900/20 border border-red-500/30">
                  <p className="text-sm text-white mb-2 break-words">
                    {error.message || 'An unexpected error occurred'}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-wl-text-secondary font-mono">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>

                {/* Development details */}
                {isDev && (
                  <div className="mb-6 space-y-2">
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className={cn(
                        'w-full flex items-center justify-between',
                        'px-3 py-2 rounded-md text-sm font-medium',
                        'text-wl-text-secondary bg-white/5 hover:bg-white/10',
                        'border border-white/10 transition-colors'
                      )}
                    >
                      <span>Error Details</span>
                      <span className={cn('text-xs', showDetails && 'rotate-180')}>
                        ▼
                      </span>
                    </button>

                    {showDetails && (
                      <div
                        className={cn(
                          'p-3 rounded-md max-h-48 overflow-auto',
                          'bg-red-900/10 border border-red-500/30',
                          'font-mono text-xs text-wl-text-secondary'
                        )}
                      >
                        {error.stack && (
                          <pre className="whitespace-pre-wrap break-words">
                            {error.stack}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => reset()}
                    variant="primary"
                    size="md"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try again
                  </Button>
                  <Button
                    onClick={() => (window.location.href = '/')}
                    variant="secondary"
                    size="md"
                    className="w-full"
                  >
                    <Home className="w-4 h-4" />
                    Back to home
                  </Button>
                </div>

                {/* Support info */}
                <p className="text-xs text-wl-text-tertiary text-center mt-4">
                  If this persists, contact{' '}
                  <a
                    href="mailto:support@witylogix.com"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    support
                  </a>
                </p>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
