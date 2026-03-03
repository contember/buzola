import React, { Suspense, use, useMemo } from 'react'
import { RouteContext, type RouteContextValue } from './context.js'
import { ErrorBoundary } from './error-boundary.js'

export interface OutletProps {
	/** Fallback to show while lazy components load. */
	fallback?: React.ReactNode
	/** Fallback to show when a route component throws an error. */
	errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode)
}

/**
 * Renders the component for the current depth in the route match chain.
 * Each Outlet increments the depth and renders the next matched route's component.
 */
export function Outlet({ fallback, errorFallback }: OutletProps): React.ReactElement | null {
	const routeContext = use(RouteContext)
	if (!routeContext) {
		throw new Error('<Outlet /> must be used within a <BuzolaProvider>')
	}

	const { state, depth, matches } = routeContext

	// Find the next match that has a component, skipping componentless nodes
	// (e.g. directory layout nodes without a layout.tsx file).
	let effectiveDepth = depth
	let match = matches[effectiveDepth]
	while (match && !match.node.component) {
		effectiveDepth++
		match = matches[effectiveDepth]
	}

	const nextContext = useMemo<RouteContextValue | null>(() => {
		if (!match) return null
		// Merge params from all skipped matches and the effective match
		let mergedParams = { ...routeContext.params }
		for (let i = depth; i <= effectiveDepth; i++) {
			if (matches[i]) {
				mergedParams = { ...mergedParams, ...matches[i].params }
			}
		}
		return {
			state,
			depth: effectiveDepth + 1,
			matches,
			params: mergedParams,
		}
	}, [state, depth, effectiveDepth, matches, match, routeContext.params])

	if (!match) {
		return null
	}

	const Component = match.node.component!

	return (
		<ErrorBoundary fallback={errorFallback} resetKey={match.node.id}>
			<Suspense fallback={fallback ?? null}>
				{nextContext && (
					<RouteContext value={nextContext}>
						<Component />
					</RouteContext>
				)}
			</Suspense>
		</ErrorBoundary>
	)
}
