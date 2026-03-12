import './setup-dom'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import React from 'react'
import { createMemoryNavigationAdapter } from '../engine/navigation-adapter'
import { buildRouteTree } from '../engine/route-tree'
import { Router } from '../engine/router'
import type { RouteConfig, StandardSchema } from '../engine/types'
import {
	BuzolaProvider,
	ErrorBoundary,
	Link,
	Outlet,
	useBlocker,
	useInvalidate,
	useNavigate,
	useNavigationState,
	useParams,
	useRoute,
	useRouter,
	useRouterState,
	useSearchParams,
} from '../react'

afterEach(cleanup)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestRouter(
	configs: RouteConfig[],
	initialURL = 'http://localhost/',
	options?: Partial<{ basePath: string; pageRegistry: Record<string, string>; persistentParams: () => Record<string, string> }>,
) {
	const routes = buildRouteTree(configs)
	const adapter = createMemoryNavigationAdapter({ initialURL })
	const router = new Router({ routes, adapter, ...options })
	return { router, adapter }
}

function renderWithRouter(
	ui: React.ReactNode,
	configs: RouteConfig[],
	initialURL = 'http://localhost/',
	options?: Partial<{ basePath: string; pageRegistry: Record<string, string>; persistentParams: () => Record<string, string> }>,
) {
	const { router, adapter } = createTestRouter(configs, initialURL, options)
	const result = render(<BuzolaProvider router={router}>{ui}</BuzolaProvider>)
	return { ...result, router, adapter }
}

/** Flush async intercept handler chain in the memory adapter */
async function flushNav() {
	await act(async () => {
		await new Promise(r => setTimeout(r, 0))
	})
}

function Home() {
	return <div>Home</div>
}

function About() {
	return <div>About</div>
}

function UserProfile() {
	const params = useParams<{ userId: string }>()
	return <div>User {params.userId}</div>
}

function Layout({ children }: { children?: React.ReactNode }) {
	return (
		<div>
			<header>Layout</header>
			<Outlet />
		</div>
	)
}

// ─── BuzolaProvider ──────────────────────────────────────────────────────────

describe('BuzolaProvider', () => {
	it('renders children', () => {
		const { getByText } = renderWithRouter(
			<div>Hello</div>,
			[{ path: '/', component: Home, isIndex: true }],
		)
		expect(getByText('Hello')).toBeTruthy()
	})

	it('provides router context so useRouter works', () => {
		function Child() {
			const router = useRouter()
			return <div>{router ? 'has-router' : 'no-router'}</div>
		}
		const { getByText } = renderWithRouter(
			<Child />,
			[{ path: '/', component: Home, isIndex: true }],
		)
		expect(getByText('has-router')).toBeTruthy()
	})

	it('re-renders on navigation', async () => {
		function PathDisplay() {
			const route = useRoute()
			return <div data-testid="path">{route.pathname}</div>
		}

		const { getByTestId, router } = renderWithRouter(
			<PathDisplay />,
			[
				{ path: '/', component: Home, isIndex: true },
				{ path: '/about', component: About },
			],
		)

		expect(getByTestId('path').textContent).toBe('/')

		router.navigate('/about')
		await flushNav()

		expect(getByTestId('path').textContent).toBe('/about')
	})

	it('renders default Outlet when no children provided', () => {
		const { router } = createTestRouter(
			[{ path: '/', component: Home, isIndex: true }],
		)
		const { getByText } = render(<BuzolaProvider router={router} />)
		expect(getByText('Home')).toBeTruthy()
	})

	it('wraps content with middleware', () => {
		function Middleware({ children }: { params: Record<string, string>; children: React.ReactNode }) {
			return <div data-testid="middleware">{children}</div>
		}
		const { router } = createTestRouter(
			[{ path: '/', component: Home, isIndex: true }],
		)
		const { getByTestId, getByText } = render(
			<BuzolaProvider router={router} middleware={Middleware} />,
		)
		expect(getByTestId('middleware')).toBeTruthy()
		expect(getByText('Home')).toBeTruthy()
	})

	it('passes merged params from all matches to middleware', () => {
		function UserPage() {
			return <div>User Page</div>
		}
		function Layout() {
			return <Outlet />
		}
		function Middleware({ params, children }: { params: Record<string, string>; children: React.ReactNode }) {
			return <div data-testid="params">{JSON.stringify(params)}{children}</div>
		}
		const { router } = createTestRouter(
			[{
				path: '/org/:orgId',
				component: Layout,
				isLayout: true,
				children: [{ path: '/user/:userId', component: UserPage }],
			}],
			'http://localhost/org/abc/user/123',
		)
		const { getByTestId } = render(
			<BuzolaProvider router={router} middleware={Middleware} />,
		)
		const paramsText = getByTestId('params').textContent!
		expect(paramsText).toContain('"orgId":"abc"')
		expect(paramsText).toContain('"userId":"123"')
	})

	it('passes matches array to middleware', () => {
		function Middleware({ matches, children }: { matches: unknown[]; children: React.ReactNode }) {
			return <div data-testid="count">{matches.length}{children}</div>
		}
		const { router } = createTestRouter(
			[{
				path: '/a',
				component: () => <Outlet />,
				isLayout: true,
				children: [{ path: '/b', component: () => <div>B</div> }],
			}],
			'http://localhost/a/b',
		)
		const { getByTestId } = render(
			<BuzolaProvider router={router} middleware={Middleware} />,
		)
		expect(getByTestId('count').textContent).toStartWith('2')
	})

	it('updates middleware params on navigation', async () => {
		function Page() {
			return <div>Page</div>
		}
		function Middleware({ params, children }: { params: Record<string, string>; children: React.ReactNode }) {
			return <div data-testid="mid-params">{params.id}{children}</div>
		}
		const { router } = createTestRouter(
			[
				{ path: '/:id', component: Page },
			],
			'http://localhost/first',
		)
		const { getByTestId } = render(
			<BuzolaProvider router={router} middleware={Middleware} />,
		)
		expect(getByTestId('mid-params').textContent).toStartWith('first')

		router.navigate('/second')
		await flushNav()
		expect(getByTestId('mid-params').textContent).toStartWith('second')
	})
})

