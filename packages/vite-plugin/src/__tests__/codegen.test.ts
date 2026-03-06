import { describe, expect, it } from 'bun:test'
import { generateRouteModule } from '../generator/codegen'

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
})
