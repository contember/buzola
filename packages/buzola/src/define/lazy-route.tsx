import { type ComponentType, createElement, type ReactElement, use } from 'react'

type RouteModuleComponent = ComponentType<Record<string, never>>

export interface LazyRoute {
	/** Renders the loaded component, synchronously once the module has loaded. */
	component: RouteModuleComponent
	/** Starts loading the module. Calls share one request; a failed one is retried by the next call. */
	preload: () => Promise<RouteModuleComponent>
}

/**
 * A route component loaded on demand, like `React.lazy`, but sharing its request with `preload`.
 *
 * `React.lazy` starts its own `import()` the first time it renders, even when the module is already
 * loaded, and the browser resolves that a task later. React then commits the Suspense fallback and
 * holds the page back ~300 ms before revealing it. Once loaded, this component renders without suspending.
 */
export function lazyRoute(load: () => Promise<{ default: RouteModuleComponent }>): LazyRoute {
	let loaded: RouteModuleComponent | null = null
	let request: Promise<RouteModuleComponent> | null = null
	let failed = false

	const start = (): Promise<RouteModuleComponent> => {
		failed = false
		request = load().then(
			module => {
				loaded = module.default
				return module.default
			},
			(error: unknown) => {
				failed = true
				throw error
			},
		)
		return request
	}

	const preload = (): Promise<RouteModuleComponent> => (request === null || failed ? start() : request)

	function LazyRouteComponent(): ReactElement {
		// A failed request stays failed for rendering, as with `React.lazy`; only `preload` asks again.
		return createElement(loaded ?? use(request ?? start()))
	}

	return { component: LazyRouteComponent, preload }
}
