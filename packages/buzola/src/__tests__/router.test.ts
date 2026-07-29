import { describe, expect, it, mock } from 'bun:test'
import { matchRoutes } from '../engine/matcher.js'
import { createMemoryNavigationAdapter } from '../engine/navigation-adapter.js'
import { buildRouteTree } from '../engine/route-tree.js'
import { Router } from '../engine/router.js'
import type { BuzolaNavigateEvent, NavigationAdapter, RouteConfig } from '../engine/types.js'

function dummyComponent() {
	return null
}

function createRouter(
	configs: RouteConfig[],
	initialURL = 'http://localhost/',
	options?: { persistentParams?: () => Record<string, string> },
) {
	const routes = buildRouteTree(configs)
	const adapter = createMemoryNavigationAdapter({ initialURL })
	const router = new Router({ routes, adapter, ...options })
	router.start()
	return { router, adapter }
}

describe('Router', () => {
	it('initializes with the current URL state', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
		])

		const state = router.getState()
		expect(state.location.pathname).toBe('/')
		expect(state.matches).toHaveLength(1)
		expect(state.isPending).toBe(false)
	})

	it('navigates to a new route', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/about', component: dummyComponent },
		])

		router.navigate('/about')
		const state = router.getState()
		expect(state.location.pathname).toBe('/about')
		expect(state.matches).toHaveLength(1)
	})

	it('notifies subscribers on navigation', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/about', component: dummyComponent },
		])

		let lastPathname = ''
		const subscriber = mock((state: { location: URL }) => {
			lastPathname = state.location.pathname
		})
		router.subscribe(subscriber)

		router.navigate('/about')
		expect(subscriber).toHaveBeenCalled()
		expect(lastPathname).toBe('/about')
	})

	it('unsubscribes correctly', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/about', component: dummyComponent },
		])

		const subscriber = mock(() => {})
		const unsub = router.subscribe(subscriber)
		unsub()

		router.navigate('/about')
		expect(subscriber).not.toHaveBeenCalled()
	})

	it('extracts params from dynamic routes', () => {
		const { router } = createRouter([
			{ path: '/users/:userId', component: dummyComponent },
		])

		router.navigate('/users/42')
		const state = router.getState()
		expect(state.matches[0].params).toEqual({ userId: '42' })
	})

	it('builds paths from patterns and params', () => {
		const { router } = createRouter([])
		const path = router.buildPath('/users/:userId/posts/:postId', {
			userId: '42',
			postId: '7',
		})
		expect(path).toBe('/users/42/posts/7')
	})

	it('buildPath throws on missing params', () => {
		const { router } = createRouter([])
		expect(() => router.buildPath('/users/:userId')).toThrow('Missing params')
		expect(() => router.buildPath('/users/:userId', {})).toThrow('Missing param "userId"')
		expect(() => router.buildPath('/users/:userId/posts/:postId', { userId: '1' })).toThrow('Missing param "postId"')
	})

	it('buildPath works for static paths without params', () => {
		const { router } = createRouter([])
		expect(router.buildPath('/about')).toBe('/about')
		expect(router.buildPath('/')).toBe('/')
	})

	it('generates deterministic path-based IDs', () => {
		const routes = buildRouteTree([
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

		// Verify IDs through matching
		const indexMatches = matchRoutes(routes, new URL('http://localhost/'))!
		expect(indexMatches[0].node.id).toBe('route:/:layout')
		expect(indexMatches[1].node.id).toBe('route:/')

		const aboutMatches = matchRoutes(routes, new URL('http://localhost/about'))!
		expect(aboutMatches[0].node.id).toBe('route:/:layout')
		expect(aboutMatches[1].node.id).toBe('route:/about')
	})
})

describe('Router.resolveParams', () => {
	it('returns explicit params only when no persistent params configured', () => {
		const { router } = createRouter([
			{ path: '/users/:userId', component: dummyComponent },
		])

		const result = router.resolveParams('/users/:userId', { userId: '42' })
		expect(result).toEqual({ userId: '42' })
	})

	it('resolves params from current URL match', () => {
		const { router } = createRouter([
			{ path: '/:lang/users', component: dummyComponent },
		], 'http://localhost/en/users')

		const result = router.resolveParams('/:lang/users')
		expect(result).toEqual({ lang: 'en' })
	})

	it('explicit params override current match', () => {
		const { router } = createRouter([
			{ path: '/:lang/users', component: dummyComponent },
		], 'http://localhost/en/users')

		const result = router.resolveParams('/:lang/users', { lang: 'cs' })
		expect(result).toEqual({ lang: 'cs' })
	})

	it('falls back to persistentParams callback', () => {
		const { router } = createRouter(
			[
				{ path: '/admin', component: dummyComponent },
				{ path: '/:lang/users', component: dummyComponent },
			],
			'http://localhost/admin',
			{ persistentParams: () => ({ lang: 'en' }) },
		)

		const result = router.resolveParams('/:lang/users')
		expect(result).toEqual({ lang: 'en' })
	})

	it('current match overrides callback', () => {
		const { router } = createRouter(
			[{ path: '/:lang/users', component: dummyComponent }],
			'http://localhost/cs/users',
			{ persistentParams: () => ({ lang: 'en' }) },
		)

		const result = router.resolveParams('/:lang/users')
		expect(result).toEqual({ lang: 'cs' })
	})

	it('only fills params present in target pattern', () => {
		const { router } = createRouter(
			[{ path: '/:lang/users/:userId', component: dummyComponent }],
			'http://localhost/en/users/42',
			{ persistentParams: () => ({ lang: 'en' }) },
		)

		// Target pattern only has :lang, not :userId
		const result = router.resolveParams('/:lang/about')
		expect(result).toEqual({ lang: 'en' })
	})

	it('handles mixed persistent and non-persistent params', () => {
		const { router } = createRouter(
			[{ path: '/:lang/users', component: dummyComponent }],
			'http://localhost/en/users',
			{ persistentParams: () => ({ lang: 'en' }) },
		)

		const result = router.resolveParams('/:lang/users/:userId', { userId: '42' })
		expect(result).toEqual({ lang: 'en', userId: '42' })
	})

	it('returns empty object when pattern has no params', () => {
		const { router } = createRouter(
			[{ path: '/about', component: dummyComponent }],
			'http://localhost/about',
		)

		const result = router.resolveParams('/about')
		expect(result).toEqual({})
	})
})

