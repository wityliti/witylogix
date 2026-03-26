'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches render errors
 * Provides fallback UI and retry functionality
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary
 *   fallback={({ error, reset }) => (
 *     <div>Error: {error.message}</div>
 *   )}
 *   onError={(error, info) => console.error(error, info)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error tracking service (integration point)
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.handleReset);
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className={cn(
          'flex items-center justify-center min-h-screen',
          'bg-wl-bg-root px-4 py-12'
        )}>
          <div className={cn(
            'w-full max-w-md',
            'bg-wl-bg-elevated border border-wl-border-subtle rounded-lg',
            'p-8 space-y-6'
          )}>
            {/* Icon */}
            <div className="flex justify-center">
              <div className={cn(
                'w-14 h-14 rounded-lg',
                'bg-wl-danger-bg border border-wl-danger-400/30',
                'flex items-center justify-center'
              )}>
                <AlertTriangle className="w-7 h-7 text-wl-danger-400" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-wl-text-primary">
                Something went wrong
              </h2>
              <p className="text-sm text-wl-text-secondary">
                An error occurred while rendering this section.
              </p>
            </div>

            {/* Error details (dev mode) */}
            {process.env.NODE_ENV === 'development' && (
              <details className={cn(
                'p-3 rounded-md',
                'bg-wl-danger-bg border border-wl-danger-400/30',
                'max-h-48 overflow-auto'
              )}>
                <summary className="text-xs font-medium text-wl-danger-400 cursor-pointer mb-2">
                  Error details
                </summary>
                <p className="text-xs text-wl-danger-400 font-mono break-all">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-xs text-wl-danger-300/60 font-mono mt-2 whitespace-pre-wrap break-words">
                    {this.state.error.stack}
                  </pre>
                )}
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleReset}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Go home
              </Button>
            </div>

            {/* Help text */}
            <p className="text-xs text-wl-text-tertiary text-center">
              If the problem persists, please{' '}
              <a
                href="mailto:support@witylogix.com"
                className="text-wl-primary-500 hover:text-wl-primary-400 transition-colors"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
