import { describe, expect, it } from 'bun:test'
import { LoaderCache } from '../engine/loader-cache.js'

describe('LoaderCache', () => {
	it('stores and retrieves values', () => {
		const cache = new LoaderCache(10)
		cache.set('a', 1)
		expect(cache.get('a')).toBe(1)
	})

	it('returns undefined for missing keys', () => {
		const cache = new LoaderCache(10)
		expect(cache.get('missing')).toBeUndefined()
	})

	it('has() returns true for existing keys', () => {
		const cache = new LoaderCache(10)
		cache.set('a', 1)
		expect(cache.has('a')).toBe(true)
		expect(cache.has('b')).toBe(false)
	})

	it('delete() removes entries', () => {
		const cache = new LoaderCache(10)
		cache.set('a', 1)
		cache.delete('a')
		expect(cache.has('a')).toBe(false)
		expect(cache.size).toBe(0)
	})

	it('tracks size correctly', () => {
		const cache = new LoaderCache(10)
		expect(cache.size).toBe(0)
		cache.set('a', 1)
		cache.set('b', 2)
		expect(cache.size).toBe(2)
		cache.delete('a')
		expect(cache.size).toBe(1)
	})

	it('clear() removes all entries', () => {
		const cache = new LoaderCache(10)
		cache.set('a', 1)
		cache.set('b', 2)
		cache.clear()
		expect(cache.size).toBe(0)
		expect(cache.has('a')).toBe(false)
	})

	// ─── LRU eviction ────────────────────────────────────────────────────────

	it('evicts oldest entry when exceeding maxSize', () => {
		const cache = new LoaderCache(2)
		cache.set('a', 1)
		cache.set('b', 2)
		cache.set('c', 3)

		expect(cache.has('a')).toBe(false)
		expect(cache.get('b')).toBe(2)
		expect(cache.get('c')).toBe(3)
		expect(cache.size).toBe(2)
	})

	it('evicts multiple entries when needed', () => {
		const cache = new LoaderCache(1)
		cache.set('a', 1)
		cache.set('b', 2)

		expect(cache.has('a')).toBe(false)
		expect(cache.get('b')).toBe(2)
		expect(cache.size).toBe(1)
	})

	it('get() refreshes LRU order', () => {
		const cache = new LoaderCache(2)
		cache.set('a', 1)
		cache.set('b', 2)

		// Access 'a' to move it to most recent
		cache.get('a')

		// Now 'b' is the oldest, should be evicted
		cache.set('c', 3)
		expect(cache.has('b')).toBe(false)
		expect(cache.get('a')).toBe(1)
		expect(cache.get('c')).toBe(3)
	})

	it('set() on existing key updates value and refreshes LRU order', () => {
		const cache = new LoaderCache(2)
		cache.set('a', 1)
		cache.set('b', 2)

		// Update 'a' — should move to most recent
		cache.set('a', 10)

		// Now 'b' is the oldest
		cache.set('c', 3)
		expect(cache.has('b')).toBe(false)
		expect(cache.get('a')).toBe(10)
		expect(cache.get('c')).toBe(3)
	})

	it('maxSize of 0 keeps no entries', () => {
		const cache = new LoaderCache(0)
		cache.set('a', 1)
		expect(cache.size).toBe(0)
		expect(cache.has('a')).toBe(false)
	})

	it('exposes maxSize', () => {
		const cache = new LoaderCache(5)
		expect(cache.maxSize).toBe(5)
	})
})
