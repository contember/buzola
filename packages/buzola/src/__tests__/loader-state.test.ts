import { describe, expect, it, mock } from 'bun:test'
import { LoaderCache } from '../engine/loader-cache.js'
import { PageLoaderState } from '../engine/loader-state.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createState() {
	return new PageLoaderState()
}

function resolveCtx(
	state: PageLoaderState,
	overrides: {
		url?: string
		cacheKey?: string
		load?: () => Promise<unknown>
		loaderCache?: LoaderCache
		onBackgroundSettled?: (outcome: { ok: true; result: unknown } | { ok: false }) => void
	} = {},
) {
	return state.resolve({
		currentUrlHref: overrides.url ?? 'http://localhost/',
		cacheKey: overrides.cacheKey ?? 'http://localhost/:0',
		load: overrides.load ?? (() => Promise.resolve({ value: 1 })),
		loaderCache: overrides.loaderCache,
		onBackgroundSettled: overrides.onBackgroundSettled ?? (() => {}),
	})
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PageLoaderState', () => {
	describe('first load', () => {
		it('returns suspend instruction with promise', () => {
			const state = createState()
			const promise = Promise.resolve({ name: 'Alice' })
			const instruction = resolveCtx(state, { load: () => promise })

			expect(instruction.action).toBe('suspend')
			if (instruction.action === 'suspend') {
				expect(instruction.promise).toBe(promise)
			}
		})

		it('subsequent resolve with same cacheKey returns same promise (no re-creation)', () => {
			const state = createState()
			let callCount = 0
			const load = () => {
				callCount++
				return Promise.resolve({ n: callCount })
			}

			const first = resolveCtx(state, { load })
			const second = resolveCtx(state, { load })

			expect(callCount).toBe(1)
			expect(first.action).toBe('suspend')
			expect(second.action).toBe('suspend')
			if (first.action === 'suspend' && second.action === 'suspend') {
				expect(first.promise).toBe(second.promise)
			}
		})
	})

	describe('after commit', () => {
		it('returns render instruction with data after commitResult', () => {
			const state = createState()
			resolveCtx(state, { load: () => Promise.resolve('data') })
			state.commitResult('resolved-data')

			const instruction = resolveCtx(state)
			expect(instruction).toEqual({ action: 'render', data: 'resolved-data', isLoading: false })
		})
	})

	describe('invalidation (cache key change)', () => {
		it('with stale data — returns stale data with isLoading and starts background fetch', () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale-data')

			let bgLoad: (() => Promise<unknown>) | undefined
			const instruction = resolveCtx(state, {
				cacheKey: 'k:1',
				load: () => {
					const p = Promise.resolve('fresh-data')
					bgLoad = () => p
					return p
				},
			})

			expect(instruction).toEqual({ action: 'render', data: 'stale-data', isLoading: true })
			expect(bgLoad).toBeDefined()
		})

		it('without stale data — returns suspend instruction', () => {
			const state = createState()
			const promise = Promise.resolve('data')
			const instruction = resolveCtx(state, { cacheKey: 'k:0', load: () => promise })

			// No commitResult called — no stale data
			const second = resolveCtx(state, { cacheKey: 'k:1', load: () => Promise.resolve('new') })
			expect(second.action).toBe('suspend')
		})
	})

	describe('SWR background callbacks', () => {
		it('calls onBackgroundSettled with ok:true on success', async () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale')

			const settled = mock(() => {})
			resolveCtx(state, {
				cacheKey: 'k:1',
				load: () => Promise.resolve('fresh'),
				onBackgroundSettled: settled,
			})

			await Promise.resolve() // flush microtask
			expect(settled).toHaveBeenCalledWith({ ok: true, result: 'fresh' })
		})

		it('calls onBackgroundSettled with ok:false on error', async () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale')

			const settled = mock(() => {})
			resolveCtx(state, {
				cacheKey: 'k:1',
				load: () => Promise.reject(new Error('fail')),
				onBackgroundSettled: settled,
			})

			await Promise.resolve() // flush microtask
			expect(settled).toHaveBeenCalledWith({ ok: false })
		})

		it('does not call onBackgroundSettled if cacheKey changed (stale callback)', async () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale')

			const settled1 = mock(() => {})
			resolveCtx(state, {
				cacheKey: 'k:1',
				load: () => new Promise(r => setTimeout(() => r('slow'), 50)),
				onBackgroundSettled: settled1,
			})

			// Immediately invalidate again — supersedes the first background fetch
			state.commitBackgroundResult('stale') // commit so hasResolved stays true
			const settled2 = mock(() => {})
			resolveCtx(state, {
				cacheKey: 'k:2',
				load: () => Promise.resolve('fast'),
				onBackgroundSettled: settled2,
			})

			await new Promise(r => setTimeout(r, 100))
			expect(settled1).not.toHaveBeenCalled() // superseded
			expect(settled2).toHaveBeenCalledWith({ ok: true, result: 'fast' })
		})

		it('after commitBackgroundResult, returns fresh data without isLoading', () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale')

			resolveCtx(state, { cacheKey: 'k:1' })
			state.commitBackgroundResult('fresh')

			const instruction = resolveCtx(state, { cacheKey: 'k:1' })
			expect(instruction).toEqual({ action: 'render', data: 'fresh', isLoading: false })
		})

		it('after commitBackgroundError, returns suspend with rejected promise', async () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('stale')

			const error = new Error('load failed')
			const rejectedPromise = Promise.reject(error)
			rejectedPromise.catch(() => {}) // prevent unhandled rejection

			resolveCtx(state, { cacheKey: 'k:1', load: () => rejectedPromise })
			state.commitBackgroundError()

			const instruction = resolveCtx(state, { cacheKey: 'k:1' })
			expect(instruction.action).toBe('suspend')
		})
	})

	describe('URL change with stale cache', () => {
		it('saves data to stale cache on URL change', () => {
			const cache = new LoaderCache(10)
			const state = createState()

			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })
			state.commitResult('data-a')

			// Navigate to B — should save A's data to cache
			resolveCtx(state, { url: 'http://localhost/b', cacheKey: 'b:0', loaderCache: cache })

			expect(cache.size).toBe(1)
		})

		it('restores from stale cache on URL change', () => {
			const cache = new LoaderCache(10)
			const state = createState()

			// Load A
			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })
			state.commitResult('data-a')

			// Navigate to B (saves A to cache)
			resolveCtx(state, { url: 'http://localhost/b', cacheKey: 'b:0', loaderCache: cache })
			state.commitResult('data-b')

			// Navigate back to A — should restore from cache
			const instruction = resolveCtx(state, {
				url: 'http://localhost/a',
				cacheKey: 'a:0',
				loaderCache: cache,
			})

			// Has stale data from cache, new cacheKey triggers SWR
			expect(instruction.action).toBe('render')
			if (instruction.action === 'render') {
				expect(instruction.data).toBe('data-a')
				expect(instruction.isLoading).toBe(true) // SWR — stale data + background reload
			}
		})

		it('returns suspend when no stale cache available on URL change', () => {
			const cache = new LoaderCache(10)
			const state = createState()

			// Load A without committing (no stale data to cache)
			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })

			// Navigate to B — no cache for B
			const instruction = resolveCtx(state, {
				url: 'http://localhost/b',
				cacheKey: 'b:0',
				loaderCache: cache,
			})

			expect(instruction.action).toBe('suspend')
		})
	})

	describe('remount with stale cache', () => {
		it('restores from stale cache on remount', () => {
			const cache = new LoaderCache(10)
			const state1 = createState()

			// First mount — load and dispose
			resolveCtx(state1, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })
			state1.commitResult('cached-data')
			state1.dispose(cache) // saves to cache

			// New state (simulating remount)
			// Note: new state has different ID, so cache key won't match.
			// In practice, same page instance reuses the same PageLoaderState.
			// But we can simulate by using the same state after dispose.
			const state2 = state1 // reuse same instance for same cache namespace
			const instruction = resolveCtx(state2, {
				url: 'http://localhost/a',
				cacheKey: 'a:0',
				loaderCache: cache,
			})

			// Restored from cache → has stale data → SWR
			expect(instruction.action).toBe('render')
			if (instruction.action === 'render') {
				expect(instruction.data).toBe('cached-data')
				expect(instruction.isLoading).toBe(true)
			}
		})
	})

	describe('dispose', () => {
		it('saves resolved data to stale cache', () => {
			const cache = new LoaderCache(10)
			const state = createState()

			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })
			state.commitResult('save-me')
			state.dispose(cache)

			expect(cache.size).toBe(1)
		})

		it('resets all internal state', () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('data')
			state.dispose(undefined)

			// After dispose, first resolve should be a fresh suspend
			const instruction = resolveCtx(state, { cacheKey: 'k:0' })
			expect(instruction.action).toBe('suspend')
		})

		it('does not save to cache if no data was resolved', () => {
			const cache = new LoaderCache(10)
			const state = createState()

			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0', loaderCache: cache })
			// No commitResult
			state.dispose(cache)

			expect(cache.size).toBe(0)
		})

		it('does not save to cache if loaderCache is undefined', () => {
			const state = createState()
			resolveCtx(state, { cacheKey: 'k:0' })
			state.commitResult('data')
			// Should not throw
			state.dispose(undefined)
		})
	})

	describe('no loader cache', () => {
		it('works without loaderCache — no stale caching', () => {
			const state = createState()

			resolveCtx(state, { url: 'http://localhost/a', cacheKey: 'a:0' })
			state.commitResult('data-a')

			// URL change without cache — no restore
			const instruction = resolveCtx(state, { url: 'http://localhost/b', cacheKey: 'b:0' })
			expect(instruction.action).toBe('suspend')
		})
	})
})
