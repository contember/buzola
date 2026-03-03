import { matchRoutes } from './matcher'
import type { BlockerFn, GuardRedirect, NavigateOptions, NavigationAdapter, RouteMatch, RouteNode, RouterState } from './types'

function isGuardRedirect(value: unknown): value is GuardRedirect {
	return typeof value === 'object' && value !== null && 'redirect' in value && typeof (value as GuardRedirect).redirect === 'string'
}

/**
 * Thrown when a route guard prevents navigation.
 */
export class NavigationAbortedError extends Error {
	constructor() {
		super('Navigation aborted by route guard')
		this.name = 'NavigationAbortedError'
	}
}

export type RouterSubscriber = (state: RouterState) => void

export interface RouterOptions {
	/** Route tree nodes. */
	routes: RouteNode[]
	/** Navigation adapter (browser or memory). */
	adapter: NavigationAdapter
	/** Enable View Transitions API for navigations. */
	viewTransitions?: boolean
	/**
	 * Base path prefix for all routes (e.g., "/app").
	 * Routes are defined without the base path; the router prepends it
	 * for navigation and strips it for matching.
	 */
	basePath?: string
}

/**
 * Central Router orchestrator.
 * Intercepts all navigations via the Navigation API and manages route matching.
 */
export class Router {
	private routes: RouteNode[]
	private adapter: NavigationAdapter
	private viewTransitions: boolean
	private readonly _basePath: string
	private subscribers = new Set<RouterSubscriber>()
	private state: RouterState
	private navigationId = 0
	private currentAbortController?: AbortController
	private stopFn: (() => void) | undefined
	private blockers = new Set<BlockerFn>()
	private pendingScrollBehavior: 'after-transition' | 'manual' = 'after-transition'

	constructor(options: RouterOptions) {
		this.routes = options.routes
		this.adapter = options.adapter
		this.viewTransitions = options.viewTransitions ?? false
		this._basePath = options.basePath ? options.basePath.replace(/\/$/, '') : ''

		// Initialize state from current URL
		const url = this.adapter.getCurrentURL()
		const matches = matchRoutes(this.routes, this.createMatchUrl(url)) ?? []

		this.state = {
			location: url,
			matches,
			isPending: false,
			navigationState: this.adapter.getState(),
		}
	}

	/**
	 * The configured base path (e.g., "/app"). Empty string if none.
	 */
	get basePath(): string {
		return this._basePath
	}

	/**
	 * Get the current router state.
	 */
	getState(): RouterState {
		return this.state
	}

	/**
	 * Subscribe to state changes. Returns an unsubscribe function.
	 */
	subscribe(subscriber: RouterSubscriber): () => void {
		this.subscribers.add(subscriber)
		return () => {
			this.subscribers.delete(subscriber)
		}
	}

