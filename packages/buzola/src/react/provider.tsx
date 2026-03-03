import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createBrowserNavigationAdapter } from '../engine/navigation-adapter.js'
import { Router } from '../engine/router.js'
import type { RouteNode } from '../engine/types.js'
import { RouteContext, type RouteContextValue, RouterContext } from './context.js'
import { Outlet } from './outlet.js'

export type BuzolaProviderProps =
	& {
		children?: React.ReactNode
	}
	& (
		| { router: Router; routes?: never; persistentParams?: never }
		| { router?: never; routes: RouteNode[]; persistentParams?: () => Record<string, string> }
	)

/**
 * Root provider for Buzola router.
 * Subscribes to router state and provides context to the React tree.
 */
export function BuzolaProvider({ routes, children, ...props }: BuzolaProviderProps): React.ReactElement {
	const routerRef = useRef<Router | undefined>(props.router)
	if (!routerRef.current) {
		routerRef.current = new Router({
			routes: routes!,
			adapter: createBrowserNavigationAdapter(),
			persistentParams: props.persistentParams,
		})
	}
	const router = routerRef.current
	const subscribe = useCallback((cb: () => void) => router.subscribe(cb), [router])
	const getSnapshot = useCallback(() => router.getState(), [router])
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	// Start navigation interception
	useEffect(() => {
		return router.start()
	}, [router])

	const routeContextValue = useMemo<RouteContextValue>(() => ({
		state,
		depth: 0,
		matches: state.matches,
		params: {},
	}), [state])

	return (
		<RouterContext value={router}>
			<RouteContext value={routeContextValue}>
				{children ?? <Outlet />}
			</RouteContext>
		</RouterContext>
	)
}
