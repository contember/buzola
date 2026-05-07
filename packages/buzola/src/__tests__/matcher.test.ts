import { describe, expect, it } from 'bun:test'
import { matchRoutes } from '../engine/matcher.js'
import { buildRouteTree } from '../engine/route-tree.js'
import type { RouteConfig } from '../engine/types.js'

function dummyComponent() {
	return null
}

function createTestTree(configs: RouteConfig[]) {
	return buildRouteTree(configs)
}

describe('matchRoutes', () => {
	it('matches a simple root route', () => {
		const tree = createTestTree([
			{ path: '/', component: dummyComponent, isIndex: true },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(1)
		expect(matches![0].node.fullPath).toBe('/')
	})

	it('matches a static route', () => {
		const tree = createTestTree([
			{ path: '/about', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/about'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(1)
		expect(matches![0].node.fullPath).toBe('/about')
	})

	it('matches a dynamic route and extracts params', () => {
		const tree = createTestTree([
			{ path: '/users/:userId', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/users/42'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(1)
		expect(matches![0].params).toEqual({ userId: '42' })
	})

	it('matches nested routes through layouts', () => {
		const tree = createTestTree([
			{
				path: '/',
				component: dummyComponent,
				isLayout: true,
				children: [
					{ path: '/', component: dummyComponent, isIndex: true },
					{ path: '/about', component: dummyComponent },
				],
			},
		])

		const indexMatches = matchRoutes(tree, new URL('http://localhost/'))
		expect(indexMatches).not.toBeNull()
		expect(indexMatches).toHaveLength(2) // layout + index

		const aboutMatches = matchRoutes(tree, new URL('http://localhost/about'))
		expect(aboutMatches).not.toBeNull()
		expect(aboutMatches).toHaveLength(2) // layout + about
	})

	it('matches deeply nested dynamic routes', () => {
		const tree = createTestTree([
			{
				path: '/users',
				component: dummyComponent,
				isLayout: true,
				children: [
					{ path: '/', component: dummyComponent, isIndex: true },
					{ path: '/:userId', component: dummyComponent },
				],
			},
		])

		const matches = matchRoutes(tree, new URL('http://localhost/users/99'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(2) // users layout + :userId
		expect(matches![1].params).toEqual({ userId: '99' })
	})

	it('extracts params from layout routes via prefixPattern', () => {
		const tree = createTestTree([
			{
				path: '/users/:userId',
				component: dummyComponent,
				isLayout: true,
				children: [
					{ path: '/', component: dummyComponent, isIndex: true },
					{ path: '/settings', component: dummyComponent },
				],
			},
		])

		const matches = matchRoutes(tree, new URL('http://localhost/users/42/settings'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(2)
		// Layout should extract userId param via prefixPattern
		expect(matches![0].params).toEqual({ userId: '42' })
		expect(matches![0].node.isLayout).toBe(true)
	})

	it('returns null for unmatched routes', () => {
		const tree = createTestTree([
			{ path: '/about', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/nonexistent'))
		expect(matches).toBeNull()
	})

	it('matches routes with trailing slash', () => {
		const tree = createTestTree([
			{ path: '/about', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/about/'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(1)
		expect(matches![0].node.fullPath).toBe('/about')
	})

	it('matches nested routes with trailing slash', () => {
		const tree = createTestTree([
			{
				path: '/users',
				component: dummyComponent,
				isLayout: true,
				children: [
					{ path: '/:userId', component: dummyComponent },
				],
			},
		])

		const matches = matchRoutes(tree, new URL('http://localhost/users/42/'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(2)
		expect(matches![1].params).toEqual({ userId: '42' })
	})

	it('prefers static route over dynamic sibling when layout with matchPath comes first', () => {
		// Simulates the real-world scenario: layout with dynamic matchPath children
		// appears before a static route at the same level (e.g., /project/detail layout
		// with matchPath /project/:id vs /project/create static page)
		const tree = createTestTree([
			{
				path: '/',
				component: dummyComponent,
				isLayout: true,
				children: [
					{
						path: '/project/detail',
						component: dummyComponent,
						isLayout: true,
						children: [
							{ path: '/', matchPath: '/project/:id', component: dummyComponent, isIndex: true },
						],
					},
					{ path: '/project/create', component: dummyComponent },
				],
			},
		])

		// /project/create should match the static route, not /project/:id with id=create
		const matches = matchRoutes(tree, new URL('http://localhost/project/create'))
		expect(matches).not.toBeNull()
		const leaf = matches![matches!.length - 1]
		expect(leaf.node.fullPath).toBe('/project/create')
		expect(leaf.params).toEqual({})
	})

	it('prefers route with fewer dynamic params among siblings', () => {
		const tree = createTestTree([
			{ path: '/users/:userId', component: dummyComponent },
			{ path: '/users/me', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/users/me'))
		expect(matches).not.toBeNull()
		expect(matches).toHaveLength(1)
		expect(matches![0].node.fullPath).toBe('/users/me')
		expect(matches![0].params).toEqual({})
	})

	// ─── matchPath override tests (file tree ≠ URL tree) ────────────────────

	it('matches static route over layout with dynamic matchPath children (real-world admin structure)', () => {
		// Mirrors the actual buzola.gen.ts structure from webmaster/admin:
		// - Layout "project/detail" with matchPath children "/app/project/:id"
		// - Static sibling "project/create" at "/app/project/create"
		const tree = createTestTree([
			{
				path: '/',
				component: dummyComponent,
				isLayout: true,
				children: [
					{
						path: '/app',
						component: dummyComponent,
						isLayout: true,
						children: [
							{
								path: '/project/detail',
								component: dummyComponent,
								isLayout: true,
								children: [
									{ path: '/', matchPath: '/app/project/:id', component: dummyComponent, isIndex: true },
									{ path: '/edit', matchPath: '/app/project/:id/edit', component: dummyComponent },
								],
							},
							{ path: '/project/create', component: dummyComponent },
							{ path: '/project', component: dummyComponent },
							{ path: '/dashboard', component: dummyComponent },
						],
					},
				],
			},
		])

		// Static /app/project/create must NOT match the dynamic /app/project/:id
		const createMatches = matchRoutes(tree, new URL('http://localhost/app/project/create'))
		expect(createMatches).not.toBeNull()
		const createLeaf = createMatches![createMatches!.length - 1]
		expect(createLeaf.node.fullPath).toBe('/app/project/create')
		expect(createLeaf.params).toEqual({})

		// Dynamic /app/project/42 must match with correct param
		const detailMatches = matchRoutes(tree, new URL('http://localhost/app/project/42'))
		expect(detailMatches).not.toBeNull()
		const detailLeaf = detailMatches![detailMatches!.length - 1]
		expect(detailLeaf.node.fullPath).toBe('/app/project/:id')
		expect(detailLeaf.params).toEqual({ id: '42' })

		// Nested /app/project/42/edit must match and include layout chain
		const editMatches = matchRoutes(tree, new URL('http://localhost/app/project/42/edit'))
		expect(editMatches).not.toBeNull()
		expect(editMatches!.length).toBeGreaterThanOrEqual(3) // root layout + app layout + detail layout + edit page
		const editLeaf = editMatches![editMatches!.length - 1]
		expect(editLeaf.node.fullPath).toBe('/app/project/:id/edit')
		expect(editLeaf.params).toEqual({ id: '42' })

		// Layout chain must include the detail layout
		const detailLayout = editMatches!.find(m => m.node.isLayout && m.node.fullPath === '/app/project/detail')
		expect(detailLayout).toBeDefined()

		// /app/project (index) must match
		const listMatches = matchRoutes(tree, new URL('http://localhost/app/project'))
		expect(listMatches).not.toBeNull()
		const listLeaf = listMatches![listMatches!.length - 1]
		expect(listLeaf.node.fullPath).toBe('/app/project')

		// /app/dashboard must still work
		const dashMatches = matchRoutes(tree, new URL('http://localhost/app/dashboard'))
		expect(dashMatches).not.toBeNull()
		expect(dashMatches![dashMatches!.length - 1].node.fullPath).toBe('/app/dashboard')
	})

	it('handles multiple resources with matchPath: create vs :id pattern', () => {
		// Tests the pattern repeated across organization, voucher, feature-flag-set, etc.
		const tree = createTestTree([
			{
				path: '/',
				component: dummyComponent,
				isLayout: true,
				children: [
					{ path: '/organization/create', component: dummyComponent },
					{ path: '/organization/edit', matchPath: '/organization/:id', component: dummyComponent },
					{ path: '/organization', component: dummyComponent },
					{ path: '/voucher/create', component: dummyComponent },
					{ path: '/voucher/edit', matchPath: '/voucher/:id', component: dummyComponent },
					{ path: '/voucher', component: dummyComponent },
				],
			},
		])

		// Static create routes
		const orgCreate = matchRoutes(tree, new URL('http://localhost/organization/create'))
		expect(orgCreate).not.toBeNull()
		expect(orgCreate![orgCreate!.length - 1].node.fullPath).toBe('/organization/create')
		expect(orgCreate![orgCreate!.length - 1].params).toEqual({})

		const voucherCreate = matchRoutes(tree, new URL('http://localhost/voucher/create'))
		expect(voucherCreate).not.toBeNull()
		expect(voucherCreate![voucherCreate!.length - 1].node.fullPath).toBe('/voucher/create')

		// Dynamic :id routes
		const orgEdit = matchRoutes(tree, new URL('http://localhost/organization/abc-123'))
		expect(orgEdit).not.toBeNull()
		expect(orgEdit![orgEdit!.length - 1].node.fullPath).toBe('/organization/:id')
		expect(orgEdit![orgEdit!.length - 1].params).toEqual({ id: 'abc-123' })

		const voucherEdit = matchRoutes(tree, new URL('http://localhost/voucher/xyz'))
		expect(voucherEdit).not.toBeNull()
		expect(voucherEdit![voucherEdit!.length - 1].node.fullPath).toBe('/voucher/:id')
		expect(voucherEdit![voucherEdit!.length - 1].params).toEqual({ id: 'xyz' })

		// Index routes
		const orgList = matchRoutes(tree, new URL('http://localhost/organization'))
		expect(orgList).not.toBeNull()
		expect(orgList![orgList!.length - 1].node.fullPath).toBe('/organization')
	})

	it('handles deeply nested matchPath with multiple dynamic segments', () => {
		// Mirrors: /app/project/:id/debug/:sessionId/llm-calls/:callId
		const tree = createTestTree([
			{
				path: '/',
				component: dummyComponent,
				isLayout: true,
				children: [
					{
						path: '/project/detail',
						component: dummyComponent,
						isLayout: true,
						children: [
							{ path: '/', matchPath: '/project/:id', component: dummyComponent, isIndex: true },
							{
								path: '/debug',
								component: dummyComponent,
								isLayout: true,
								children: [
									{ path: '/', matchPath: '/project/:id/debug', component: dummyComponent, isIndex: true },
									{ path: '/llm-calls', matchPath: '/project/:id/debug/:sessionId/llm-calls', component: dummyComponent },
									{ path: '/llm-call', matchPath: '/project/:id/debug/:sessionId/llm-calls/:callId', component: dummyComponent },
								],
							},
						],
					},
				],
			},
		])

		// Multi-segment dynamic match
		const callMatches = matchRoutes(tree, new URL('http://localhost/project/p1/debug/s2/llm-calls/c3'))
		expect(callMatches).not.toBeNull()
		const callLeaf = callMatches![callMatches!.length - 1]
		expect(callLeaf.node.fullPath).toBe('/project/:id/debug/:sessionId/llm-calls/:callId')
		expect(callLeaf.params).toEqual({ id: 'p1', sessionId: 's2', callId: 'c3' })

		// Shorter dynamic match at same prefix
		const listMatches = matchRoutes(tree, new URL('http://localhost/project/p1/debug/s2/llm-calls'))
		expect(listMatches).not.toBeNull()
		const listLeaf = listMatches![listMatches!.length - 1]
		expect(listLeaf.node.fullPath).toBe('/project/:id/debug/:sessionId/llm-calls')
		expect(listLeaf.params).toEqual({ id: 'p1', sessionId: 's2' })

		// Debug index
		const debugMatches = matchRoutes(tree, new URL('http://localhost/project/p1/debug'))
		expect(debugMatches).not.toBeNull()
		expect(debugMatches![debugMatches!.length - 1].node.fullPath).toBe('/project/:id/debug')
		expect(debugMatches![debugMatches!.length - 1].params).toEqual({ id: 'p1' })
	})

	it('does not match partial paths', () => {
		const tree = createTestTree([
			{ path: '/about', component: dummyComponent },
		])

		const matches = matchRoutes(tree, new URL('http://localhost/about/extra'))
		expect(matches).toBeNull()
	})
})
