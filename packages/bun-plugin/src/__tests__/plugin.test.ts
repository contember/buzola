import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buzolaPlugin } from '../plugin.js'

type ResolveHandler = (args: { path: string }) => unknown
type LoadHandler = (args: unknown) => { contents: string; loader: string }

interface CapturedHandlers {
	resolve?: ResolveHandler
	load?: LoadHandler
}

async function runSetup(plugin: { setup: (build: never) => void | Promise<void> }): Promise<CapturedHandlers> {
	const captured: CapturedHandlers = {}
	const mockBuild = {
		onResolve: (_opts: unknown, fn: ResolveHandler) => {
			captured.resolve = fn
		},
		onLoad: (_opts: unknown, fn: LoadHandler) => {
			captured.load = fn
		},
	}
	await plugin.setup(mockBuild as never)
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
			const plugin = buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			expect(plugin.name).toBe('buzola')

			const handlers = await runSetup(plugin)
			expect(handlers.resolve!({ path: 'virtual:buzola/routes' })).toEqual({
				path: 'virtual:buzola/routes',
				namespace: 'buzola',
			})
			expect(handlers.resolve!({ path: 'virtual:buzola/other' })).toBeUndefined()
		} finally {
			cleanup()
		}
	})

	it('uses named plugin and virtual module ID when name is set', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const plugin = buzolaPlugin({
				root,
				routesDir: 'routes',
				output: 'buzola.gen.ts',
				name: 'admin',
			})
			expect(plugin.name).toBe('buzola:admin')

			const handlers = await runSetup(plugin)
			expect(handlers.resolve!({ path: 'virtual:buzola/admin/routes' })).toEqual({
				path: 'virtual:buzola/admin/routes',
				namespace: 'buzola',
			})
			expect(handlers.resolve!({ path: 'virtual:buzola/routes' })).toBeUndefined()
		} finally {
			cleanup()
		}
	})

	it('onLoad returns a ts module re-exporting from the generated file', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const plugin = buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			const handlers = await runSetup(plugin)
			const result = handlers.load!({})
			expect(result.loader).toBe('ts')
			expect(result.contents).toContain('export { routes, pageRegistry }')
			expect(result.contents).toContain(JSON.stringify(path.join(root, 'buzola.gen')))
		} finally {
			cleanup()
		}
	})

	it('writes buzola.gen.ts during setup when routes dir exists', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const outputPath = path.join(root, 'buzola.gen.ts')
			const plugin = buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })
			expect(fs.existsSync(outputPath)).toBe(false)

			await runSetup(plugin)

			expect(fs.existsSync(outputPath)).toBe(true)
			expect(fs.readFileSync(outputPath, 'utf-8')).toContain('pageRegistry')
		} finally {
			cleanup()
		}
	})

	it('skips generation when routes dir does not exist', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-bun-test-'))
		try {
			const outputPath = path.join(root, 'buzola.gen.ts')
			const plugin = buzolaPlugin({ root, routesDir: 'nonexistent', output: 'buzola.gen.ts' })

			await runSetup(plugin)

			expect(fs.existsSync(outputPath)).toBe(false)
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

			const result = await Bun.build({
				entrypoints: [entryPath],
				plugins: [buzolaPlugin({ root, routesDir: 'routes', output: 'buzola.gen.ts' })],
				target: 'browser',
				external: ['react', '@buzola/router'],
			})

			expect(result.success).toBe(true)
			expect(result.outputs.length).toBeGreaterThan(0)

			const bundle = await result.outputs[0]!.text()
			expect(bundle).toContain('pageRegistry')
			expect(bundle).toContain('buildRouteTree')
		} finally {
			cleanup()
		}
	})
})
