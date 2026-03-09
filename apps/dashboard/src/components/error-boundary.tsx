import React, { ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
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
    // Log error details for monitoring/reporting
    console.error("ErrorBoundary caught an error:", {
      message: error.message,
      stack: error.stack,
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      timestamp: new Date().toISOString(),
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to external error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div
            className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-8 max-w-md"
            style={{
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            <h2 className="text-lg font-semibold text-wl-text-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-wl-text-secondary mb-4">
              An error occurred while rendering this component.
            </p>

            <div
              className="p-3 rounded-md bg-wl-danger-bg border border-wl-danger-400/30 mb-4"
              style={{
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              <p className="text-xs text-wl-danger-400 font-mono break-all">
                {this.state.error.message}
              </p>
            </div>

            <button
              onClick={this.handleRetry}
              className={
                "w-full px-4 py-2 text-sm font-medium rounded-md " +
                "bg-gradient-to-br from-wl-primary-500 to-wl-primary-600 " +
                "text-wl-text-inverse border border-wl-primary-600 " +
                "hover:from-wl-primary-600 hover:to-wl-primary-700 " +
                "transition-all duration-base ease-default"
              }
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
