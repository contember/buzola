import * as fs from 'node:fs'
import { generateRouteModule } from './generator/codegen.js'
import type { ModuleLoader } from './generator/page-extractor.js'
import { scanRouteFiles } from './generator/scanner.js'
import { buildFileRouteTree } from './generator/tree-builder.js'

export interface GenerateOptions {
	/** Absolute path to the routes directory. */
	routesDir: string
	/** Absolute path to the output file. */
	outputPath: string
	/** Parameter names that should be persistent across navigations. */
	persistentParams?: string[]
	/** Custom module loader. Defaults to native `import()`. */
	moduleLoader?: ModuleLoader
}

/**
 * Generate the `buzola.gen.ts` route module from a routes directory.
 *
 * Works standalone (no Vite required) — uses native `import()` as the
 * default module loader. Pass a custom `moduleLoader` to integrate with
 * Vite's `ssrLoadModule` or other bundlers.
 *
 * Note: The default module loader uses native `import()`, which can load
 * `.ts`/`.tsx` files with Bun but not with Node.js. For Node.js, provide
 * a custom `moduleLoader` (e.g. via Vite's `ssrLoadModule`).
 *
 * @returns `true` if the output file was written (content changed), `false` otherwise.
 */
export async function generate(options: GenerateOptions): Promise<boolean> {
	const { routesDir, outputPath, persistentParams, moduleLoader = defaultModuleLoader } = options

	if (!fs.existsSync(routesDir)) {
		throw new Error(`Routes directory does not exist: ${routesDir}`)
	}

	const files = scanRouteFiles(routesDir)
	const tree = await buildFileRouteTree(files, moduleLoader)
	const code = generateRouteModule({ tree, routesDir, outputPath, persistentParams })

	return writeIfChanged(outputPath, code)
}

async function defaultModuleLoader(absolutePath: string): Promise<Record<string, unknown>> {
	try {
		return await import(absolutePath)
	} catch (error) {
		throw new Error(
			`Failed to load module "${absolutePath}". The default module loader uses native import() which `
				+ `supports .ts/.tsx files with Bun but not Node.js. For Node.js, provide a custom moduleLoader option.`,
			{ cause: error },
		)
	}
}

function writeIfChanged(filePath: string, content: string): boolean {
	if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === content) {
		return false
	}

	fs.writeFileSync(filePath, content, 'utf-8')
	return true
}