// ─── useRouter ───────────────────────────────────────────────────────────────

describe('useRouter', () => {
	it('returns the router instance', () => {
		const { router } = createTestRouter([{ path: '/', component: Home, isIndex: true }])
		const { result } = renderHook(() => useRouter(), {
			wrapper: ({ children }) => <BuzolaProvider router={router}>{children}</BuzolaProvider>,
		})
		expect(result.current).toBe(router)
	})

	it('throws when used outside provider', () => {
		expect(() => {
			renderHook(() => useRouter())
		}).toThrow('useRouter must be used within a <BuzolaProvider>')
	})
})

// ─── useParams ───────────────────────────────────────────────────────────────

describe('useParams', () => {
	it('returns route params from context', () => {
		function ParamReader() {
			const params = useParams<{ userId: string }>()
			return <div data-testid="params">{params.userId}</div>
		}

		const { getByTestId } = renderWithRouter(
			<div />,
			[
				{
					path: '/',
					isLayout: true,
					children: [
						{ path: '/users/:userId', component: ParamReader },
					],
				},
			],
			'http://localhost/users/42',
		)

		// Params are on the RouteContext, but our ParamReader is a direct child, not rendered via Outlet.
		// We need to render via Outlet to get the params in context.
	})

	it('returns merged params via Outlet rendering', async () => {
		function ParamDisplay() {
			const params = useParams<{ userId: string }>()
			return <div data-testid="uid">{params.userId}</div>
		}

		const configs: RouteConfig[] = [
			{ path: '/users/:userId', component: ParamDisplay },
		]

		const { router } = createTestRouter(configs, 'http://localhost/users/42')
		const { getByTestId } = render(<BuzolaProvider router={router} />)

		expect(getByTestId('uid').textContent).toBe('42')
	})
})

// ─── useSearchParams ─────────────────────────────────────────────────────────

