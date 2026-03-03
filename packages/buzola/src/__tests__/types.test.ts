import { describe, expect, it } from 'bun:test'
import type { ParamsForPath } from '../engine/types'

describe('ParamsForPath type', () => {
	it('extracts no params from static paths', () => {
		// Type-level test: this should compile without error
		const _test: ParamsForPath<'/about'> = {} as ParamsForPath<'/'>
		expect(true).toBe(true)
	})

	it('extracts a single param', () => {
		const _test: ParamsForPath<'/users/:userId'> = { userId: 'abc' }
		expect(_test.userId).toBe('abc')
	})

	it('extracts multiple params', () => {
		const _test: ParamsForPath<'/users/:userId/posts/:postId'> = { userId: '1', postId: '2' }
		expect(_test.userId).toBe('1')
		expect(_test.postId).toBe('2')
	})

	it('handles root path', () => {
		const _test: ParamsForPath<'/'> = {} as ParamsForPath<'/'>
		expect(true).toBe(true)
	})
})
