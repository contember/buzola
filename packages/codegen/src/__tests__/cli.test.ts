import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// `tsc -b` also compiles this test into dist/, where the CLI beside it is cli.js.
const CLI = path.join(import.meta.dir, '..', `cli${path.extname(import.meta.path)}`)

function runCli(root: string, args: string[]) {
	return Bun.spawnSync(['bun', CLI, '--root', root, ...args], { stdout: 'pipe', stderr: 'pipe' })
}

describe('buzola CLI', () => {
	let root: string

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'buzola-cli-test-'))
		fs.mkdirSync(path.join(root, 'src', 'routes'), { recursive: true })
	})

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	it('writes the same hot update code as the Vite plugin with --hot vite', () => {
		expect(runCli(root, ['--hot', 'vite']).exitCode).toBe(0)
		expect(fs.readFileSync(path.join(root, 'src', 'buzola.gen.ts'), 'utf-8')).toContain('import.meta.hot.accept(')
	})

	it('writes no hot update code by default', () => {
		expect(runCli(root, []).exitCode).toBe(0)
		expect(fs.readFileSync(path.join(root, 'src', 'buzola.gen.ts'), 'utf-8')).not.toContain('import.meta.hot')
	})

	it('refuses a bundler it does not know', () => {
		const result = runCli(root, ['--hot', 'webpack'])
		expect(result.exitCode).toBe(1)
		expect(result.stderr.toString()).toContain('--hot accepts only "vite"')
	})
})
