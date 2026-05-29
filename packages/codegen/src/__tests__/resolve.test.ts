import { describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildVirtualSource, resolveOptions, resolveVirtualModuleId } from '../resolve.js'

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-resolve-test-'))
}

describe('resolveVirtualModuleId', () => {
	it('returns defaults when name is undefined', () => {
		expect(resolveVirtualModuleId(undefined)).toEqual({
			pluginName: 'buzola',
			id: 'virtual:buzola/routes',
		})
	})

	it('includes name in plugin name and virtual module ID', () => {
		expect(resolveVirtualModuleId('admin')).toEqual({
			pluginName: 'buzola:admin',
			id: 'virtual:buzola/admin/routes',
		})
	})
})

describe('buildVirtualSource', () => {
	it('strips trailing .ts and re-exports routes + pageRegistry', () => {
		const source = buildVirtualSource('/abs/path/buzola.gen.ts')
		expect(source).toContain('export { routes, pageRegistry } from')
		expect(source).toContain('"/abs/path/buzola.gen"')
		expect(source).not.toContain('.gen.ts"')
	})

	it('escapes the import path via JSON.stringify', () => {
		const source = buildVirtualSource('/path "with" quotes/buzola.gen.ts')
		const match = source.match(/from (.+?);\n$/)
		expect(match).not.toBeNull()
		expect(JSON.parse(match![1])).toBe('/path "with" quotes/buzola.gen')
	})
})

describe('resolveOptions', () => {
	it('uses built-in defaults when input is empty', async () => {
		const root = makeTempDir()
		try {
			const result = await resolveOptions({ root })
			expect(result.root).toBe(root)
			expect(result.routesDir).toBe(path.join(root, 'src/routes'))
			expect(result.outputPath).toBe(path.join(root, 'src/buzola.gen.ts'))
			expect(result.persistentParams).toBeUndefined()
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('input values override defaults', async () => {
		const root = makeTempDir()
		try {
			const result = await resolveOptions({
				root,
				routesDir: 'app/routes',
				output: 'gen/routes.gen.ts',
				persistentParams: ['lang'],
			})
			expect(result.routesDir).toBe(path.join(root, 'app/routes'))
			expect(result.outputPath).toBe(path.join(root, 'gen/routes.gen.ts'))
			expect(result.persistentParams).toEqual(['lang'])
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('reads buzola.config.ts when input field is absent', async () => {
		const root = makeTempDir()
		try {
			fs.writeFileSync(
				path.join(root, 'buzola.config.ts'),
				`export default {
					routesDir: 'configured/routes',
					output: 'configured/out.gen.ts',
					persistentParams: ['theme'],
				}`,
			)
			const result = await resolveOptions({ root })
			expect(result.routesDir).toBe(path.join(root, 'configured/routes'))
			expect(result.outputPath).toBe(path.join(root, 'configured/out.gen.ts'))
			expect(result.persistentParams).toEqual(['theme'])
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('input overrides config file per-field', async () => {
		const root = makeTempDir()
		try {
			fs.writeFileSync(
				path.join(root, 'buzola.config.ts'),
				`export default { routesDir: 'configured', output: 'configured.gen.ts' }`,
			)
			const result = await resolveOptions({ root, routesDir: 'override' })
			expect(result.routesDir).toBe(path.join(root, 'override'))
			expect(result.outputPath).toBe(path.join(root, 'configured.gen.ts'))
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	it('returns absolute paths', async () => {
		const root = makeTempDir()
		try {
			const result = await resolveOptions({ root, routesDir: './nested/routes' })
			expect(path.isAbsolute(result.routesDir)).toBe(true)
			expect(path.isAbsolute(result.outputPath)).toBe(true)
			expect(path.isAbsolute(result.root)).toBe(true)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})
