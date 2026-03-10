/**
 * Global LRU cache for page loader data.
 * Shared across all page components to limit total memory usage.
 * Uses Map insertion order for LRU eviction — oldest entries are evicted first.
 */
export class LoaderCache {
	private cache = new Map<string, unknown>()
	private _maxSize: number

	constructor(maxSize: number) {
		if (maxSize < 0) {
			throw new Error(`[buzola] LoaderCache maxSize must be non-negative, got ${maxSize}`)
		}
		this._maxSize = maxSize
	}

	get maxSize(): number {
		return this._maxSize
	}

	get size(): number {
		return this.cache.size
	}

	get(key: string): unknown {
		const value = this.cache.get(key)
		if (value !== undefined || this.cache.has(key)) {
			// Move to end (most recently used)
			this.cache.delete(key)
			this.cache.set(key, value)
		}
		return value
	}

	has(key: string): boolean {
		return this.cache.has(key)
	}

	set(key: string, value: unknown): void {
		this.cache.delete(key)
		this.cache.set(key, value)
		while (this.cache.size > this._maxSize) {
			const first = this.cache.keys().next().value!
			this.cache.delete(first)
		}
	}

	delete(key: string): void {
		this.cache.delete(key)
	}

	clear(): void {
		this.cache.clear()
	}
}
