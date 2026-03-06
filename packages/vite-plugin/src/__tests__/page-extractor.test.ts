import { describe, expect, it } from 'bun:test'
import { extractPages } from '../generator/page-extractor'

describe('extractPages', () => {
	it('extracts default page export', async () => {
		const mockModule = {
			default: {
				__buzolaPage: true,
				component: () => null,
				route: '/users/:userId',
				paramsMeta: [
					{ name: 'userId', optional: false },
					{ name: 'tab', optional: true },
				],
			},
		}

		const pages = await extractPages('/fake/path.tsx', async () => mockModule as Record<string, unknown>)

		expect(pages).toHaveLength(1)
		expect(pages[0].exportName).toBe('default')
		expect(pages[0].isDefault).toBe(true)
		expect(pages[0].route).toBe('/users/:userId')
		expect(pages[0].params).toEqual([
			{ name: 'userId', optional: false },
			{ name: 'tab', optional: true },
		])
	})

	it('extracts named page exports', async () => {
		const mockModule = {
			detail: {
				__buzolaPage: true,
				component: () => null,
				route: '/project/:id',
				paramsMeta: [{ name: 'id', optional: false }],
			},
			list: {
				__buzolaPage: true,
				component: () => null,
				route: '/projects',
				paramsMeta: [],
			},
		}

		const pages = await extractPages('/fake/path.tsx', async () => mockModule as Record<string, unknown>)

		expect(pages).toHaveLength(2)
		expect(pages[0].exportName).toBe('detail')
		expect(pages[0].isDefault).toBe(false)
		expect(pages[1].exportName).toBe('list')
	})

	it('skips non-page exports', async () => {
		const mockModule = {
			default: {
				__buzolaPage: true,
				component: () => null,
				route: '/about',
				paramsMeta: [],
			},
			helperFunction: () => 'not a page',
			SOME_CONSTANT: 42,
		}

		const pages = await extractPages('/fake/path.tsx', async () => mockModule as Record<string, unknown>)

		expect(pages).toHaveLength(1)
		expect(pages[0].exportName).toBe('default')
	})

	it('returns empty for module without pages', async () => {
		const mockModule = {
			default: () => null,
		}

		const pages = await extractPages('/fake/path.tsx', async () => mockModule as Record<string, unknown>)
		expect(pages).toEqual([])
	})

	it('handles page without route', async () => {
		const mockModule = {
			default: {
				__buzolaPage: true,
				component: () => null,
				paramsMeta: [],
			},
		}

		const pages = await extractPages('/fake/path.tsx', async () => mockModule as Record<string, unknown>)

		expect(pages).toHaveLength(1)
		expect(pages[0].route).toBeUndefined()
	})
})
