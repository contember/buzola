import { describe, expect, it } from 'bun:test'
import { createPage } from '../define/create-page'
import { createMemoryNavigationAdapter } from '../engine/navigation-adapter'
import { buildRouteTree } from '../engine/route-tree'
import { Router } from '../engine/router'
import { s } from '../engine/schema'
import type { RouteConfig, StandardSchema } from '../engine/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dummyComponent() {
	return null
}

function createRouter(
	configs: RouteConfig[],
	initialURL = 'http://localhost/',
	options?: { pageRegistry?: Record<string, string> },
) {
	const routes = buildRouteTree(configs)
	const adapter = createMemoryNavigationAdapter({ initialURL })
	const router = new Router({ routes, adapter, ...options })
	router.start()
	return { router, adapter }
}

/** Minimal Standard Schema implementation for testing. */
function createSchema<T>(
	validate: (value: unknown) => { value: T } | { issues: readonly { message: string }[] },
): StandardSchema<T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate,
		},
	}
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createPage', () => {
	it('returns a PageDefinition with __buzolaPage marker', () => {
		const page = createPage().render(({ params }) => null)

		expect(page.__buzolaPage).toBe(true)
		expect(typeof page.component).toBe('function')
	})

	it('returns a PageDefinition with paramsSchema when schema provided', () => {
		const schema = createSchema((v) => ({ value: v as { id: string } }))
		const page = createPage()
			.params(schema)
			.render(({ params }) => null)

		expect(page.__buzolaPage).toBe(true)
		expect(page.paramsSchema).toBe(schema)
	})

	it('paramsSchema is undefined when no schema provided', () => {
		const page = createPage().render(({ params }) => null)
		expect(page.paramsSchema).toBeUndefined()
	})

	it('stores route pattern when .route() is called', () => {
		const page = createPage()
			.route('/about')
			.render(({ params }) => null)

		expect(page.route).toBe('/about')
	})

	it('stores route pattern with params when schema matches', () => {
		const schema = createSchema((v) => ({ value: v as { id: string } }))
		const page = createPage()
			.params(schema)
			.route('/users/:id')
			.render(({ params }) => null)

		expect(page.route).toBe('/users/:id')
	})

	it('route is undefined when .route() is not called', () => {
		const page = createPage().render(({ params }) => null)
		expect(page.route).toBeUndefined()
	})

	it('supports full chain: .params().route().render()', () => {
		const schema = createSchema((v) => ({ value: v as { id: string } }))
		const page = createPage()
			.params(schema)
			.route('/project/:id')
			.render(({ params }) => null)

		expect(page.__buzolaPage).toBe(true)
		expect(page.paramsSchema).toBe(schema)
		expect(page.route).toBe('/project/:id')
		expect(typeof page.component).toBe('function')
	})

	it('populates paramsMeta from shape object', () => {
		const page = createPage()
			.params({ userId: s.string(), tab: s.optional(s.string()) })
			.route('/users/:userId')
			.render(({ params }) => null)

		expect(page.paramsMeta).toEqual([
			{ name: 'userId', optional: false, array: false },
			{ name: 'tab', optional: true, array: false },
		])
	})

	it('populates paramsMeta from s.object schema', () => {
		const page = createPage()
			.params(s.object({ userId: s.string(), tab: s.optional(s.string()) }))
			.route('/users/:userId')
			.render(({ params }) => null)

		expect(page.paramsMeta).toEqual([
			{ name: 'userId', optional: false, array: false },
			{ name: 'tab', optional: true, array: false },
		])
	})

	it('populates paramsMeta from string literals', () => {
		const page = createPage()
			.params({ id: 'uuid', order: 'number', text: '?string', tags: '?string[]' })
			.render(({ params }) => null)

		expect(page.paramsMeta).toEqual([
			{ name: 'id', optional: false, array: false },
			{ name: 'order', optional: false, array: false },
			{ name: 'text', optional: true, array: false },
			{ name: 'tags', optional: true, array: true },
		])
	})

	it('validates and coerces literal number params', () => {
		const page = createPage()
			.params({ order: 'number' })
			.render(({ params }) => null)

		const schema = page.paramsSchema!
		expect(schema['~standard'].validate({ order: '42' })).toEqual({ value: { order: 42 } })
		expect(schema['~standard'].validate({ order: 'abc' })).toHaveProperty('issues')
	})

	it('validates literal uuid params', () => {
		const page = createPage()
			.params({ id: 'uuid' })
			.render(({ params }) => null)

		const schema = page.paramsSchema!
		expect(schema['~standard'].validate({ id: '550e8400-e29b-41d4-a716-446655440000' }))
			.toEqual({ value: { id: '550e8400-e29b-41d4-a716-446655440000' } })
		expect(schema['~standard'].validate({ id: 'not-a-uuid' })).toHaveProperty('issues')
	})

	it('validates literal array params', () => {
		const page = createPage()
			.params({ tags: 'string[]' })
			.render(({ params }) => null)

		const schema = page.paramsSchema!
		expect(schema['~standard'].validate({ tags: ['a', 'b'] })).toEqual({ value: { tags: ['a', 'b'] } })
		expect(schema['~standard'].validate({ tags: 'not-array' })).toHaveProperty('issues')
	})

	it('coerces literal number[] params', () => {
		const page = createPage()
			.params({ ids: 'number[]' })
			.render(({ params }) => null)

		const schema = page.paramsSchema!
		expect(schema['~standard'].validate({ ids: ['1', '2', '3'] })).toEqual({ value: { ids: [1, 2, 3] } })
	})

	it('validates optional array as undefined when empty', () => {
		const page = createPage()
			.params({ tags: '?string[]' })
			.render(({ params }) => null)

		const schema = page.paramsSchema!
		expect(schema['~standard'].validate({ tags: undefined })).toEqual({ value: { tags: undefined } })
		expect(schema['~standard'].validate({ tags: [] })).toEqual({ value: { tags: undefined } })
		expect(schema['~standard'].validate({ tags: ['a'] })).toEqual({ value: { tags: ['a'] } })
	})

	it('paramsMeta is empty when no schema provided', () => {
		const page = createPage().render(({ params }) => null)
		expect(page.paramsMeta).toEqual([])
	})

	it('component is usable as RouteConfig component', () => {
		const page = createPage().render(({ params }) => null)

		const config: RouteConfig = {
			path: '/test',
			component: page.component,
		}
		expect(config.component).toBe(page.component)
	})

	it('stores loader function in PageDefinition', () => {
		const loader = async ({ params }: { params: { id: string } }) => ({ name: 'Alice' })
		const page = createPage()
			.params({ id: 'string' })
			.loader(loader)
			.render(({ params, data }) => null)

		expect(page.loader).toBe(loader)
	})

	it('loader is undefined when not provided', () => {
		const page = createPage().render(({ params }) => null)
		expect(page.loader).toBeUndefined()
	})

	it('supports .params().loader().route().render() chain', () => {
		const page = createPage()
			.params({ id: 'uuid' })
			.loader(async ({ params }) => ({ name: `User ${params.id}` }))
			.route('/users/:id')
			.render(({ params, data }) => null)

		expect(page.__buzolaPage).toBe(true)
		expect(page.route).toBe('/users/:id')
		expect(page.loader).toBeDefined()
		expect(typeof page.component).toBe('function')
	})

	it('supports .loader() without params', () => {
		const page = createPage()
			.loader(async () => ({ stats: 42 }))
			.route('/dashboard')
			.render(({ data }) => null)

		expect(page.loader).toBeDefined()
		expect(page.route).toBe('/dashboard')
	})

	it('supports .params().loader().render() without route', () => {
		const page = createPage()
			.params({ id: 'string' })
			.loader(async ({ params }) => ({ name: 'test' }))
			.render(({ params, data }) => null)

		expect(page.loader).toBeDefined()
		expect(page.route).toBeUndefined()
	})

	it('supports multiple loaders that merge results', () => {
		const page = createPage()
			.params({ id: 'string' })
			.loader(async ({ params }) => ({ user: { name: 'Alice' } }))
			.loader(async ({ params }) => ({ posts: [1, 2, 3] }))
			.route('/users/:id')
			.render(({ params, data }) => {
				// Type-safe access to both loader results
				const _user: { name: string } = data.user
				const _posts: number[] = data.posts
				return null
			})

		expect(page.loader).toBeDefined()
	})

	it('multiple loaders run in parallel and merge', async () => {
		const order: string[] = []

		const page = createPage()
			.params({ id: 'string' })
			.loader(async () => {
				order.push('loader1-start')
				await new Promise(r => setTimeout(r, 10))
				order.push('loader1-end')
				return { a: 1 }
			})
			.loader(async () => {
				order.push('loader2-start')
				await new Promise(r => setTimeout(r, 10))
				order.push('loader2-end')
				return { b: 2 }
			})
			.render(({ data }) => null)

		const result = await page.loader!({ params: { id: '1' } })
		expect(result).toEqual({ a: 1, b: 2 })
		// Both loaders started before either finished (parallel)
		expect(order[0]).toBe('loader1-start')
		expect(order[1]).toBe('loader2-start')
	})

	it('single loader is stored directly (not wrapped)', () => {
		const loader = async () => ({ x: 1 })
		const page = createPage()
			.loader(loader)
			.render(({ data }) => null)

		expect(page.loader).toBe(loader)
	})

	it('invalidate is available in render props with loader', () => {
		const page = createPage()
			.loader(async () => ({ value: 1 }))
			.render(({ data, invalidate }) => {
				// invalidate should be a function
				const _fn: () => void = invalidate
				return null
			})

		expect(page.loader).toBeDefined()
	})

})

