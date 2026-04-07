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
 * @returns `true` if the output file was written (content changed), `false` otherwise.
 */
export async function generate(options: GenerateOptions): Promise<boolean> {
	const { routesDir, outputPath, persistentParams, moduleLoader = (p: string) => import(p) } = options

	if (!fs.existsSync(routesDir)) return false

	const files = scanRouteFiles(routesDir)
	const tree = await buildFileRouteTree(files, moduleLoader)
	const code = generateRouteModule({ tree, routesDir, outputPath, persistentParams })

	return writeIfChanged(outputPath, code)
}

export function writeIfChanged(filePath: string, content: string): boolean {
	if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === content) {
		return false
	}

	fs.writeFileSync(filePath, content, 'utf-8')
	return true
}