describe('useSearchParams', () => {
	it('unwraps single-value to string', () => {
		function SearchDisplay() {
			const sp = useSearchParams()
			return <div data-testid="sp">{JSON.stringify(sp)}</div>
		}

		const { getByTestId } = renderWithRouter(
			<SearchDisplay />,
			[{ path: '/', component: Home, isIndex: true }],
			'http://localhost/?foo=bar',
		)

		const parsed = JSON.parse(getByTestId('sp').textContent!)
		expect(parsed.foo).toBe('bar')
	})

	it('keeps multi-value as array', () => {
		function SearchDisplay() {
			const sp = useSearchParams()
			return <div data-testid="sp">{JSON.stringify(sp)}</div>
		}

		const { getByTestId } = renderWithRouter(
			<SearchDisplay />,
			[{ path: '/', component: Home, isIndex: true }],
			'http://localhost/?tag=a&tag=b',
		)

		const parsed = JSON.parse(getByTestId('sp').textContent!)
		expect(parsed.tag).toEqual(['a', 'b'])
	})

	it('validates with schema', () => {
		const schema: StandardSchema<{ q: string }> = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: (value: unknown) => {
					const v = value as Record<string, unknown>
					if (typeof v.q === 'string') return { value: v as { q: string } }
					return { issues: [{ message: 'q is required' }] }
				},
			},
		}

		function SearchDisplay() {
			const sp = useSearchParams(schema)
			return <div data-testid="sp">{sp.q}</div>
		}

		const { getByTestId } = renderWithRouter(
			<SearchDisplay />,
			[{ path: '/', component: Home, isIndex: true }],
			'http://localhost/?q=hello',
		)

		expect(getByTestId('sp').textContent).toBe('hello')
	})

	it('throws on invalid schema', () => {
		const schema: StandardSchema<{ q: string }> = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: () => ({ issues: [{ message: 'invalid' }] }),
			},
		}

		function SearchDisplay() {
			const sp = useSearchParams(schema)
			return <div>{sp.q}</div>
		}

		// Suppress console.error from error boundary
		const spy = spyOn(console, 'error').mockImplementation(() => {})
		expect(() => {
			renderWithRouter(
				<SearchDisplay />,
				[{ path: '/', component: Home, isIndex: true }],
			)
		}).toThrow('Search params validation failed')
		spy.mockRestore()
	})
})

// ─── useRoute ────────────────────────────────────────────────────────────────

describe('useRoute', () => {
	it('returns route info', () => {
		function RouteDisplay() {
			const route = useRoute()
			return (
				<div>
					<span data-testid="pathname">{route.pathname}</span>
					<span data-testid="depth">{route.depth}</span>
					<span data-testid="pending">{String(route.isPending)}</span>
					<span data-testid="matches">{route.matches.length}</span>
				</div>
			)
		}

		const { getByTestId } = renderWithRouter(
			<RouteDisplay />,
			[{ path: '/about', component: About }],
			'http://localhost/about',
		)

		expect(getByTestId('pathname').textContent).toBe('/about')
		expect(getByTestId('depth').textContent).toBe('0')
		expect(getByTestId('pending').textContent).toBe('false')
		expect(getByTestId('matches').textContent).toBe('1')
	})

	it('strips basePath from pathname', () => {
		function RouteDisplay() {
			const route = useRoute()
			return <div data-testid="pathname">{route.pathname}</div>
		}

		const { getByTestId } = renderWithRouter(
			<RouteDisplay />,
			[{ path: '/about', component: About }],
			'http://localhost/app/about',
			{ basePath: '/app' },
		)

		expect(getByTestId('pathname').textContent).toBe('/about')
	})
})

// ─── useRouterState / useNavigationState ─────────────────────────────────────

describe('useRouterState', () => {
	it('returns router state', () => {
		function StateDisplay() {
			const state = useRouterState()
			return <div data-testid="path">{state.location.pathname}</div>
		}

		const { getByTestId } = renderWithRouter(
			<StateDisplay />,
			[{ path: '/about', component: About }],
			'http://localhost/about',
		)

		expect(getByTestId('path').textContent).toBe('/about')
	})
})

describe('useNavigationState', () => {
	it('returns undefined when no state set', () => {
		function StateDisplay() {
			const navState = useNavigationState()
			return <div data-testid="ns">{navState === undefined ? 'none' : 'has'}</div>
		}

		const { getByTestId } = renderWithRouter(
			<StateDisplay />,
			[{ path: '/', component: Home, isIndex: true }],
		)

		expect(getByTestId('ns').textContent).toBe('none')
	})
})

// ─── useNavigate ─────────────────────────────────────────────────────────────

describe('useNavigate', () => {
	it('navigates to a page by ID', async () => {
		function NavButton() {
			const navigate = useNavigate()
			return <button onClick={() => navigate('about' as any)}>Go</button>
		}

		function PathDisplay() {
			const route = useRoute()
			return <div data-testid="path">{route.pathname}</div>
		}

		const { getByText, getByTestId, router } = renderWithRouter(
			<div>
				<NavButton />
				<PathDisplay />
			</div>,
			[
				{ path: '/', component: Home, isIndex: true },
				{ path: '/about', component: About },
			],
			'http://localhost/',
			{ pageRegistry: { about: '/about' } },
		)

		fireEvent.click(getByText('Go'))
		await flushNav()

		expect(getByTestId('path').textContent).toBe('/about')
	})
})

