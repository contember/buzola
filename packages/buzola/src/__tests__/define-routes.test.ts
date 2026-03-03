import { describe, expect, it } from 'bun:test'
import { defineRoutes } from '../define/define-routes'

function dummyComponent() {
	return null
}

describe('defineRoutes', () => {
	it('creates a flat route tree', () => {
		const routes = defineRoutes(route => [
			route('/', { component: dummyComponent }),
			route('/about', { component: dummyComponent }),
		])

		expect(routes).toHaveLength(2)
		expect(routes[0].fullPath).toBe('/')
		expect(routes[1].fullPath).toBe('/about')
	})

	it('creates nested routes', () => {
		const routes = defineRoutes(route => [
			route('/', { component: dummyComponent }, [
				route('/', { component: dummyComponent }),
				route('/about', { component: dummyComponent }),
			]),
		])

		expect(routes).toHaveLength(1)
		expect(routes[0].isLayout).toBe(true)
		expect(routes[0].children).toHaveLength(2)
		expect(routes[0].children[0].fullPath).toBe('/')
		expect(routes[0].children[1].fullPath).toBe('/about')
	})

	it('creates deeply nested routes with params', () => {
		const routes = defineRoutes(route => [
			route('/users', { component: dummyComponent }, [
				route('/', { component: dummyComponent }),
				route('/:userId', { component: dummyComponent }),
			]),
		])

		expect(routes).toHaveLength(1)
		expect(routes[0].fullPath).toBe('/users')
		expect(routes[0].children).toHaveLength(2)
		expect(routes[0].children[1].fullPath).toBe('/users/:userId')
	})
})