	/**
	 * Start intercepting navigations.
	 * Call this once when the router is initialized.
	 */
	start(): () => void {
		const handler = (event: import('./types.js').BuzolaNavigateEvent) => {
			if (!event.canIntercept) return

			const url = new URL(event.destination.url)
			const matchUrl = this.createMatchUrl(url)
			const matches = matchRoutes(this.routes, matchUrl)
			if (!matches) return

			const currentNavId = ++this.navigationId
			const useViewTransition = event.viewTransition || this.viewTransitions
			const scrollBehavior = this.pendingScrollBehavior
			this.pendingScrollBehavior = 'after-transition'

			// Abort any in-flight guard from a previous navigation
			if (this.currentAbortController) {
				this.currentAbortController.abort()
			}
			const controller = new AbortController()
			this.currentAbortController = controller

			event.intercept({
				scroll: scrollBehavior,
				handler: async () => {
					// Check blockers before setting pending state
					for (const blocker of this.blockers) {
						if (this.navigationId !== currentNavId) return
						const shouldProceed = await blocker()
						if (!shouldProceed) {
							throw new NavigationAbortedError()
						}
					}

					// Set pending state
					this.setState({
						...this.state,
						isPending: true,
					})

					// Run route guards (outer → inner)
					for (const match of matches) {
						// A newer navigation has started — abandon this one
						if (this.navigationId !== currentNavId) return

						if (match.node.beforeEnter) {
							const result = await match.node.beforeEnter(match, { signal: controller.signal })
							if (result === false) {
								// Guard prevented navigation
								if (this.navigationId === currentNavId) {
									this.setState({
										...this.state,
										isPending: false,
									})
								}
								throw new NavigationAbortedError()
							}
							if (isGuardRedirect(result)) {
								// Guard requested redirect — don't reset isPending, the redirect
								// navigation will take over the pending state.
								if (this.navigationId === currentNavId) {
									const redirectURL = new URL(result.redirect, url)
									const redirectMatches = matchRoutes(this.routes, this.createMatchUrl(redirectURL))
									if (!redirectMatches) {
										throw new Error(`[buzola] Guard redirect target "${result.redirect}" does not match any route.`)
									}
									this.navigate(result.redirect, { replace: true })
								}
								throw new NavigationAbortedError()
							}
						}
					}

					// A newer navigation has started — abandon this one
					if (this.navigationId !== currentNavId) return

					// Perform the DOM update
					const doUpdate = () => {
						this.setState({
							location: url,
							matches,
							isPending: false,
							navigationState: this.adapter.getState(),
						})
					}

					if (useViewTransition && typeof document !== 'undefined' && 'startViewTransition' in document) {
						;(document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(doUpdate)
					} else {
						doUpdate()
					}
				},
			})
		}

		this.adapter.addEventListener('navigate', handler)

		const stop = () => {
			this.adapter.removeEventListener('navigate', handler)
		}
		this.stopFn = stop

		return stop
	}

	/**
	 * Navigate programmatically.
	 * The `to` path should not include the base path — it is prepended automatically.
	 */
	navigate(to: string, options?: NavigateOptions): void {
		if (options?.resetScroll === false) {
			this.pendingScrollBehavior = 'manual'
		}
		this.adapter.navigate(this._basePath + to, options)
	}

	/**
	 * Go back in history.
	 */
	back(): void {
		this.adapter.back()
	}

	/**
	 * Go forward in history.
	 */
	forward(): void {
		this.adapter.forward()
	}

	/**
	 * Build a URL from a path pattern and params.
	 * The returned path includes the base path prefix.
	 */
	buildPath(pattern: string, params?: Record<string, string>): string {
		const segments = pattern.split('/')
		const result: string[] = []
		const missing: string[] = []

		for (const segment of segments) {
			if (segment.startsWith(':')) {
				// Catch-all param (:slug+)
				const isCatchAll = segment.endsWith('+')
				const paramName = isCatchAll ? segment.slice(1, -1) : segment.slice(1)
				const value = params?.[paramName]
				if (value === undefined) {
					missing.push(paramName)
				} else {
					if (isCatchAll) {
						// Catch-all values may contain slashes — insert raw
						result.push(value)
					} else {
						result.push(encodeURIComponent(value))
					}
				}
			} else {
				result.push(segment)
			}
		}

		if (missing.length > 0) {
			if (!params) {
				throw new Error(`Missing params for path "${pattern}": ${missing.join(', ')}`)
			}
			throw new Error(`Missing param "${missing[0]}" for path "${pattern}"`)
		}

		return this._basePath + result.join('/')
	}

	/**
	 * Strip the base path prefix from a pathname.
	 * Returns the pathname relative to the base path.
	 */
	stripBasePath(pathname: string): string {
		if (this._basePath && pathname.startsWith(this._basePath)) {
			return pathname.slice(this._basePath.length) || '/'
		}
		return pathname
	}

	/**
	 * Register a navigation blocker.
	 * The blocker function is called before each navigation.
	 * It must return a Promise that resolves to `true` to allow or `false` to block.
	 * Returns an unsubscribe function.
	 */
	addBlocker(fn: BlockerFn): () => void {
		this.blockers.add(fn)
		return () => {
			this.blockers.delete(fn)
		}
	}

	/**
	 * Dispose the router — clear all subscribers and reset state.
	 */
	dispose(): void {
		this.stopFn?.()
		this.stopFn = undefined
		this.subscribers.clear()
	}

	/**
	 * Update the route tree (for HMR).
	 */
	updateRoutes(routes: RouteNode[]): void {
		this.routes = routes
		// Re-match current URL with new routes
		const matches = matchRoutes(this.routes, this.createMatchUrl(this.state.location)) ?? []
		this.setState({
			...this.state,
			matches,
		})
	}

	/**
	 * Create a URL with basePath stripped for route matching.
	 */
	private createMatchUrl(url: URL): URL {
		if (!this._basePath) return url
		const stripped = new URL(url)
		if (stripped.pathname.startsWith(this._basePath)) {
			stripped.pathname = stripped.pathname.slice(this._basePath.length) || '/'
		}
		return stripped
	}

	private setState(newState: RouterState): void {
		this.state = newState
		for (const subscriber of this.subscribers) {
			subscriber(this.state)
		}
	}
}
