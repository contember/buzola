// Type declarations for Navigation API
// These are Baseline Newly Available (Jan 2026) but not yet in TypeScript's lib.

interface NavigationDestination {
	url: string
	key: string
	id: string
	index: number
	sameDocument: boolean
	getState(): unknown
}

interface NavigationHistoryEntry {
	url: string | null
	key: string
	id: string
	index: number
	sameDocument: boolean
	getState(): unknown
}

interface NavigateEvent extends Event {
	navigationType: 'push' | 'replace' | 'reload' | 'traverse'
	destination: NavigationDestination
	canIntercept: boolean
	userInitiated: boolean
	hashChange: boolean
	signal: AbortSignal
	formData: FormData | null
	downloadRequest: string | null
	info: unknown
	intercept(options?: {
		handler?: () => Promise<void>
		focusReset?: 'after-transition' | 'manual'
		scroll?: 'after-transition' | 'manual'
	}): void
	scroll(): void
}

interface NavigationNavigateOptions {
	state?: unknown
	info?: unknown
	history?: 'auto' | 'push' | 'replace'
}

interface NavigationResult {
	committed: Promise<NavigationHistoryEntry>
	finished: Promise<NavigationHistoryEntry>
}

interface Navigation extends EventTarget {
	entries(): NavigationHistoryEntry[]
	readonly currentEntry: NavigationHistoryEntry | null
	readonly transition: NavigationTransition | null
	readonly canGoBack: boolean
	readonly canGoForward: boolean
	navigate(url: string, options?: NavigationNavigateOptions): NavigationResult
	reload(options?: { state?: unknown; info?: unknown }): NavigationResult
	traverseTo(key: string, options?: { info?: unknown }): NavigationResult
	back(options?: { info?: unknown }): NavigationResult
	forward(options?: { info?: unknown }): NavigationResult
	addEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void
	addEventListener(type: string, listener: EventListener): void
	removeEventListener(type: 'navigate', listener: (event: NavigateEvent) => void): void
	removeEventListener(type: string, listener: EventListener): void
}

interface NavigationTransition {
	navigationType: 'push' | 'replace' | 'reload' | 'traverse'
	from: NavigationHistoryEntry
	finished: Promise<void>
}

interface Window {
	navigation: Navigation
}
