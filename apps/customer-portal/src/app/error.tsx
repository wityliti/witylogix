'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Customer portal error boundary caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className={cn('flex min-h-screen items-center justify-center p-6')}>
      <div className="card w-full max-w-sm text-center space-y-4">
        <div className="space-y-2">
          <p className="text-2xl">⚠️</p>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm" style={{ color: 'var(--wl-text-secondary)' }}>
            We couldn&apos;t load this page. Please try again.
          </p>
          {error.digest && (
            <p
              className="text-xs font-mono"
              style={{ color: 'var(--wl-text-tertiary)' }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button className="btn btn-primary w-full" onClick={() => reset()}>
            Try again
          </button>
          <a className="btn btn-secondary w-full" href="/">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