describe('Router page registry', () => {
	it('navigateToPage navigates using page registry', () => {
		const { router } = createRouter(
			[
				{ path: '/', component: dummyComponent, isIndex: true },
				{ path: '/users/:userId', component: dummyComponent },
			],
			'http://localhost/',
			{
				pageRegistry: {
					'home': '/',
					'users/detail': '/users/:userId',
				},
			},
		)

		router.navigateToPage('users/detail', { userId: '42' })
		const state = router.getState()
		expect(state.location.pathname).toBe('/users/42')
	})

	it('buildPagePath builds path from page registry', () => {
		const { router } = createRouter(
			[],
			'http://localhost/',
			{
				pageRegistry: {
					'users/detail': '/users/:userId',
				},
			},
		)

		const path = router.buildPagePath('users/detail', { userId: '42' })
		expect(path).toBe('/users/42')
	})

	it('buildPagePath appends extra params as query string', () => {
		const { router } = createRouter(
			[],
			'http://localhost/',
			{
				pageRegistry: {
					'users/detail': '/users/:userId',
				},
			},
		)

		const path = router.buildPagePath('users/detail', { userId: '42', tab: 'posts' })
		expect(path).toBe('/users/42?tab=posts')
	})

	it('buildPagePath throws for unknown page ID', () => {
		const { router } = createRouter([], 'http://localhost/', { pageRegistry: {} })

		expect(() => router.buildPagePath('nonexistent')).toThrow('Unknown page "nonexistent"')
	})

	it('navigateToPage with extra params as query string', () => {
		const { router } = createRouter(
			[
				{ path: '/', component: dummyComponent, isIndex: true },
				{ path: '/users/:userId', component: dummyComponent },
			],
			'http://localhost/',
			{
				pageRegistry: {
					'users/detail': '/users/:userId',
				},
			},
		)

		router.navigateToPage('users/detail', { userId: '1', tab: 'posts' })

		const state = router.getState()
		expect(state.location.pathname).toBe('/users/1')
		expect(state.location.searchParams.get('tab')).toBe('posts')
	})

	it('buildPagePath for static route', () => {
		const { router } = createRouter(
			[],
			'http://localhost/',
			{
				pageRegistry: {
					'about': '/about',
				},
			},
		)

		const path = router.buildPagePath('about')
		expect(path).toBe('/about')
	})
})

