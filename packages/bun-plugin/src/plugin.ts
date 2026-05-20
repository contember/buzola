import { type BasePluginOptions, buildVirtualSource, generate, resolveOptions, resolveVirtualModuleId } from '@buzola/codegen'
import type { BunPlugin } from 'bun'
import * as fs from 'node:fs'

export interface BuzolaPluginOptions extends BasePluginOptions {
	/**
	 * Project root used to resolve relative paths and locate `buzola.config.*`.
	 * Defaults to `process.cwd()`.
	 */
	root?: string
}

/**
 * Bun plugin for Buzola page-centric routing.
 *
 * Scans the routes directory for page files using `createPage()`,
 * generates `buzola.gen.ts` with the route tree, page registry,
 * and `BuzolaPageMap` type augmentation, and exposes a
 * `virtual:buzola/routes` virtual module that re-exports
 * `routes` and `pageRegistry` from the generated file.
 *
 * Options can also be provided via `buzola.config.ts` in the project root.
 * Plugin options take precedence over the config file.
 *
 * Usage with `Bun.build`:
 *
 * ```ts
 * import { buzolaPlugin } from '@buzola/bun-plugin'
 *
 * await Bun.build({
 *   entrypoints: ['./index.html'],
 *   outdir: './dist',
 *   target: 'browser',
 *   plugins: [buzolaPlugin()],
 * })
 * ```
 *
 * For live regeneration during development, run your build script under
 * `bun --watch` — `setup()` runs on every build, so changes to route files
 * are picked up automatically on the next build invocation.
 */
export function buzolaPlugin(options: BuzolaPluginOptions = {}): BunPlugin {
	const { pluginName, id: virtualId } = resolveVirtualModuleId(options.name)

	return {
		name: pluginName,
		async setup(build) {
			const generateOptions = await resolveOptions(options)
			if (fs.existsSync(generateOptions.routesDir)) {
				await generate(generateOptions)
			}
			const virtualSource = buildVirtualSource(generateOptions.outputPath)

			build.onResolve({ filter: /^virtual:buzola\// }, args => {
				if (args.path !== virtualId) return
				return { path: args.path, namespace: 'buzola' }
			})

			build.onLoad({ filter: /.*/, namespace: 'buzola' }, () => ({
				contents: virtualSource,
				loader: 'ts',
			}))
		},
	}
}
