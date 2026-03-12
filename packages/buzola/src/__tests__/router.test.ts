import { describe, expect, it, mock } from 'bun:test'
import { createMemoryNavigationAdapter } from '../engine/navigation-adapter.js'
import { buildRouteTree } from '../engine/route-tree.js'
import { Router } from '../engine/router.js'
import type { GuardContext, RouteConfig } from '../engine/types.js'

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

	it('handles route guards', async () => {
		const guard = mock(() => false) // Block navigation

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		// Guard blocked it, should stay at /
		expect(router.getState().location.pathname).toBe('/')
		expect(guard).toHaveBeenCalled()
	})

	it('handles async route guards that allow navigation', async () => {
		const guard = mock(() => Promise.resolve(true))

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		// Async guard — need to wait for microtask
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(router.getState().location.pathname).toBe('/protected')
		expect(guard).toHaveBeenCalled()
	})

	it('handles async route guards that block navigation', async () => {
		const guard = mock(() => Promise.resolve(false))

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(router.getState().location.pathname).toBe('/')
		expect(guard).toHaveBeenCalled()
	})

	it('handles route guards that redirect', async () => {
		const guard = mock(() => ({ redirect: '/login' }))

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/login', component: dummyComponent },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(router.getState().location.pathname).toBe('/login')
		expect(guard).toHaveBeenCalled()
	})

	it('handles async route guards that redirect', async () => {
		const guard = mock(() => Promise.resolve({ redirect: '/login' }))

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/login', component: dummyComponent },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(router.getState().location.pathname).toBe('/login')
		expect(guard).toHaveBeenCalled()
	})

	it('dispose stops intercepting navigations', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/about', component: dummyComponent },
		])

		const subscriber = mock(() => {})
		router.subscribe(subscriber)
		router.dispose()

		router.navigate('/about')
		expect(subscriber).not.toHaveBeenCalled()
	})

	it('updates routes for HMR', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
		])

		const newRoutes = buildRouteTree([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/new-route', component: dummyComponent },
		])

		router.updateRoutes(newRoutes)
		router.navigate('/new-route')
		expect(router.getState().location.pathname).toBe('/new-route')
	})

	it('dispose clears all subscribers', () => {
		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/about', component: dummyComponent },
		])

		const subscriber = mock(() => {})
		router.subscribe(subscriber)
		router.dispose()

		router.navigate('/about')
		expect(subscriber).not.toHaveBeenCalled()
	})

	it('passes GuardContext with AbortSignal to guards', async () => {
		let receivedContext: GuardContext | undefined
		const guard = mock((_match: unknown, context: GuardContext) => {
			receivedContext = context
			return true
		})

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])

		router.navigate('/protected')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(guard).toHaveBeenCalled()
		expect(receivedContext).toBeDefined()
		expect(receivedContext!.signal).toBeInstanceOf(AbortSignal)
		expect(receivedContext!.signal.aborted).toBe(false)
	})

	it('aborts previous guard signal on new navigation', async () => {
		let firstSignal: AbortSignal | undefined
		let resolveFirst: (() => void) | undefined

		const slowGuard = mock((_match: unknown, context: GuardContext) => {
			firstSignal = context.signal
			return new Promise<boolean>(resolve => {
				resolveFirst = () => resolve(true)
			})
		})

		const { router } = createRouter([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/slow', component: dummyComponent, beforeEnter: slowGuard },
			{ path: '/fast', component: dummyComponent },
		])

		// Start navigation to /slow (guard will hang)
		router.navigate('/slow')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(firstSignal).toBeDefined()
		expect(firstSignal!.aborted).toBe(false)

		// Start a new navigation — should abort the previous signal
		router.navigate('/fast')
		await new Promise(resolve => setTimeout(resolve, 10))
		expect(firstSignal!.aborted).toBe(true)

		// Clean up
		resolveFirst?.()
	})

	it('throws on guard redirect to non-existent route', async () => {
		const guard = mock(() => ({ redirect: '/nowhere' }))

		const routes = buildRouteTree([
			{ path: '/', component: dummyComponent, isIndex: true },
			{ path: '/protected', component: dummyComponent, beforeEnter: guard },
		])
		const adapter = createMemoryNavigationAdapter({ initialURL: 'http://localhost/' })

		// Intercept the navigate event to capture the handler promise for assertions
		// while converting the error to NavigationAbortedError so the adapter swallows it.
		let handlerPromise: Promise<void> | undefined
		const origAddEventListener = adapter.addEventListener
		adapter.addEventListener = (_type, listener) => {
			origAddEventListener.call(adapter, _type, (event) => {
				const origEventIntercept = event.intercept.bind(event)
				event.intercept = (opts) => {
					handlerPromise = opts.handler()
					origEventIntercept({
						...opts,
						handler: () =>
							handlerPromise!.catch(() => {
								// Convert to NavigationAbortedError so the adapter swallows it
								const err = new Error()
								err.name = 'NavigationAbortedError'
								throw err
							}),
					})
				}
				listener(event)
			})
		}

		const router = new Router({ routes, adapter })
		router.start()

		router.navigate('/protected')
		expect(handlerPromise).toBeDefined()
		await expect(handlerPromise!).rejects.toThrow('does not match any route')
		expect(router.getState().location.pathname).toBe('/')
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

		expect(routes[0].id).toBe('route:/:layout')
		expect(routes[0].children[0].id).toBe('route:/')
		expect(routes[0].children[1].id).toBe('route:/about')
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
