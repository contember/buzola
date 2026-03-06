import { describe, expect, it } from 'bun:test'
import { extractPagesFromSource } from '../generator/page-extractor'

describe('extractPagesFromSource', () => {
	it('extracts named export with .route() and .params()', () => {
		const source = `
export const detail = createPage()
	.params(z.object({ id: z.string(), tab: z.string().optional() }))
	.route('/project/:id')
	.render(({ params }) => <div>{params.id}</div>)
`
		const pages = extractPagesFromSource(source)
		expect(pages).toHaveLength(1)
		expect(pages[0].exportName).toBe('detail')
		expect(pages[0].isDefault).toBe(false)
		expect(pages[0].route).toBe('/project/:id')
		expect(pages[0].params).toEqual([
			{ name: 'id', optional: false },
			{ name: 'tab', optional: true },
		])
	})

	it('extracts named export without .route()', () => {
		const source = `
export const list = createPage()
	.render(() => <div>All projects</div>)
`
		const pages = extractPagesFromSource(source)
		expect(pages).toHaveLength(1)
		expect(pages[0].exportName).toBe('list')
		expect(pages[0].route).toBeUndefined()
		expect(pages[0].params).toEqual([])
	})

	it('extracts default export', () => {
		const source = `
export default createPage()
	.route('/about')
	.render(() => <div>About</div>)
`
		const pages = extractPagesFromSource(source)
		expect(pages).toHaveLength(1)
		expect(pages[0].exportName).toBe('default')
		expect(pages[0].isDefault).toBe(true)
		expect(pages[0].route).toBe('/about')
	})

	it('extracts multiple exports from same file', () => {
		const source = `
export const detail = createPage()
	.params(z.object({ id: z.string() }))
	.route('/project/:id')
	.render(({ params }) => <div>{params.id}</div>)

export const list = createPage()
	.render(() => <div>All projects</div>)
`
		const pages = extractPagesFromSource(source)
		expect(pages).toHaveLength(2)
		expect(pages[0].exportName).toBe('detail')
		expect(pages[1].exportName).toBe('list')
	})

	it('returns empty array for file without createPage', () => {
		const source = `
export function MyComponent() {
	return <div>Hello</div>
}
`
		const pages = extractPagesFromSource(source)
		expect(pages).toEqual([])
	})

	it('extracts params with custom schema prefix', () => {
		const source = `
export const detail = createPage()
	.params(s.object({ userId: s.string(), tab: s.optional(s.string()) }))
	.render(({ params }) => null)
`
		const pages = extractPagesFromSource(source)
		expect(pages).toHaveLength(1)
		// "s.optional(s.string())" contains ".optional(" so it's detected as optional
		expect(pages[0].params).toEqual([
			{ name: 'userId', optional: false },
			{ name: 'tab', optional: true },
		])
	})
})