// ─── useInvalidate ───────────────────────────────────────────────────────────

describe('useInvalidate', () => {
	it('calls router.invalidateAll()', () => {
		function InvalidateButton() {
			const invalidate = useInvalidate()
			return <button onClick={invalidate}>Invalidate</button>
		}

		const { getByText, router } = renderWithRouter(
			<InvalidateButton />,
			[{ path: '/', component: Home, isIndex: true }],
		)

		const invalidateSpy = spyOn(router, 'invalidateAll')
		fireEvent.click(getByText('Invalidate'))

		expect(invalidateSpy).toHaveBeenCalledTimes(1)
		invalidateSpy.mockRestore()
	})
})

// ─── Outlet ──────────────────────────────────────────────────────────────────

describe('Outlet', () => {
	it('renders component at current depth', () => {
		const configs: RouteConfig[] = [
			{ path: '/', component: Home, isIndex: true },
		]

		const { router } = createTestRouter(configs)
		const { getByText } = render(<BuzolaProvider router={router} />)
		expect(getByText('Home')).toBeTruthy()
	})

	it('returns null when no match', () => {
		const configs: RouteConfig[] = [
			{ path: '/about', component: About },
		]

		const { router } = createTestRouter(configs, 'http://localhost/missing')
		const { container } = render(<BuzolaProvider router={router} />)
		// The outlet renders null for no match, but BuzolaProvider still renders
		expect(container.textContent).toBe('')
	})

	it('skips componentless nodes', () => {
		const configs: RouteConfig[] = [
			{
				path: '/admin',
				isLayout: true,
				// No component — should be skipped
				children: [
					{ path: '/dashboard', component: () => <div>Dashboard</div> },
				],
			},
		]

		const { router } = createTestRouter(configs, 'http://localhost/admin/dashboard')
		const { getByText } = render(<BuzolaProvider router={router} />)
		expect(getByText('Dashboard')).toBeTruthy()
	})

	it('merges params across nested layouts', () => {
		function Inner() {
			const params = useParams<{ orgId: string; userId: string }>()
			return <div data-testid="params">{params.orgId}-{params.userId}</div>
		}

		const configs: RouteConfig[] = [
			{
				path: '/org/:orgId',
				component: Layout,
				isLayout: true,
				children: [
					{ path: '/users/:userId', component: Inner },
				],
			},
		]

		const { router } = createTestRouter(configs, 'http://localhost/org/acme/users/42')
		const { getByTestId } = render(<BuzolaProvider router={router} />)
		expect(getByTestId('params').textContent).toBe('acme-42')
	})

	it('renders nested layouts', () => {
		function OuterLayout() {
			return (
				<div>
					<div>Outer</div>
					<Outlet />
				</div>
			)
		}

		function InnerLayout() {
			return (
				<div>
					<div>Inner</div>
					<Outlet />
				</div>
			)
		}

		function Page() {
			return <div>Page Content</div>
		}

		const configs: RouteConfig[] = [
			{
				path: '/',
				component: OuterLayout,
				isLayout: true,
				children: [
					{
						path: '/section',
						component: InnerLayout,
						isLayout: true,
						children: [
							{ path: '/page', component: Page },
						],
					},
				],
			},
		]

		const { router } = createTestRouter(configs, 'http://localhost/section/page')
		const { getByText } = render(<BuzolaProvider router={router} />)
		expect(getByText('Outer')).toBeTruthy()
		expect(getByText('Inner')).toBeTruthy()
		expect(getByText('Page Content')).toBeTruthy()
	})
})

// ─── Link ────────────────────────────────────────────────────────────────────

