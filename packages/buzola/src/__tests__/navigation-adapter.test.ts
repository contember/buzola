import './setup-dom.js'

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createBrowserNavigationAdapter } from '../engine/navigation-adapter.js'
import type { BuzolaNavigateEvent } from '../engine/types.js'

/* The Navigation API is not implemented by happy-dom, and the parts of it this
   adapter touches are small enough to stand in for directly. What matters here
   is the shape of `currentEntry`, which is the whole subject of these tests. */
type EntryStub = { url: string | null } | null

function withNavigation(currentEntry: EntryStub) {
	Object.defineProperty(window, 'navigation', {
		value: {
			currentEntry,
			addEventListener() {},
			removeEventListener() {},
			navigate() {},
			back() {},
			forward() {},
		},
		writable: true,
		configurable: true,
	})

	return createBrowserNavigationAdapter()
}

afterEach(() => {
	Reflect.deleteProperty(window, 'navigation')
})

describe('createBrowserNavigationAdapter', () => {
	it('reports the current entry URL', () => {
		const adapter = withNavigation({ url: 'https://example.test/projects/7?tab=logs' })

		expect(adapter.getCurrentURL().href).toBe('https://example.test/projects/7?tab=logs')
	})

	/* The case actually seen in the wild: the getter returns the empty string on a
	   document that is not fully active, which is what Safari handed us. `new
	   URL('')` throws just as `new URL(null)` does, and it throws out of the
	   `Router` constructor during render: a blank page, not a degraded route. An
	   empty string is falsy but not nullish, so this is the case `??` would miss. */
	it('falls back to the document URL when the entry reports an empty URL', () => {
		const adapter = withNavigation({ url: '' })

		expect(adapter.getCurrentURL().href).toBe(window.location.href)
	})

	/* `url` is also typed nullable: the getter returns null for entries whose
	   document is not the current one and was fetched under a `no-referrer` or
	   `origin` referrer policy. That branch needs `sameDocument` to be false, which
	   `currentEntry` never is, so it should not be reachable through this call,
	   but the type permits it and the fallback costs nothing. */
	it('falls back to the document URL when the entry reports no URL', () => {
		const adapter = withNavigation({ url: null })

		expect(adapter.getCurrentURL().href).toBe(window.location.href)
	})

	/* `currentEntry` itself is null while the document is not fully active or is
	   still on the initial about:blank, which is what an iframe reports before its
	   first real navigation. */
	it('falls back to the document URL when there is no current entry', () => {
		const adapter = withNavigation(null)

		expect(adapter.getCurrentURL().href).toBe(window.location.href)
	})
})

describe('createBrowserNavigationAdapter whenCommitted', () => {
	/* A traversal the router does not intercept: the adapter has to spot the moment the browser
	   makes the destination the current entry, among every other entry change. */
	function traverseTo(key: string) {
		const listeners = new Map<string, Set<(event: unknown) => void>>()
		const navigation = {
			currentEntry: { url: 'https://example.test/users', key: 'users' },
			addEventListener(type: string, listener: (event: unknown) => void) {
				if (!listeners.has(type)) listeners.set(type, new Set())
				listeners.get(type)?.add(listener)
			},
			removeEventListener(type: string, listener: (event: unknown) => void) {
				listeners.get(type)?.delete(listener)
			},
		}
		Object.defineProperty(window, 'navigation', { value: navigation, writable: true, configurable: true })
		const fire = (type: string, event: unknown) => {
			for (const listener of [...(listeners.get(type) ?? [])]) listener(event)
		}

		let navigateEvent: BuzolaNavigateEvent | undefined
		createBrowserNavigationAdapter().addEventListener('navigate', event => (navigateEvent = event))
		fire('navigate', {
			destination: { url: 'https://example.test/about', key, getState: () => undefined },
			canIntercept: true,
			navigationType: 'traverse',
			userInitiated: true,
			intercept() {},
		})
		const committed = mock(() => {})
		navigateEvent?.whenCommitted?.(committed)

		return {
			committed,
			/** The browser makes `entryKey` the current entry. */
			change(entryKey: string, navigationType: string | null) {
				if (navigationType !== null) navigation.currentEntry = { url: `https://example.test/${entryKey}`, key: entryKey }
				fire('currententrychange', { navigationType })
			},
			pendingListeners: () => listeners.get('currententrychange')?.size ?? 0,
		}
	}

	it('reports the commit once the destination becomes the current entry', () => {
		const { committed, change, pendingListeners } = traverseTo('about')

		change('about', 'traverse')

		expect(committed).toHaveBeenCalledTimes(1)
		expect(pendingListeners()).toBe(0)
	})

	it('is not fooled by updateCurrentEntry() on the entry being left', () => {
		const { committed, change } = traverseTo('about')

		change('users', null)
		expect(committed).not.toHaveBeenCalled()

		change('about', 'traverse')
		expect(committed).toHaveBeenCalledTimes(1)
	})

	it('never reports a traversal that another navigation replaced, and stops listening', () => {
		const { committed, change, pendingListeners } = traverseTo('about')

		change('settings', 'push')

		expect(committed).not.toHaveBeenCalled()
		expect(pendingListeners()).toBe(0)
	})
})
