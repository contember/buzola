import './setup-dom.js'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import React from 'react'
import { lazyRoute } from '../define/lazy-route.js'
import { createMemoryNavigationAdapter } from '../engine/navigation-adapter.js'
import { buildRouteTree } from '../engine/route-tree.js'
import { Router } from '../engine/router.js'
import { BuzolaProvider, Outlet } from '../react/index.js'

afterEach(cleanup)

function About() {
	return <div>About</div>
}

/** Resolves a task later, the way a browser resolves `import()` even for a module it has already loaded. */
function loadAfterATask(): Promise<{ default: typeof About }> {
	return new Promise(resolve => setTimeout(() => resolve({ default: About }), 0))
}

/** Lets the load settle and React render what it unblocked. */
async function settle(route: { preload: () => Promise<unknown> }) {
	await act(async () => {
		await route.preload().catch(() => {})
		await new Promise(resolve => setTimeout(resolve, 0))
	})
}

async function renderRoute(component: React.ComponentType<Record<string, never>>) {
	const fallbacks: string[] = []
	function Fallback() {
		React.useLayoutEffect(() => {
			fallbacks.push('shown')
		}, [])
		return null
	}
	const routes = buildRouteTree([{ path: '/', component, isIndex: true }])
	const router = new Router({ routes, adapter: createMemoryNavigationAdapter({ initialURL: 'http://localhost/' }) })
	// An awaited act: React parks a `use()` suspension made inside a synchronous one and never retries it.
	const { container } = await act(async () =>
		render(
			<BuzolaProvider router={router}>
				<Outlet fallback={<Fallback />} errorFallback={error => <div>Failed: {error.message}</div>} />
			</BuzolaProvider>,
		)
	)
	return { container, fallbacks }
}

describe('lazyRoute', () => {
	it('renders a preloaded route in its first commit, without the fallback', async () => {
		const route = lazyRoute(loadAfterATask)
		await route.preload()

		const { container, fallbacks } = await renderRoute(route.component)

		expect(container.textContent).toBe('About')
		expect(fallbacks).toEqual([])
	})

	it('suspends until a route that was not preloaded loads', async () => {
		const route = lazyRoute(loadAfterATask)

		const { container, fallbacks } = await renderRoute(route.component)
		expect(fallbacks).toEqual(['shown'])

		await settle(route)
		expect(container.textContent).toBe('About')
	})

	it('shares one request between preload and render', async () => {
		const load = mock(loadAfterATask)
		const route = lazyRoute(load)

		route.preload()
		const { container } = await renderRoute(route.component)
		await settle(route)

		expect(container.textContent).toBe('About')
		expect(load).toHaveBeenCalledTimes(1)
	})

	it('a failed load reaches the error boundary without asking again, and the next preload asks again', async () => {
		const load = mock(() => Promise.reject(new Error('chunk missing')))
		const route = lazyRoute(load)

		const { container } = await renderRoute(route.component)
		await act(() => new Promise(resolve => setTimeout(resolve, 0)))
		expect(container.textContent).toBe('Failed: chunk missing')

		expect(load).toHaveBeenCalledTimes(1)

		load.mockImplementation(loadAfterATask)
		expect(await route.preload()).toBe(About)
		expect(load).toHaveBeenCalledTimes(2)
	})
})