describe('Router.buildPath with extra params', () => {
	it('appends extra params as query string', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/users/:userId', {
			userId: '42',
			tab: 'posts',
		})
		expect(path).toBe('/users/42?tab=posts')
	})

	it('does not append query string when all params are path params', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/users/:userId', { userId: '42' })
		expect(path).toBe('/users/42')
	})

	it('appends multiple extra params', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/users/:userId', {
			userId: '42',
			tab: 'posts',
			sort: 'date',
		})
		// URLSearchParams preserves insertion order
		expect(path).toBe('/users/42?tab=posts&sort=date')
	})

	it('skips undefined extra params', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/users/:userId', {
			userId: '42',
			tab: undefined as any,
			sort: 'date',
		})
		expect(path).toBe('/users/42?sort=date')
	})

	it('handles static path with extra params', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/about', { tab: 'team' })
		expect(path).toBe('/about?tab=team')
	})
})

describe('Router.resolveParams with extra params pass-through', () => {
	it('passes through extra explicit params not in pattern', () => {
		const { router } = createRouter([
			{ path: '/users/:userId', component: dummyComponent },
		])

		const result = router.resolveParams('/users/:userId', { userId: '42', tab: 'posts' })
		expect(result).toEqual({ userId: '42', tab: 'posts' })
	})

	it('does not pass through when no explicit params given', () => {
		const { router } = createRouter(
			[{ path: '/users/:userId', component: dummyComponent }],
			'http://localhost/users/42',
		)

		const result = router.resolveParams('/users/:userId')
		expect(result).toEqual({ userId: '42' })
	})

	it('extra params do not override path params from current match', () => {
		const { router } = createRouter(
			[{ path: '/users/:userId', component: dummyComponent }],
			'http://localhost/users/42',
		)

		// userId comes from current match, tab is extra
		const result = router.resolveParams('/users/:userId', { tab: 'posts' })
		expect(result).toEqual({ userId: '42', tab: 'posts' })
	})
})

describe('navigate with extra params (integration)', () => {
	it('navigates with extra params as query string', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/users/:userId', component: dummyComponent },
		])

		// Simulate what useNavigate does via navigateToPage
		const resolved = router.resolveParams('/users/:userId', { userId: '1', tab: 'posts' })
		const path = router.buildPath('/users/:userId', resolved)
		router.navigate(router.stripBasePath(path))

		const state = router.getState()
		expect(state.location.pathname).toBe('/users/1')
		expect(state.location.searchParams.get('tab')).toBe('posts')
	})
})
