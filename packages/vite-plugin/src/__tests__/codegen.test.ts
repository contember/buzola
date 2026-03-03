import { describe, expect, it } from 'bun:test'
import { generateConfigTypeAugmentation, generateRouteModule } from '../generator/codegen'

describe('generateConfigTypeAugmentation', () => {
	it('emits BuzolaPersistentParams when persistentParams is provided', () => {
		const output = generateConfigTypeAugmentation(
			[{ path: '/:lang/users', params: ['lang'] }],
			['lang'],
		)

		expect(output).toContain('interface BuzolaPersistentParams')
		expect(output).toContain('lang: true;')
	})

	it('does not emit BuzolaPersistentParams without persistentParams', () => {
		const output = generateConfigTypeAugmentation([
			{ path: '/about', params: [] },
		])

		expect(output).not.toContain('BuzolaPersistentParams')
	})

	it('does not emit BuzolaPersistentParams with empty array', () => {
		const output = generateConfigTypeAugmentation(
			[{ path: '/about', params: [] }],
			[],
		)

		expect(output).not.toContain('BuzolaPersistentParams')
	})
})

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
})
