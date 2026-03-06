import { describe, expect, it } from 'bun:test'
import React from 'react'
import { createPage } from '../define/create-page.js'
import type { StandardSchema } from '../engine/types.js'
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
