import React, { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createBrowserNavigationAdapter, isNavigationApiSupported } from '../engine/navigation-adapter.js'
import { resolveScrollContainer, Router } from '../engine/router.js'
import type { RouteMatch, RouteTree, ScrollContainer, ShouldInterceptFn } from '../engine/types.js'
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
		| {
			router: Router
			routes?: never
			persistentParams?: never
			pageRegistry?: never
			shouldIntercept?: never
			scrollContainer?: never
			unsupportedBrowser?: never
		}
		| {
			router?: never
			routes: RouteTree
			persistentParams?: () => Record<string, string>
			pageRegistry?: Record<string, string>
			/** Decides per navigation whether the router handles it; see `RouterOptions.shouldIntercept`. */
			shouldIntercept?: ShouldInterceptFn
			/**
			 * The element the app scrolls its pages in, when that is not the document; see `RouterOptions.scrollContainer`.
			 * Usually a ref to an element a layout renders. Whether it is set is read once, when the router is created.
			 */
			scrollContainer?: ScrollContainer
			/**
			 * Rendered instead of the app in a browser without the Navigation API, where the router cannot run.
			 * It renders on its own, without `middleware` or `children`, which need the router.
			 * Defaults to a short English notice; `null` renders nothing.
			 */
			unsupportedBrowser?: React.ReactNode
		}
	)

/**
 * Root provider for Buzola router.
 * Subscribes to router state and provides context to the React tree.
 */
export function BuzolaProvider({ unsupportedBrowser, ...props }: BuzolaProviderProps): React.ReactElement {
	// A router passed in already has its adapter. Without one, the browser adapter would throw on creation and
	// leave a blank page, so say why instead. Outside a browser the adapter still throws: a notice about the browser
	// would be wrong in server-rendered HTML. Support does not change while the page is open.
	if (!props.router && typeof window !== 'undefined' && !isNavigationApiSupported()) {
		return <>{unsupportedBrowser !== undefined ? unsupportedBrowser : <UnsupportedBrowser />}</>
	}
	return <RouterRoot {...props} />
}

function UnsupportedBrowser(): React.ReactElement {
	return <p>This browser is not supported. Open the page in a current version of Chrome, Edge, Firefox or Safari.</p>
}

function RouterRoot({ routes, children, middleware: Middleware, ...props }: BuzolaProviderProps): React.ReactElement {
	// The router is created once, so it reads the latest prop through a ref rather than the first render's closure.
	const shouldInterceptRef = useRef(props.shouldIntercept)
	const scrollContainerRef = useRef(props.scrollContainer)
	useLayoutEffect(() => {
		shouldInterceptRef.current = props.shouldIntercept
		scrollContainerRef.current = props.scrollContainer
	})
	const routerRef = useRef<Router | undefined>(props.router)
	if (!routerRef.current) {
		routerRef.current = new Router({
			routes: routes!,
			adapter: createBrowserNavigationAdapter(),
			persistentParams: props.persistentParams,
			pageRegistry: props.pageRegistry,
			shouldIntercept: info => shouldInterceptRef.current?.(info) ?? true,
			// Without the prop the router must not get a container at all: it would take over scroll restoration.
			scrollContainer: props.scrollContainer === undefined ? undefined : () => {
				const container = scrollContainerRef.current
				return container === undefined ? null : resolveScrollContainer(container)
			},
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
