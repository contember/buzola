import type { LoaderCache } from './loader-cache.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export type LoaderInstruction =
	| { action: 'render'; data: unknown; isLoading: boolean }
	| { action: 'suspend'; promise: Promise<unknown> }

export interface LoaderResolveContext {
	/** Current URL href — used for stale cache keying */
	currentUrlHref: string
	/** Cache key that changes on URL change or invalidation */
	cacheKey: string
	/** Factory that starts the actual data fetch */
	load: () => Promise<unknown>
	/** Global loader cache for cross-navigation stale data */
	loaderCache: LoaderCache | undefined
	/**
	 * Called when a background (SWR) fetch settles.
	 * Caller is responsible for calling commitBackgroundResult/commitBackgroundError
	 * and triggering a React re-render.
	 */
	onBackgroundSettled: (outcome: { ok: true; result: unknown } | { ok: false }) => void
}

// ─── State machine ──────────────────────────────────────────────────────────

let nextId = 0

/**
 * Manages loader data lifecycle outside of React's render cycle.
 *
 * This state survives React Suspense retries — when use() suspends, React
 * discards uncommitted hook state (useRef, useState, useMemo). Closure/instance
 * state is preserved, preventing infinite suspend loops from promise recreation.
 *
 * Supports stale-while-revalidate: when the cache key changes but stale data
 * exists, returns stale data immediately and starts a background fetch.
 */
export class PageLoaderState {
	private activeUrlHref: string | null = null
	private activeCacheKey: string | null = null
	private activePromise: Promise<unknown> | null = null
	private activeResolvedData: unknown
	private hasResolved = false
	private pendingBackgroundKey: string | null = null
	private readonly id: number

	constructor() {
		this.id = nextId++
	}

	/**
	 * Determine what the component should do during render.
	 * Returns either resolved data to render, or a promise to suspend on.
	 */
	resolve(ctx: LoaderResolveContext): LoaderInstruction {
		const { currentUrlHref, cacheKey, load, loaderCache, onBackgroundSettled } = ctx

		this.handleUrlChange(currentUrlHref, loaderCache)

		// ─── Same cache key — return current state ─────
		if (this.activeCacheKey === cacheKey) {
			if (this.pendingBackgroundKey === cacheKey) {
				return { action: 'render', data: this.activeResolvedData, isLoading: true }
			}
			if (this.hasResolved) {
				return { action: 'render', data: this.activeResolvedData, isLoading: false }
			}
			return { action: 'suspend', promise: this.activePromise! }
		}

		// ─── Cache key changed + stale data available → SWR ─────
		if (this.hasResolved) {
			const promise = load()
			this.activeCacheKey = cacheKey
			this.activePromise = promise
			this.pendingBackgroundKey = cacheKey

			promise.then(
				(result) => {
					if (this.activeCacheKey === cacheKey) {
						onBackgroundSettled({ ok: true, result })
					}
				},
				() => {
					if (this.activeCacheKey === cacheKey) {
						onBackgroundSettled({ ok: false })
					}
				},
			)

			return { action: 'render', data: this.activeResolvedData, isLoading: true }
		}

		// ─── No stale data → first load, suspend ─────
		const promise = load()
		this.activeCacheKey = cacheKey
		this.activePromise = promise
		return { action: 'suspend', promise }
	}

	/** Commit data after use() resolves (suspend case) */
	commitResult(data: unknown): void {
		this.activeResolvedData = data
		this.hasResolved = true
	}

	/** Commit background SWR success — update data and clear pending flag */
	commitBackgroundResult(data: unknown): void {
		this.activeResolvedData = data
		this.pendingBackgroundKey = null
	}

	/** Mark background load as failed — next render will suspend with rejected promise */
	commitBackgroundError(): void {
		this.hasResolved = false
		this.pendingBackgroundKey = null
	}

	/** Save state to stale cache and reset (called on unmount) */
	dispose(loaderCache: LoaderCache | undefined): void {
		if (loaderCache && this.hasResolved && this.activeResolvedData !== undefined && this.activeUrlHref) {
			this.saveToStaleCache(loaderCache, this.activeUrlHref, this.activeResolvedData)
		}
		this.activeUrlHref = null
		this.activeCacheKey = null
		this.activePromise = null
		this.activeResolvedData = undefined
		this.hasResolved = false
		this.pendingBackgroundKey = null
	}

	// ─── Private ────────────────────────────────────────────────────────────

	private handleUrlChange(currentUrlHref: string, loaderCache: LoaderCache | undefined): void {
		if (this.activeUrlHref !== null && this.activeUrlHref !== currentUrlHref) {
			// URL changed — save old data to stale cache
			if (loaderCache && this.hasResolved && this.activeResolvedData !== undefined) {
				this.saveToStaleCache(loaderCache, this.activeUrlHref, this.activeResolvedData)
			}
			// Try to restore from stale cache for new URL
			const cached = loaderCache && this.restoreFromStaleCache(loaderCache, currentUrlHref)
			if (cached?.hit) {
				this.activeResolvedData = cached.value
				this.hasResolved = true
			} else {
				this.hasResolved = false
				this.activeResolvedData = undefined
			}
			this.pendingBackgroundKey = null
		} else if (this.activeUrlHref === null && loaderCache) {
			// Remount — try to restore from stale cache
			const cached = this.restoreFromStaleCache(loaderCache, currentUrlHref)
			if (cached.hit) {
				this.activeResolvedData = cached.value
				this.hasResolved = true
			}
		}
		this.activeUrlHref = currentUrlHref
	}

	private staleCacheKey(urlHref: string): string {
		return `${this.id}:${urlHref}`
	}

	private restoreFromStaleCache(cache: LoaderCache, urlHref: string): { hit: true; value: unknown } | { hit: false } {
		const key = this.staleCacheKey(urlHref)
		if (!cache.has(key)) return { hit: false }
		const value = cache.get(key)
		cache.delete(key)
		return { hit: true, value }
	}

	private saveToStaleCache(cache: LoaderCache, urlHref: string, value: unknown): void {
		cache.set(this.staleCacheKey(urlHref), value)
	}
}
