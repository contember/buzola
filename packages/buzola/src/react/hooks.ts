import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Router } from '../engine/router'
import { validateSchema } from '../engine/schema'
import type { EffectivePageParams, NavigateOptions, RegisteredPage, RouterState, StandardSchema } from '../engine/types'
import { RouteContext, RouterContext } from './context'

/**
 * Get the Router instance.
 */
export function useRouter(): Router {
	const router = use(RouterContext)
	if (!router) {
		throw new Error('useRouter must be used within a <BuzolaProvider>')
	}
	return router
}

/**
 * Get the current route context.
 */
function useRouteContext() {
	const context = use(RouteContext)
	if (!context) {
		throw new Error('Route hooks must be used within a <BuzolaProvider>')
	}
	return context
}

/**
 * Type-safe navigation function.
 * Uses page IDs instead of URL patterns.
 * Persistent params are optional — resolved from current URL or fallback.
 */
type NavigateFn = <P extends RegisteredPage>(
	to: P,
	...args: [keyof EffectivePageParams<P>] extends [never] ? [options?: NavigateOptions]
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		: {} extends EffectivePageParams<P> ? [options?: NavigateOptions & { params?: EffectivePageParams<P> }]
		: [options: NavigateOptions & { params: EffectivePageParams<P> }]
) => void

/**
 * Hook to get a type-safe navigate function.
 * Navigates using page IDs — the router looks up the route pattern from the page registry.
 */
export function useNavigate(): NavigateFn {
	const router = useRouter()

	return useCallback(
		(to: string, options?: NavigateOptions & { params?: Record<string, string> }) => {
			router.navigateToPage(to, options?.params, options)
		},
		[router],
	) as NavigateFn
}

/**
 * Hook to get typed route params.
 * Params are merged from all matched routes (root to current depth).
 */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
	const context = useRouteContext()
	return context.params as T
}

/**
 * Hook to get and validate search params.
 * Optionally validates with a Standard Schema compatible schema.
 */
export function useSearchParams<T = Record<string, string>>(
	schema?: StandardSchema<T>,
): T {
	const context = useRouteContext()

	return useMemo(() => {
		const searchParams = context.state.location.searchParams
		const collected = new Map<string, string[]>()
		searchParams.forEach((value, key) => {
			const existing = collected.get(key)
			if (existing) {
				existing.push(value)
			} else {
				collected.set(key, [value])
			}
		})

		// Single-value params are unwrapped to strings, multi-value remain as arrays
		const raw: Record<string, string | string[]> = {}
		for (const [key, values] of collected) {
			raw[key] = values.length === 1 ? values[0] : values
		}

		if (schema) {
			return validateSchema(schema, raw, '[buzola] Search params validation failed: ')
		}

		return raw as T
	}, [context.state.location.searchParams, schema])
}

/**
 * Hook to get information about the current route.
 */
export function useRoute() {
	const context = useRouteContext()
	const router = useRouter()
	const { state, matches, params, depth } = context

	return useMemo(() => ({
		/** Current route's params. */
		params,
		/** All route matches from root to leaf. */
		matches,
		/** Current match depth. */
		depth,
		/** Whether a navigation is pending. */
		isPending: state.isPending,
		/** Current pathname (with base path stripped). */
		pathname: router.stripBasePath(state.location.pathname),
	}), [params, matches, depth, state.isPending, state.location.pathname, router])
}

/**
 * Hook to get the Navigation API state for the current entry.
 */
export function useNavigationState<T = unknown>(): T | undefined {
	const context = useRouteContext()
	return context.state.navigationState as T | undefined
}

/**
 * Hook to get the current RouterState.
 */
export function useRouterState(): RouterState {
	const context = useRouteContext()
	return context.state
}

/**
 * Hook to get a function that invalidates all page loaders.
 * Loaders re-run in the background while stale data is still shown.
 */
export function useInvalidate(): () => void {
	const router = useRouter()
	return useCallback(() => router.invalidateAll(), [router])
}

// ─── Blocker ─────────────────────────────────────────────────────────────────

export interface BlockerState {
	/** Whether a navigation is currently blocked. */
	state: 'idle' | 'blocked'
	/** Allow the blocked navigation to proceed. */
	proceed: () => void
	/** Cancel the blocked navigation and stay on the current page. */
	reset: () => void
}

/**
 * Hook to block navigations (e.g., to warn about unsaved changes).
 *
 * @param when - Whether blocking is active. Pass `true` to block, `false` to allow.
 * @returns An object with the blocker state and proceed/reset functions.
 *
 * @example
 * ```tsx
 * const blocker = useBlocker(formIsDirty);
 *
 * if (blocker.state === 'blocked') {
 *   return <Dialog onConfirm={blocker.proceed} onCancel={blocker.reset} />;
 * }
 * ```
 */
export function useBlocker(when: boolean): BlockerState {
	const router = useRouter()
	const [state, setState] = useState<'idle' | 'blocked'>('idle')
	const resolverRef = useRef<((proceed: boolean) => void) | null>(null)

	const blockerFn = useCallback((): Promise<boolean> => {
		return new Promise((resolve) => {
			resolverRef.current = resolve
			setState('blocked')
		})
	}, [])

	useEffect(() => {
		if (!when) return
		const cleanup = router.addBlocker(blockerFn)
		return () => {
			cleanup()
			// If there's a pending blocker when unmounting, auto-proceed
			if (resolverRef.current) {
				resolverRef.current(true)
				resolverRef.current = null
			}
		}
	}, [router, when, blockerFn])

	const proceed = useCallback(() => {
		resolverRef.current?.(true)
		resolverRef.current = null
		setState('idle')
	}, [])

	const reset = useCallback(() => {
		resolverRef.current?.(false)
		resolverRef.current = null
		setState('idle')
	}, [])

	return { state, proceed, reset }
}
