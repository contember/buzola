import { describe, expect, it } from 'bun:test'
import React from 'react'
import type { ParamsForPath } from '../engine/types.js'
import type { LinkProps } from '../react/link.js'

// Register routes for type-safe testing
declare module '../engine/types.js' {
	interface BuzolaRouteMap {
		'/': {}
		'/about': {}
		'/users/:userId': { userId: string }
		'/users/:userId/posts/:postId': { userId: string; postId: string }
	}
}

// ─── ParamsForPath ──────────────────────────────────────────────────────────

describe('ParamsForPath', () => {
	it('static path has no params', () => {
		type Result = ParamsForPath<'/about'>
		const params: Result = {}
		expect(true).toBe(true)
	})

	it('single param is extracted', () => {
		type Result = ParamsForPath<'/users/:userId'>
		const params: Result = { userId: '1' }
		// @ts-expect-error — missing required param
		const missing: Result = {}
		// @ts-expect-error — wrong param name
		const wrong: Result = { id: '1' }
		expect(params.userId).toBe('1')
	})

	it('multiple params are extracted', () => {
		type Result = ParamsForPath<'/users/:userId/posts/:postId'>
		const params: Result = { userId: '1', postId: '2' }
		// @ts-expect-error — missing postId
		const partial: Result = { userId: '1' }
		expect(params.postId).toBe('2')
	})

	it('root path has no params', () => {
		type Result = ParamsForPath<'/'>
		const params: Result = {}
		expect(true).toBe(true)
	})
})

// ─── LinkProps ──────────────────────────────────────────────────────────────

describe('LinkProps type safety', () => {
	it('static path does not require params', () => {
		const _a: LinkProps<'/'> = { to: '/' }
		const _b: LinkProps<'/about'> = { to: '/about' }
		expect(true).toBe(true)
	})

	it('static path rejects params', () => {
		// @ts-expect-error — static path should not accept params
		const _a: LinkProps<'/about'> = { to: '/about', params: { foo: 'bar' } }
		expect(true).toBe(true)
	})

	it('dynamic path requires params', () => {
		const _a: LinkProps<'/users/:userId'> = { to: '/users/:userId', params: { userId: '1' } }

		// @ts-expect-error — missing required params
		const _b: LinkProps<'/users/:userId'> = { to: '/users/:userId' }
		expect(true).toBe(true)
	})

	it('dynamic path requires correct param names', () => {
		// @ts-expect-error — wrong param name
		const _a: LinkProps<'/users/:userId'> = { to: '/users/:userId', params: { id: '1' } }
		expect(true).toBe(true)
	})

	it('multi-param path requires all params', () => {
		const _a: LinkProps<'/users/:userId/posts/:postId'> = {
			to: '/users/:userId/posts/:postId',
			params: { userId: '1', postId: '2' },
		}

		const _b: LinkProps<'/users/:userId/posts/:postId'> = {
			to: '/users/:userId/posts/:postId',
			// @ts-expect-error — missing postId
			params: { userId: '1' },
		}
		expect(true).toBe(true)
	})

	it('rejects unregistered paths', () => {
		// @ts-expect-error — path not in BuzolaRouteMap
		const _a: LinkProps<'/unknown'> = { to: '/unknown' }
		expect(true).toBe(true)
	})
})

// ─── Link JSX usage (generic inference) ─────────────────────────────────────

import { Link } from '../react/link.js'

describe('Link JSX generic inference', () => {
	it('accepts static path without params', () => {
		const _el = <Link to="/">Home</Link>
		const _el2 = <Link to="/about">About</Link>
		expect(true).toBe(true)
	})

	it('rejects params on static path', () => {
		// @ts-expect-error — static path should not accept params
		const _el = <Link to="/about" params={{ foo: 'bar' }}>About</Link>
		expect(true).toBe(true)
	})

	it('requires params on dynamic path', () => {
		const _el = <Link to="/users/:userId" params={{ userId: '1' }}>User</Link>

		// @ts-expect-error — missing required params
		const _el2 = <Link to="/users/:userId">User</Link>
		expect(true).toBe(true)
	})

	it('rejects wrong param names', () => {
		// @ts-expect-error — wrong param name
		const _el = <Link to="/users/:userId" params={{ id: '1' }}>User</Link>
		expect(true).toBe(true)
	})

	it('requires all params for multi-param path', () => {
		const _ok = <Link to="/users/:userId/posts/:postId" params={{ userId: '1', postId: '2' }}>Post</Link>

		// @ts-expect-error — missing postId
		const _bad = <Link to="/users/:userId/posts/:postId" params={{ userId: '1' }}>Post</Link>
		expect(true).toBe(true)
	})

	it('rejects unregistered paths', () => {
		// @ts-expect-error — path not in BuzolaRouteMap
		const _el = <Link to="/nope">Nope</Link>
		expect(true).toBe(true)
	})
})
