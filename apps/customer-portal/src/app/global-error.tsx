'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Customer portal global error boundary caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: 'var(--wl-bg-root, #0d0d10)',
          color: 'var(--wl-text-primary, #f0ebe0)',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <p style={{ fontSize: '2rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            Critical error
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--wl-text-secondary, #9e9e9e)',
              margin: 0,
            }}
          >
            An unexpected error occurred. Please refresh the page.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--wl-text-tertiary, #666)',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--wl-amber-500, #f59e0b)',
                color: '#000',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--wl-border-subtle, #333)',
                background: 'transparent',
                color: 'var(--wl-text-secondary, #9e9e9e)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
