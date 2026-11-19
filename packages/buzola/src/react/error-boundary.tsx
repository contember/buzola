import React, { Component } from 'react'
import { isDev } from './env.js'

/** What a route error boundary renders in place of a route that threw. */
export type ErrorFallback = React.ReactNode | ((error: Error) => React.ReactNode)

interface ErrorBoundaryProps {
	/** Rendered in place of the children after they throw. Any value other than `undefined`, `null` included, replaces the built-in notice. */
	fallback?: ErrorFallback
	/** When this key changes, the error state is reset. */
	resetKey?: string
	children: React.ReactNode
}

interface ErrorBoundaryState {
	error: Error | null
	prevResetKey: string | undefined
}

/**
 * Error boundary for catching rendering errors in route components.
 * Resets automatically when `resetKey` changes (e.g., on navigation to another URL).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null, prevResetKey: undefined }

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { error }
	}

	static getDerivedStateFromProps(
		props: ErrorBoundaryProps,
		state: ErrorBoundaryState,
	): Partial<ErrorBoundaryState> | null {
		if (state.error && props.resetKey !== state.prevResetKey) {
			return { error: null, prevResetKey: props.resetKey }
		}
		if (props.resetKey !== state.prevResetKey) {
			return { prevResetKey: props.resetKey }
		}
		return null
	}

	componentDidCatch(error: Error, info: React.ErrorInfo): void {
		console.error('Buzola route error:', error, info)
	}

	render(): React.ReactNode {
		if (this.state.error) {
			if (typeof this.props.fallback === 'function') {
				return this.props.fallback(this.state.error)
			}
			if (this.props.fallback !== undefined) {
				return this.props.fallback
			}
			return <DefaultErrorFallback error={this.state.error} />
		}
		return this.props.children
	}
}

// The message stays out of production builds: it can carry internals and means nothing to the user.
function DefaultErrorFallback({ error }: { error: Error }): React.ReactElement {
	return (
		<div role="alert">
			<p>Something went wrong while showing this page.</p>
			{isDev && <p>Route error: {error.message}</p>}
		</div>
	)
}
