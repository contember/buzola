import { describe, expect, it } from 'bun:test'
import { collectConfigRoutePaths } from '../generator/config-parser'

interface TestNode {
	fullPath: string
	isLayout: boolean
	children: TestNode[]
}

/** Helper to create a minimal RouteNode-like object. */
function node(
	fullPath: string,
	opts: { isLayout?: boolean; children?: TestNode[] } = {},
): TestNode {
	return {
		fullPath,
		isLayout: opts.isLayout ?? false,
		children: opts.children ?? [],
	}
}

describe('collectConfigRoutePaths', () => {
	it('extracts flat routes', () => {
		const result = collectConfigRoutePaths([
			node('/'),
			node('/about'),
		])

		expect(result).toEqual([
			{ path: '/', params: [] },
			{ path: '/about', params: [] },
		])
	})

	it('excludes layout routes', () => {
		const result = collectConfigRoutePaths([
			node('/', {
				isLayout: true,
				children: [
					node('/'),
					node('/about'),
				],
			}),
		])

		expect(result).toEqual([
			{ path: '/', params: [] },
			{ path: '/about', params: [] },
		])
	})

	it('extracts dynamic params', () => {
		const result = collectConfigRoutePaths([
			node('/users/:userId'),
		])

		expect(result).toEqual([
			{ path: '/users/:userId', params: ['userId'] },
		])
	})

	it('extracts nested dynamic params', () => {
		const result = collectConfigRoutePaths([
			node('/users', {
				isLayout: true,
				children: [
					node('/users'),
					node('/users/:userId'),
					node('/users/:userId/settings'),
				],
			}),
		])

		expect(result).toEqual([
			{ path: '/users', params: [] },
			{ path: '/users/:userId', params: ['userId'] },
			{ path: '/users/:userId/settings', params: ['userId'] },
		])
	})

	it('extracts catch-all params', () => {
		const result = collectConfigRoutePaths([
			node('/:path+'),
		])

		expect(result).toEqual([
			{ path: '/:path+', params: ['path'] },
		])
	})

	it('handles deeply nested layouts', () => {
		const result = collectConfigRoutePaths([
			node('/', {
				isLayout: true,
				children: [
					node('/users', {
						isLayout: true,
						children: [
							node('/users/:userId', {
								isLayout: true,
								children: [
									node('/users/:userId'),
									node('/users/:userId/settings'),
								],
							}),
						],
					}),
				],
			}),
		])

		expect(result).toEqual([
			{ path: '/users/:userId', params: ['userId'] },
			{ path: '/users/:userId/settings', params: ['userId'] },
		])
	})

	it('handles multiple params in one path', () => {
		const result = collectConfigRoutePaths([
			node('/:org/:repo'),
		])

		expect(result).toEqual([
			{ path: '/:org/:repo', params: ['org', 'repo'] },
		])
	})

	it('returns empty array for empty input', () => {
		expect(collectConfigRoutePaths([])).toEqual([])
	})

	it('handles the full playground route tree', () => {
		const result = collectConfigRoutePaths([
			node('/', {
				isLayout: true,
				children: [
					node('/'),
					node('/about'),
					node('/users', {
						isLayout: true,
						children: [
							node('/users'),
							node('/users/:userId'),
							node('/users/:userId/settings'),
						],
					}),
					node('/:path+'),
				],
			}),
		])

		expect(result).toEqual([
			{ path: '/', params: [] },
			{ path: '/about', params: [] },
			{ path: '/users', params: [] },
			{ path: '/users/:userId', params: ['userId'] },
			{ path: '/users/:userId/settings', params: ['userId'] },
			{ path: '/:path+', params: ['path'] },
		])
	})
})
