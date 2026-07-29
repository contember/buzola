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
			return new URL(nav.currentEntry!.url!)
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
export function createMemoryNavigationAdapter(
	options: MemoryNavigationAdapterOptions = {},
): NavigationAdapter {
	const { initialURL = 'http://localhost/' } = options

	const entries: MemoryEntry[] = [{ url: initialURL }]
	let currentIndex = 0
	const listeners = new Set<(event: BuzolaNavigateEvent) => void>()

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
	}
}