describe('Router.preload', () => {
	it('calls preload on matching route nodes', () => {
		const preloadFn = mock(() => {})
		const routes = buildRouteTree([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/users/:userId', component: dummyComponent, preload: preloadFn },
		])
		const adapter = createMemoryNavigationAdapter({ initialURL: 'http://localhost/' })
		const router = new Router({
			routes,
			adapter,
			pageRegistry: { 'users/detail': '/users/:userId' },
		})

		router.preload('users/detail', { userId: '42' })
		expect(preloadFn).toHaveBeenCalledTimes(1)
	})

	it('calls preload on all matched nodes (layout + page)', () => {
		const layoutPreload = mock(() => {})
		const pagePreload = mock(() => {})
		const routes = buildRouteTree([{
			path: '/users',
			component: dummyComponent,
			preload: layoutPreload,
			isLayout: true,
			children: [
				{ path: '/:userId', component: dummyComponent, preload: pagePreload },
			],
		}])
		const adapter = createMemoryNavigationAdapter({ initialURL: 'http://localhost/' })
		const router = new Router({
			routes,
			adapter,
			pageRegistry: { 'users/detail': '/users/:userId' },
		})

		router.preload('users/detail', { userId: '1' })
		expect(layoutPreload).toHaveBeenCalledTimes(1)
		expect(pagePreload).toHaveBeenCalledTimes(1)
	})

	it('does not throw for unmatched page', () => {
		const routes = buildRouteTree([
			{ path: '/', component: dummyComponent, isIndex: true },
		])
		const adapter = createMemoryNavigationAdapter({ initialURL: 'http://localhost/' })
		const router = new Router({
			routes,
			adapter,
			pageRegistry: { 'about': '/about' },
		})

		// Should not throw
		router.preload('about')
	})
})

describe('Router focus reset', () => {
	function createCapturingRouter(initialURL: string) {
		const routes = buildRouteTree([
			{ path: '/list', component: dummyComponent },
			{ path: '/about', component: dummyComponent },
		])
		const adapter = createMemoryNavigationAdapter({ initialURL })
		const captured: ({ scroll?: string; focusReset?: string })[] = []
		const listeners = new Set<(event: BuzolaNavigateEvent) => void>()
		const capturingAdapter: NavigationAdapter = {
			...adapter,
			addEventListener(type, listener) {
				listeners.add(listener)
			},
			removeEventListener(type, listener) {
				listeners.delete(listener)
			},
			navigate(url) {
				for (const listener of listeners) {
					listener({
						destination: { url: new URL(url, initialURL).href },
						canIntercept: true,
						navigationType: 'push',
						userInitiated: false,
						intercept(options) {
							captured.push({ scroll: options.scroll, focusReset: options.focusReset })
							void options.handler()
						},
					})
				}
			},
		}
		const router = new Router({ routes, adapter: capturingAdapter })
		router.start()
		return { router, captured }
	}

	it('keeps focus when only the query changes', () => {
		const { router, captured } = createCapturingRouter('http://localhost/list')

		router.navigate('/list?search=foo')

		expect(captured.at(-1)?.focusReset).toBe('manual')
	})

	it('resets focus when the path changes', () => {
		const { router, captured } = createCapturingRouter('http://localhost/list')

		router.navigate('/about')

		expect(captured.at(-1)?.focusReset).toBe('after-transition')
	})

	it('honours an explicit focusReset option', () => {
		const { router, captured } = createCapturingRouter('http://localhost/list')

		router.navigate('/about', { focusReset: 'manual' })

		expect(captured.at(-1)?.focusReset).toBe('manual')
	})

	it('applies the explicit focusReset only to the navigation it was passed with', () => {
		const { router, captured } = createCapturingRouter('http://localhost/list')

		router.navigate('/about', { focusReset: 'manual' })
		router.navigate('/list')

		expect(captured.at(-1)?.focusReset).toBe('after-transition')
	})
})