describe('Link', () => {
	const configs: RouteConfig[] = [
		{ path: '/', component: Home, isIndex: true },
		{ path: '/about', component: About },
	]
	const registry = { home: '/', about: '/about' }

	it('renders correct href', () => {
		const { getByText } = renderWithRouter(
			<Link to={'about' as any}>Go</Link>,
			configs,
			'http://localhost/',
			{ pageRegistry: registry },
		)

		const anchor = getByText('Go') as HTMLAnchorElement
		expect(anchor.getAttribute('href')).toBe('/about')
	})

	it('sets data-active on exact match', () => {
		const { getByText } = renderWithRouter(
			<Link to={'about' as any}>Go</Link>,
			configs,
			'http://localhost/about',
			{ pageRegistry: registry },
		)

		const anchor = getByText('Go')
		expect(anchor.hasAttribute('data-active')).toBe(true)
	})

	it('does not set data-active when not matching', () => {
		const { getByText } = renderWithRouter(
			<Link to={'about' as any}>Go</Link>,
			configs,
			'http://localhost/',
			{ pageRegistry: registry },
		)

		const anchor = getByText('Go')
		expect(anchor.hasAttribute('data-active')).toBe(false)
	})

	it('sets data-active on prefix match when activeExact=false', () => {
		const sectionConfigs: RouteConfig[] = [
			{ path: '/docs', component: Home },
			{ path: '/docs/intro', component: About },
		]
		const sectionRegistry = { docs: '/docs', docsIntro: '/docs/intro' }

		const { getByText } = renderWithRouter(
			<Link to={'docs' as any} activeExact={false}>Docs</Link>,
			sectionConfigs,
			'http://localhost/docs/intro',
			{ pageRegistry: sectionRegistry },
		)

		const anchor = getByText('Docs')
		expect(anchor.hasAttribute('data-active')).toBe(true)
	})

	it('ignores clicks with modifier keys', () => {
		const navigateSpy = mock()

		function TestLink() {
			const router = useRouter()
			spyOn(router, 'navigateToPage').mockImplementation(navigateSpy)
			return <Link to={'about' as any} replace>Go</Link>
		}

		const { getByText } = renderWithRouter(
			<TestLink />,
			configs,
			'http://localhost/',
			{ pageRegistry: registry },
		)

		const anchor = getByText('Go')
		fireEvent.click(anchor, { metaKey: true })

		expect(navigateSpy).not.toHaveBeenCalled()
	})

	it('uses programmatic navigation for replace', async () => {
		function TestLink() {
			return <Link to={'about' as any} replace>Go</Link>
		}

		const { getByText, router } = renderWithRouter(
			<TestLink />,
			configs,
			'http://localhost/',
			{ pageRegistry: registry },
		)

		const navigateSpy = spyOn(router, 'navigateToPage')
		fireEvent.click(getByText('Go'))

		expect(navigateSpy).toHaveBeenCalled()
		navigateSpy.mockRestore()
	})

	it('uses programmatic navigation for state', () => {
		function TestLink() {
			return <Link to={'about' as any} state={{ from: 'test' }}>Go</Link>
		}

		const { getByText, router } = renderWithRouter(
			<TestLink />,
			configs,
			'http://localhost/',
			{ pageRegistry: registry },
		)

		const navigateSpy = spyOn(router, 'navigateToPage')
		fireEvent.click(getByText('Go'))

		expect(navigateSpy).toHaveBeenCalledWith(
			'about',
			undefined,
			expect.objectContaining({ state: { from: 'test' } }),
		)
		navigateSpy.mockRestore()
	})
})

// ─── useBlocker ──────────────────────────────────────────────────────────────

