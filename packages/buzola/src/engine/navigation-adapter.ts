import type { BuzolaNavigateEvent, NavigateOptions, NavigationAdapter } from './types.js'

// ─── Browser adapter ────────────────────────────────────────────────────────

/**
 * Create a NavigationAdapter that delegates to the browser's Navigation API.
 */
export function createBrowserNavigationAdapter(): NavigationAdapter {
	const nav = (window as { navigation?: Navigation }).navigation
	if (!nav) {
		throw new Error(
			'Navigation API is not available. Buzola requires a browser that supports the Navigation API.',
		)
	}

	const listeners = new Set<(event: BuzolaNavigateEvent) => void>()
	let pendingViewTransition = false

	const nativeHandler = (event: NavigateEvent) => {
		const viewTransition = pendingViewTransition
		pendingViewTransition = false

		const buzolaEvent: BuzolaNavigateEvent = {
			destination: { url: event.destination.url },
			canIntercept: event.canIntercept,
			navigationType: event.navigationType as BuzolaNavigateEvent['navigationType'],
			userInitiated: event.userInitiated,
			viewTransition,
			intercept(options) {
				event.intercept({
					handler: options.handler,
					scroll: options.scroll,
					focusReset: options.focusReset,
				})
			},
		}

		for (const listener of listeners) {
			listener(buzolaEvent)
		}
	}

	return {
		getCurrentURL() {
			// `currentEntry` is null on a document that is not fully active or still on
			// the initial about:blank; Safari reports an empty `url` in that situation
			// instead. `||` catches both, and `location.href` is the URL the entry would
			// have reported. This runs in the Router constructor, so a throw is a blank
			// page rather than a degraded route.
			return new URL(nav.currentEntry?.url || window.location.href)
		},
		navigate(url, options) {
			if (options?.viewTransition) {
				pendingViewTransition = true
			}
			nav.navigate(url, {
				history: options?.replace ? 'replace' : 'push',
				state: options?.state,
			})
		},
		leaveApp(url) {
			// Deliberately NOT nav.navigate(): this is the one navigation the router hands to the
			// browser, so it must go through the plain Location API and stay cross-document.
			window.location.assign(url)
		},
		back() {
			nav.back()
		},
		forward() {
			nav.forward()
		},
		addEventListener(_type, handler) {
			// Lazily register the native handler when the first listener is added
			const wasEmpty = listeners.size === 0
			listeners.add(handler)
			if (wasEmpty) {
				nav.addEventListener('navigate', nativeHandler)
			}
		},
		removeEventListener(_type, handler) {
			listeners.delete(handler)
			// Clean up the native handler when all listeners are removed
			if (listeners.size === 0) {
				nav.removeEventListener('navigate', nativeHandler)
			}
		},
		getState() {
			return nav.currentEntry?.getState?.()
		},
	}
}

// ─── Memory adapter (for testing) ───────────────────────────────────────────

export interface MemoryNavigationAdapterOptions {
	initialURL?: string
}

interface MemoryEntry {
	url: string
	state?: unknown
}

/**
 * Create an in-memory NavigationAdapter for testing.
 */
/** The memory adapter plus the record a test needs to see what was handed to the browser. */
export interface MemoryNavigationAdapter extends NavigationAdapter {
	/** URLs passed to `leaveApp`, in order. */
	leftApp(): readonly string[]
}

export function createMemoryNavigationAdapter(
	options: MemoryNavigationAdapterOptions = {},
): MemoryNavigationAdapter {
	const { initialURL = 'http://localhost/' } = options

	const entries: MemoryEntry[] = [{ url: initialURL }]
	let currentIndex = 0
	const listeners = new Set<(event: BuzolaNavigateEvent) => void>()
	const left: string[] = []

	function emitNavigateEvent(
		url: string,
		navigationType: BuzolaNavigateEvent['navigationType'],
		commitNavigation: () => void,
		viewTransition?: boolean,
	): void {
		let intercepted = false
		let interceptHandler: (() => Promise<void>) | undefined

		const event: BuzolaNavigateEvent = {
			destination: { url },
			canIntercept: true,
			navigationType,
			userInitiated: false,
			viewTransition,
			intercept(options) {
				intercepted = true
				interceptHandler = options.handler
			},
		}

		for (const listener of listeners) {
			listener(event)
		}

		if (intercepted && interceptHandler) {
			// Run the handler and only commit navigation state on success.
			void interceptHandler().then(
				() => {
					commitNavigation()
				},
				(error) => {
					// Guard aborts are expected — rethrow unexpected errors
					if (error instanceof Error && error.name === 'NavigationAbortedError') return
					throw error
				},
			)
		} else {
			// No interception — commit immediately
			commitNavigation()
		}
	}

	return {
		getCurrentURL() {
			return new URL(entries[currentIndex].url)
		},
		leaveApp(url) {
			// A real browser would replace the document here. The memory adapter cannot, so it records
			// the destination and still raises the event, which is what lets a test assert that the
			// router declined to intercept it.
			const resolved = new URL(url, entries[currentIndex].url).href
			left.push(resolved)
			emitNavigateEvent(resolved, 'push', () => {})
		},
		navigate(url, options) {
			const resolved = new URL(url, entries[currentIndex].url).href
			const type = options?.replace ? 'replace' : 'push'

			emitNavigateEvent(resolved, type, () => {
				if (options?.replace) {
					entries[currentIndex] = { url: resolved, state: options.state }
				} else {
					// Remove any forward entries
					entries.length = currentIndex + 1
					entries.push({ url: resolved, state: options?.state })
					currentIndex++
				}
			}, options?.viewTransition)
		},
		back() {
			if (currentIndex > 0) {
				emitNavigateEvent(entries[currentIndex - 1].url, 'traverse', () => {
					currentIndex--
				})
			}
		},
		forward() {
			if (currentIndex < entries.length - 1) {
				emitNavigateEvent(entries[currentIndex + 1].url, 'traverse', () => {
					currentIndex++
				})
			}
		},
		addEventListener(_type, handler) {
			listeners.add(handler)
		},
		removeEventListener(_type, handler) {
			listeners.delete(handler)
		},
		getState() {
			return entries[currentIndex].state
		},
		leftApp() {
			return left
		},
	}
}
