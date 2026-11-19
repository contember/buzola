import React, { Suspense, use, useMemo } from 'react'
import { DefaultErrorFallbackContext, RouteContext, type RouteContextValue } from './context.js'
import { isDev } from './env.js'
import { ErrorBoundary, type ErrorFallback } from './error-boundary.js'

function DefaultNotFound(): React.ReactElement {
	return React.createElement(
		'div',
		{
			style: { fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' },
		},
		isDev
			? [
				React.createElement('h1', { key: 'h' }, '404: Page Not Found'),
				React.createElement('p', { key: 'p1' }, `No route matches "${typeof window !== 'undefined' ? window.location.pathname : ''}".`),
				React.createElement('p', {
					key: 'p2',
					style: { color: '#666', fontSize: '0.9rem' },
				}, 'To handle this, add a _404.tsx catch-all route or pass a notFound prop to <Outlet />.'),
			]
			: [
				React.createElement('h1', { key: 'h' }, '404'),
				React.createElement('p', { key: 'p' }, 'Page not found.'),
			],
	)
}

export interface OutletProps {
	/** Fallback to show while lazy components load. */
	fallback?: React.ReactNode
	/** Fallback to show when a route component throws an error. Defaults to the `errorFallback` of `BuzolaProvider`. */
	errorFallback?: ErrorFallback
	/** Content to show when no route matches. Defaults to a built-in 404 page. Pass `null` to render nothing. */
	notFound?: React.ReactNode
}

/**
 * Renders the component for the current depth in the route match chain.
 * Each Outlet increments the depth and renders the next matched route's component.
 */
export function Outlet({ fallback, errorFallback, notFound }: OutletProps): React.ReactElement | null {
	const routeContext = use(RouteContext)
	if (!routeContext) {
		throw new Error('<Outlet /> must be used within a <BuzolaProvider>')
	}

	const defaultErrorFallback = use(DefaultErrorFallbackContext)
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

	// Any route or param change in the chain resets the boundary: the subtree below can read all of them.
	const resetKey = useMemo(() => JSON.stringify(matches.map(m => [m.node.id, m.params])), [matches])

	if (!match) {
		// At root depth with no matches: show 404
		if (depth === 0 && matches.length === 0) {
			if (notFound === null) return null
			return (notFound ?? React.createElement(DefaultNotFound, null)) as React.ReactElement
		}
		return null
	}

	const Component = match.node.component!

	return (
		<ErrorBoundary fallback={errorFallback ?? defaultErrorFallback} resetKey={resetKey}>
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
