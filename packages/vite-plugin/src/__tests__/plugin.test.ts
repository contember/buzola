import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { build } from 'vite'
import { buzolaPlugin } from '../plugin.js'

// vite's build() returns RollupOutput[] (one per format) for non-watch builds.
// RollupOutput isn't re-exported from 'vite', so we declare a minimal shape here.
type BuildResult = { output: { type: string; code?: string }[] }[]

function makeEmptyRoutesFixture(): { root: string; cleanup: () => void } {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-vite-test-'))
	fs.mkdirSync(path.join(root, 'routes'))
	return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

function writeEntry(root: string, body: string): string {
	const entryPath = path.join(root, 'entry.ts')
	fs.writeFileSync(entryPath, body)
	return entryPath
}

describe('buzolaPlugin (Vite)', () => {
	it('vite build resolves virtual:buzola/routes through the plugin', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const entryPath = writeEntry(
				root,
				`import { routes, pageRegistry } from 'virtual:buzola/routes'\nexport { routes, pageRegistry }\n`,
			)

			const result = await build({
				root,
				plugins: [buzolaPlugin({ routesDir: 'routes', output: 'buzola.gen.ts' })],
				build: {
					lib: { entry: entryPath, formats: ['es'], fileName: 'bundle' },
					outDir: path.join(root, 'dist'),
					write: false,
					rollupOptions: { external: ['react', '@buzola/router'] },
				},
				logLevel: 'silent',
			}) as BuildResult

			const chunk = result[0]!.output.find((o) => o.type === 'chunk')
			expect(chunk).toBeDefined()
			expect(chunk!.code).toContain('pageRegistry')
			expect(chunk!.code).toContain('buildRouteTree')
		} finally {
			cleanup()
		}
	})

	it('vite build resolves named virtual module ID', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const entryPath = writeEntry(
				root,
				`import { routes, pageRegistry } from 'virtual:buzola/admin/routes'\nexport { routes, pageRegistry }\n`,
			)

			const result = await build({
				root,
				plugins: [buzolaPlugin({ name: 'admin', routesDir: 'routes', output: 'buzola.gen.ts' })],
				build: {
					lib: { entry: entryPath, formats: ['es'], fileName: 'bundle' },
					outDir: path.join(root, 'dist'),
					write: false,
					rollupOptions: { external: ['react', '@buzola/router'] },
				},
				logLevel: 'silent',
			}) as BuildResult

			const chunk = result[0]!.output.find((o) => o.type === 'chunk')
			expect(chunk).toBeDefined()
			expect(chunk!.code).toContain('pageRegistry')
		} finally {
			cleanup()
		}
	})

	it('writes buzola.gen.ts during vite build', async () => {
		const { root, cleanup } = makeEmptyRoutesFixture()
		try {
			const entryPath = writeEntry(root, `export const x = 1\n`)
			const outputPath = path.join(root, 'buzola.gen.ts')
			expect(fs.existsSync(outputPath)).toBe(false)

			await build({
				root,
				plugins: [buzolaPlugin({ routesDir: 'routes', output: 'buzola.gen.ts' })],
				build: {
					lib: { entry: entryPath, formats: ['es'], fileName: 'bundle' },
					outDir: path.join(root, 'dist'),
					write: false,
				},
				logLevel: 'silent',
			})

			expect(fs.existsSync(outputPath)).toBe(true)
			expect(fs.readFileSync(outputPath, 'utf-8')).toContain('pageRegistry')
		} finally {
			cleanup()
		}
	})

	it('vite build succeeds when routes dir does not exist', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-vite-test-'))
		try {
			const entryPath = writeEntry(root, `export const x = 1\n`)

			const result = await build({
				root,
				plugins: [buzolaPlugin({ routesDir: 'nonexistent', output: 'buzola.gen.ts' })],
				build: {
					lib: { entry: entryPath, formats: ['es'], fileName: 'bundle' },
					outDir: path.join(root, 'dist'),
					write: false,
				},
				logLevel: 'silent',
			}) as BuildResult

			expect(result[0]!.output.length).toBeGreaterThan(0)
			expect(fs.existsSync(path.join(root, 'buzola.gen.ts'))).toBe(false)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})
