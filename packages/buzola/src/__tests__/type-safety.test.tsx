import { describe, expect, it } from 'bun:test'
import React from 'react'
import { createPage } from '../define/create-page.js'
import type { EffectivePageParams, NavigateOptions, RegisteredPage, StandardSchema } from '../engine/types.js'
import type { LinkProps } from '../react/link.js'

// Register pages for type-safe testing
declare module '../engine/types.js' {
	interface BuzolaPageMap {
		'home': {}
		'about': {}
		'users/detail': { userId: string }
		'users/posts': { userId: string; postId: string }
	}
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function mockSchema<T>(): StandardSchema<T> {
	return { '~standard': { version: 1, vendor: 'test', validate: (v) => ({ value: v as T }) } }
}

// ─── createPage().route() type safety ───────────────────────────────────────

describe('createPage route type safety', () => {
	it('allows static route without params', () => {
		const _page = createPage().route('/about').render(() => null)
		expect(true).toBe(true)
	})

	it('rejects dynamic route without params', () => {
		// @ts-expect-error — :id in route but no .params() defined
		const _page = createPage().route('/users/:id').render(() => null)
		expect(true).toBe(true)
	})

	it('allows dynamic route when param is in schema', () => {
		const _page = createPage()
			.params(mockSchema<{ id: string }>())
			.route('/users/:id')
			.render(({ params }) => null)
		expect(true).toBe(true)
	})

	it('rejects dynamic route when param is not in schema', () => {
		const _page = createPage()
			.params(mockSchema<{ userId: string }>())
			// @ts-expect-error — :id is not a key of { userId: string }
			.route('/users/:id')
			.render(({ params }) => null)
		expect(true).toBe(true)
	})

	it('allows multiple route params when all are in schema', () => {
		const _page = createPage()
			.params(mockSchema<{ userId: string; postId: string }>())
			.route('/users/:userId/posts/:postId')
			.render(({ params }) => null)
		expect(true).toBe(true)
	})

	it('rejects when one route param is missing from schema', () => {
		const _page = createPage()
			.params(mockSchema<{ userId: string }>())
			// @ts-expect-error — :postId is not in { userId: string }
			.route('/users/:userId/posts/:postId')
			.render(({ params }) => null)
		expect(true).toBe(true)
	})

	it('allows schema params that are not in route (they become query params)', () => {
		const _page = createPage()
			.params(mockSchema<{ userId: string; tab: string }>())
			.route('/users/:userId')
			.render(({ params }) => null)
		expect(true).toBe(true)
	})
})

// ─── createPage().catch() type safety ────────────────────────────────────────

describe('createPage catch type safety', () => {
	it('.catch() is available before .render()', () => {
		const _page = createPage()
			.catch(({ error }) => <div>{error.message}</div>)
			.render(() => null)
		expect(true).toBe(true)
	})

	it('.catch() is available after .route()', () => {
		const _page = createPage()
			.route('/about')
			.catch(({ error }) => <div>{error.message}</div>)
			.render(() => null)
		expect(true).toBe(true)
	})

	it('no .catch() after .catch()', () => {
		const withCatch = createPage().catch(({ error }) => <div>{error.message}</div>)
		// @ts-expect-error — .catch() should not be available after .catch()
		withCatch.catch
		expect(true).toBe(true)
	})

	it('no .loader() after .catch()', () => {
		const withCatch = createPage().catch(({ error }) => <div>{error.message}</div>)
		// @ts-expect-error — .loader() should not be available after .catch()
		withCatch.loader
		expect(true).toBe(true)
	})

	it('.catch() handler receives typed params', () => {
		const _page = createPage()
			.params(mockSchema<{ userId: string; tab: string }>())
			.catch(({ error, params, retry }) => {
				// params should be typed as { userId: string; tab: string }
				const _userId: string = params.userId
				const _tab: string = params.tab
				return <div>{error.message}</div>
			})
			.render(() => null)
		expect(true).toBe(true)
	})

	it('.catch() handler has empty params when no schema defined', () => {
		const _page = createPage()
			.catch(({ params }) => {
				// @ts-expect-error — no params defined, accessing unknown key
				params.anything
				return null
			})
			.render(() => null)
		expect(true).toBe(true)
	})
})

// ─── LinkProps ──────────────────────────────────────────────────────────────

describe('LinkProps type safety', () => {
	it('static page does not require params', () => {
		const _a: LinkProps<'home'> = { to: 'home' }
		const _b: LinkProps<'about'> = { to: 'about' }
		expect(true).toBe(true)
	})

	it('static page rejects params', () => {
		// @ts-expect-error — static page should not accept params
		const _a: LinkProps<'about'> = { to: 'about', params: { foo: 'bar' } }
		expect(true).toBe(true)
	})

	it('dynamic page requires params', () => {
		const _a: LinkProps<'users/detail'> = { to: 'users/detail', params: { userId: '1' } }

		// @ts-expect-error — missing required params
		const _b: LinkProps<'users/detail'> = { to: 'users/detail' }
		expect(true).toBe(true)
	})

	it('dynamic page requires correct param names', () => {
		// @ts-expect-error — wrong param name
		const _a: LinkProps<'users/detail'> = { to: 'users/detail', params: { id: '1' } }
		expect(true).toBe(true)
	})

	it('multi-param page requires all params', () => {
		const _a: LinkProps<'users/posts'> = {
			to: 'users/posts',
			params: { userId: '1', postId: '2' },
		}

		const _b: LinkProps<'users/posts'> = {
			to: 'users/posts',
			// @ts-expect-error — missing postId
			params: { userId: '1' },
		}
		expect(true).toBe(true)
	})

	it('rejects unregistered pages', () => {
		// @ts-expect-error — page not in BuzolaPageMap
		const _a: LinkProps<'unknown'> = { to: 'unknown' }
		expect(true).toBe(true)
	})
})

// ─── Link JSX usage (generic inference) ─────────────────────────────────────

import { Link } from '../react/link.js'

describe('Link JSX generic inference', () => {
	it('accepts static page without params', () => {
		const _el = <Link to="home">Home</Link>
		const _el2 = <Link to="about">About</Link>
		expect(true).toBe(true)
	})

	it('rejects params on static page', () => {
		// @ts-expect-error — static page should not accept params
		const _el = <Link to="about" params={{ foo: 'bar' }}>About</Link>
		expect(true).toBe(true)
	})

	it('requires params on dynamic page', () => {
		const _el = <Link to="users/detail" params={{ userId: '1' }}>User</Link>

		// @ts-expect-error — missing required params
		const _el2 = <Link to="users/detail">User</Link>
		expect(true).toBe(true)
	})

	it('rejects wrong param names', () => {
		// @ts-expect-error — wrong param name
		const _el = <Link to="users/detail" params={{ id: '1' }}>User</Link>
		expect(true).toBe(true)
	})

	it('requires all params for multi-param page', () => {
		const _ok = <Link to="users/posts" params={{ userId: '1', postId: '2' }}>Post</Link>

		// @ts-expect-error — missing postId
		const _bad = <Link to="users/posts" params={{ userId: '1' }}>Post</Link>
		expect(true).toBe(true)
	})

	it('rejects unregistered pages', () => {
		// @ts-expect-error — page not in BuzolaPageMap
		const _el = <Link to="nope">Nope</Link>
		expect(true).toBe(true)
	})
})

// ─── NavigateFn type safety ─────────────────────────────────────────────────

/**
 * Replicate the NavigateFn type from hooks.ts for testing without React hooks.
 */
type NavigateFn = <P extends RegisteredPage>(
	to: P,
	...args: [keyof EffectivePageParams<P>] extends [never] ? [options?: NavigateOptions]
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		: {} extends EffectivePageParams<P> ? [options?: NavigateOptions & { params?: EffectivePageParams<P> }]
		: [options: NavigateOptions & { params: EffectivePageParams<P> }]
) => void

describe('NavigateFn type safety', () => {
	const noop = (() => {}) as NavigateFn

	it('static page does not require options', () => {
		noop('home')
		noop('about')
		expect(true).toBe(true)
	})

	it('static page accepts NavigateOptions without params', () => {
		noop('home', { replace: true })
		expect(true).toBe(true)
	})

	it('static page rejects params', () => {
		// @ts-expect-error — static page should not accept params
		noop('home', { params: { foo: 'bar' } })
		expect(true).toBe(true)
	})

	it('dynamic page requires options with params', () => {
		noop('users/detail', { params: { userId: '1' } })

		// @ts-expect-error — missing required options with params
		noop('users/detail')
		expect(true).toBe(true)
	})

	it('dynamic page requires correct param names', () => {
		// @ts-expect-error — wrong param name (id instead of userId)
		noop('users/detail', { params: { id: '1' } })
		expect(true).toBe(true)
	})

	it('dynamic page rejects params passed directly as options (without params wrapper)', () => {
		// @ts-expect-error — { userId: '1' } is not valid, must be { params: { userId: '1' } }
		noop('users/detail', { userId: '1' })
		expect(true).toBe(true)
	})

	it('multi-param page requires all params', () => {
		noop('users/posts', { params: { userId: '1', postId: '2' } })

		// @ts-expect-error — missing postId
		noop('users/posts', { params: { userId: '1' } })
		expect(true).toBe(true)
	})

	it('rejects unregistered pages', () => {
		// @ts-expect-error — page not in BuzolaPageMap
		noop('unknown')
		expect(true).toBe(true)
	})

	it('allows NavigateOptions alongside params', () => {
		noop('users/detail', { params: { userId: '1' }, replace: true })
		expect(true).toBe(true)
	})
})
