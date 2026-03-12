import React, { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createBrowserNavigationAdapter } from '../engine/navigation-adapter.js'
import { Router } from '../engine/router.js'
import type { RouteMatch, RouteNode } from '../engine/types.js'
import { RouteContext, type RouteContextValue, RouterContext } from './context.js'
import { Outlet } from './outlet.js'

/** Props passed to the middleware component. */
export interface MiddlewareProps {
	/** Merged params from all matched routes. */
	params: Record<string, string>
	/** All route matches from root to leaf. */
	matches: RouteMatch[]
	/** The rendered route tree to wrap. */
	children: React.ReactNode
}

/** Middleware component that wraps the entire router output. */
export type MiddlewareComponent = React.ComponentType<MiddlewareProps>

export type BuzolaProviderProps =
	& {
		children?: React.ReactNode
		/** Global middleware that wraps the rendered route tree. Has access to all matched params. */
		middleware?: MiddlewareComponent
	}
	& (
		| { router: Router; routes?: never; persistentParams?: never; pageRegistry?: never }
		| {
			router?: never
			routes: RouteNode[]
			persistentParams?: () => Record<string, string>
			pageRegistry?: Record<string, string>
		}
	)

/**
 * Root provider for Buzola router.
 * Subscribes to router state and provides context to the React tree.
 */
export function BuzolaProvider({ routes, children, middleware: Middleware, ...props }: BuzolaProviderProps): React.ReactElement {
	const routerRef = useRef<Router | undefined>(props.router)
	if (!routerRef.current) {
		routerRef.current = new Router({
			routes: routes!,
			adapter: createBrowserNavigationAdapter(),
			persistentParams: props.persistentParams,
			pageRegistry: props.pageRegistry,
		})
	}
	const router = routerRef.current
	const subscribe = useCallback((cb: () => void) => router.subscribe(cb), [router])
	const getSnapshot = useCallback(() => router.getState(), [router])
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	// Start navigation interception
	useLayoutEffect(() => {
		return router.start()
	}, [router])

	const routeContextValue = useMemo<RouteContextValue>(() => ({
		state,
		depth: 0,
		matches: state.matches,
		params: {},
	}), [state])

	// Merge params from all matches for middleware
	const allParams = useMemo(() => {
		let merged: Record<string, string> = {}
		for (const match of state.matches) {
			merged = { ...merged, ...match.params }
		}
		return merged
	}, [state.matches])

	const content = children ?? <Outlet />

	return (
		<RouterContext value={router}>
			<RouteContext value={routeContextValue}>
				{Middleware
					? <Middleware params={allParams} matches={state.matches}>{content}</Middleware>
					: content}
			</RouteContext>
		</RouterContext>
	)
}
