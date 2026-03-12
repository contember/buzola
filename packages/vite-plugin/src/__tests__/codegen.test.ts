import { describe, expect, it } from 'bun:test'
import { generateRouteModule } from '../generator/codegen.js'

describe('generateRouteModule', () => {
	it('emits BuzolaPersistentParams when persistentParams is provided', () => {
		const output = generateRouteModule({
			tree: [],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
			persistentParams: ['lang'],
		})

		expect(output).toContain('interface BuzolaPersistentParams')
		expect(output).toContain('lang: true;')
	})

	it('does not emit BuzolaPersistentParams without persistentParams', () => {
		const output = generateRouteModule({
			tree: [],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		expect(output).not.toContain('BuzolaPersistentParams')
	})

	it('emits BuzolaPageMap interface', () => {
		const output = generateRouteModule({
			tree: [],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		expect(output).toContain('interface BuzolaPageMap')
	})

	it('emits pageRegistry export', () => {
		const output = generateRouteModule({
			tree: [],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		expect(output).toContain('export const pageRegistry')
	})

	it('generates correct lazy import for default export', () => {
		const output = generateRouteModule({
			tree: [{
				segment: 'users',
				fullPath: '/users',
				filePath: '/tmp/routes/users.tsx',
				exportName: 'default',
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				pageExports: [{ pageId: 'users', exportName: 'default', routePattern: '/users', params: [] }],
				children: [],
			}],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		expect(output).toContain('.then(m => ({ default: m.default.component }))')
	})

	it('generates correct lazy import for named export', () => {
		const output = generateRouteModule({
			tree: [{
				segment: 'users',
				fullPath: '/users',
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				children: [{
					segment: 'detail',
					fullPath: '/users/detail',
					filePath: '/tmp/routes/users.tsx',
					exportName: 'detail',
					isLayout: false,
					isIndex: false,
					isNotFound: false,
					isPathlessGroup: false,
					pageExports: [{ pageId: 'users/detail', exportName: 'detail', routePattern: '/users/detail', params: [] }],
					children: [],
				}],
			}],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		expect(output).toContain('.then(m => ({ default: m.detail.component }))')
		expect(output).toContain("'users/detail': '/users/detail'")
	})

	it('generates separate imports for default and named exports from same file', () => {
		const output = generateRouteModule({
			tree: [{
				segment: 'users',
				fullPath: '/users',
				filePath: '/tmp/routes/users.tsx',
				exportName: 'default',
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				pageExports: [{ pageId: 'users', exportName: 'default', routePattern: '/users', params: [] }],
				children: [{
					segment: 'detail',
					fullPath: '/users/detail',
					filePath: '/tmp/routes/users.tsx',
					exportName: 'detail',
					isLayout: false,
					isIndex: false,
					isNotFound: false,
					isPathlessGroup: false,
					pageExports: [{ pageId: 'users/detail', exportName: 'detail', routePattern: '/users/detail', params: [] }],
					children: [],
				}],
			}],
			routesDir: '/tmp/routes',
			outputPath: '/tmp/buzola.gen.ts',
		})

		// Two separate import lines for the same file
		expect(output).toContain('m.default.component')
		expect(output).toContain('m.detail.component')
		// Both in page registry
		expect(output).toContain("'users': '/users'")
		expect(output).toContain("'users/detail': '/users/detail'")
	})
})
