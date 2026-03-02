import React, { Component } from 'react';

interface ErrorBoundaryProps {
  fallback?: React.ReactNode | ((error: Error) => React.ReactNode);
  /** When this key changes, the error state is reset. */
  resetKey?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  prevResetKey: string | undefined;
}

/**
 * Error boundary for catching rendering errors in route components.
 * Resets automatically when `resetKey` changes (e.g., on navigation to a different route).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, prevResetKey: undefined };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    // Reset error state when resetKey changes (i.e., route changed)
    if (state.error && props.resetKey !== state.prevResetKey) {
      return { error: null, prevResetKey: props.resetKey };
    }
    if (props.resetKey !== state.prevResetKey) {
      return { prevResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Buzola route error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return React.createElement('div', { style: { color: 'red' } },
        `Route error: ${this.state.error.message}`
      );
    }
    return this.props.children;
  }
}
