import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buzolaPlugin } from '../plugin.js'

interface CapturedHandlers {
	resolve?: (args: { path: string }) => unknown
	load?: (args: unknown) => { contents: string; loader: string }
}

function captureHandlers(setup: (build: never) => void | Promise<void>): CapturedHandlers {
	const captured: CapturedHandlers = {}
	const mockBuild = {
		onResolve: (_opts: unknown, fn: CapturedHandlers['resolve']) => {
			captured.resolve = fn
		},
		onLoad: (_opts: unknown, fn: CapturedHandlers['load']) => {
			captured.load = fn
		},
	}
	void setup(mockBuild as never)
	return captured
}

function makeEmptyRoutesFixture(): { root: string; cleanup: () => void } {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-bun-test-'))
	fs.mkdirSync(path.join(root, 'routes'))
	return {
		root,
		cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
	}
}

describe('buzolaPlugin (Bun)', () => {
	it('uses default plugin name and virtual module ID', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const plugin = await buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			expect(plugin.name).toBe('buzola')

			const handlers = captureHandlers(plugin.setup)
			expect(handlers.resolve!({ path: 'virtual:buzola/routes' })).toEqual({
				path: 'virtual:buzola/routes',
				namespace: 'buzola',
			})
			expect(handlers.resolve!({ path: 'virtual:buzola/other' })).toBeUndefined()

			plugin.close()
		} finally {
			cleanup()
		}
	})

	it('uses named plugin and virtual module ID when name is set', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const plugin = await buzolaPlugin({
				root,
				routesDir: 'routes',
				output: 'buzola.gen.ts',
				name: 'admin',
			})
			expect(plugin.name).toBe('buzola:admin')

			const handlers = captureHandlers(plugin.setup)
			expect(handlers.resolve!({ path: 'virtual:buzola/admin/routes' })).toEqual({
				path: 'virtual:buzola/admin/routes',
				namespace: 'buzola',
			})
			expect(handlers.resolve!({ path: 'virtual:buzola/routes' })).toBeUndefined()

			plugin.close()
		} finally {
			cleanup()
		}
	})

	it('onLoad returns a ts module re-exporting from the generated file', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const plugin = await buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			const handlers = captureHandlers(plugin.setup)
			const result = handlers.load!({})
			expect(result.loader).toBe('ts')
			expect(result.contents).toContain('export { routes, pageRegistry }')
			expect(result.contents).toContain(JSON.stringify(path.join(root, 'buzola.gen')))
			plugin.close()
		} finally {
			cleanup()
		}
	})

	it('writes buzola.gen.ts on startup when routes dir exists', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const outputPath = path.join(root, 'buzola.gen.ts')
			expect(fs.existsSync(outputPath)).toBe(false)
			const plugin = await buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			expect(fs.existsSync(outputPath)).toBe(true)
			expect(fs.readFileSync(outputPath, 'utf-8')).toContain('pageRegistry')
			plugin.close()
		} finally {
			cleanup()
		}
	})

	it('skips generation when routes dir does not exist', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-bun-test-'))
		try {
			const outputPath = path.join(root, 'buzola.gen.ts')
			const plugin = await buzolaPlugin({ root, routesDir: 'nonexistent', output: 'buzola.gen.ts' })
			expect(fs.existsSync(outputPath)).toBe(false)
			plugin.close()
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('Bun.build resolves virtual:buzola/routes through the plugin', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const entryPath = path.join(root, 'entry.ts')
			fs.writeFileSync(
				entryPath,
				`import { routes, pageRegistry } from 'virtual:buzola/routes'\nexport { routes, pageRegistry }\n`,
			)

			const plugin = await buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })

			const result = await Bun.build({
				entrypoints: [entryPath],
				plugins: [plugin],
				target: 'browser',
				external: ['react', '@buzola/router'],
			})

			expect(result.success).toBe(true)
			expect(result.outputs.length).toBeGreaterThan(0)

			const bundle = await result.outputs[0]!.text()
			expect(bundle).toContain('pageRegistry')
			expect(bundle).toContain('buildRouteTree')

			plugin.close()
		} finally {
			cleanup()
		}
	})
})