describe('useBlocker', () => {
	const configs: RouteConfig[] = [
		{ path: '/', component: Home, isIndex: true },
		{ path: '/about', component: About },
	]

	it('is idle initially', () => {
		const { router } = createTestRouter(configs)
		const { result } = renderHook(() => useBlocker(true), {
			wrapper: ({ children }) => <BuzolaProvider router={router}>{children}</BuzolaProvider>,
		})

		expect(result.current.state).toBe('idle')
	})

	it('blocks navigation', async () => {
		function BlockerComponent() {
			const blocker = useBlocker(true)
			const route = useRoute()
			return (
				<div>
					<div data-testid="state">{blocker.state}</div>
					<div data-testid="path">{route.pathname}</div>
					<button data-testid="proceed" onClick={blocker.proceed}>Proceed</button>
					<button data-testid="reset" onClick={blocker.reset}>Reset</button>
				</div>
			)
		}

		const { getByTestId, router } = renderWithRouter(
			<BlockerComponent />,
			configs,
		)

		expect(getByTestId('state').textContent).toBe('idle')

		// Try to navigate — should be blocked
		router.navigate('/about')
		await flushNav()

		expect(getByTestId('state').textContent).toBe('blocked')
		expect(getByTestId('path').textContent).toBe('/')
	})

	it('proceed() allows blocked navigation', async () => {
		function BlockerComponent() {
			const blocker = useBlocker(true)
			const route = useRoute()
			return (
				<div>
					<div data-testid="state">{blocker.state}</div>
					<div data-testid="path">{route.pathname}</div>
					<button data-testid="proceed" onClick={blocker.proceed}>Proceed</button>
				</div>
			)
		}

		const { getByTestId, router } = renderWithRouter(
			<BlockerComponent />,
			configs,
		)

		router.navigate('/about')
		await flushNav()

		expect(getByTestId('state').textContent).toBe('blocked')

		// Proceed with navigation
		fireEvent.click(getByTestId('proceed'))
		await flushNav()

		expect(getByTestId('state').textContent).toBe('idle')
		expect(getByTestId('path').textContent).toBe('/about')
	})

	it('reset() cancels blocked navigation', async () => {
		function BlockerComponent() {
			const blocker = useBlocker(true)
			const route = useRoute()
			return (
				<div>
					<div data-testid="state">{blocker.state}</div>
					<div data-testid="path">{route.pathname}</div>
					<button data-testid="reset" onClick={blocker.reset}>Reset</button>
				</div>
			)
		}

		const { getByTestId, router } = renderWithRouter(
			<BlockerComponent />,
			configs,
		)

		router.navigate('/about')
		await flushNav()

		expect(getByTestId('state').textContent).toBe('blocked')

		// Cancel navigation
		fireEvent.click(getByTestId('reset'))
		await flushNav()

		expect(getByTestId('state').textContent).toBe('idle')
		expect(getByTestId('path').textContent).toBe('/')
	})

	it('does not block when disabled', async () => {
		function NonBlocker() {
			const blocker = useBlocker(false)
			const route = useRoute()
			return (
				<div>
					<div data-testid="state">{blocker.state}</div>
					<div data-testid="path">{route.pathname}</div>
				</div>
			)
		}

		const { getByTestId, router } = renderWithRouter(
			<NonBlocker />,
			configs,
		)

		router.navigate('/about')
		await flushNav()

		expect(getByTestId('state').textContent).toBe('idle')
		expect(getByTestId('path').textContent).toBe('/about')
	})
})

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
	it('renders children when no error', () => {
		const { getByText } = render(
			<ErrorBoundary>
				<div>OK</div>
			</ErrorBoundary>,
		)
		expect(getByText('OK')).toBeTruthy()
	})

	it('catches errors and shows default fallback', () => {
		function Throw(): React.ReactNode {
			throw new Error('boom')
		}

		const spy = spyOn(console, 'error').mockImplementation(() => {})
		const { container } = render(
			<ErrorBoundary>
				<Throw />
			</ErrorBoundary>,
		)

		expect(container.textContent).toContain('Route error: boom')
		spy.mockRestore()
	})

	it('renders custom ReactNode fallback', () => {
		function Throw(): React.ReactNode {
			throw new Error('boom')
		}

		const spy = spyOn(console, 'error').mockImplementation(() => {})
		const { getByText } = render(
			<ErrorBoundary fallback={<div>Custom Error</div>}>
				<Throw />
			</ErrorBoundary>,
		)

		expect(getByText('Custom Error')).toBeTruthy()
		spy.mockRestore()
	})

	it('renders function fallback with error', () => {
		function Throw(): React.ReactNode {
			throw new Error('kaboom')
		}

		const spy = spyOn(console, 'error').mockImplementation(() => {})
		const { getByText } = render(
			<ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
				<Throw />
			</ErrorBoundary>,
		)

		expect(getByText('Error: kaboom')).toBeTruthy()
		spy.mockRestore()
	})

	it('resets on resetKey change', () => {
		function MaybeThrow({ shouldThrow }: { shouldThrow: boolean }) {
			if (shouldThrow) throw new Error('boom')
			return <div>OK</div>
		}

		const spy = spyOn(console, 'error').mockImplementation(() => {})

		const { rerender, getByText, container } = render(
			<ErrorBoundary resetKey="a">
				<MaybeThrow shouldThrow={true} />
			</ErrorBoundary>,
		)

		expect(container.textContent).toContain('Route error: boom')

		// Change resetKey and stop throwing — should reset
		rerender(
			<ErrorBoundary resetKey="b">
				<MaybeThrow shouldThrow={false} />
			</ErrorBoundary>,
		)

		expect(getByText('OK')).toBeTruthy()
		spy.mockRestore()
	})
})
