import {
	type BasePluginOptions,
	buildVirtualSource,
	generate,
	type GenerateOptions,
	isRouteFile,
	resolveOptions,
	resolveVirtualModuleId,
} from '@buzola/codegen'
import type { BunPlugin } from 'bun'
import * as fs from 'node:fs'

export interface BuzolaPluginOptions extends BasePluginOptions {
	/**
	 * Project root used to resolve relative paths and locate `buzola.config.*`.
	 * Defaults to `process.cwd()`.
	 */
	root?: string
	/**
	 * When true, watch the routes directory and regenerate on changes.
	 * Defaults to false. Pair with `bun --hot` / `bun --watch` so the
	 * regenerated `buzola.gen.ts` is picked up by the app.
	 *
	 * Vite's adapter doesn't expose this option because its `handleHotUpdate`
	 * hook is the watch signal; Bun's plugin API has no equivalent, so we
	 * roll our own `fs.watch`.
	 */
	watch?: boolean
}

export interface BuzolaBunPlugin extends BunPlugin {
	/**
	 * Stop the file watcher started when `watch: true` (no-op otherwise).
	 * Vite's adapter has no equivalent because Vite tears its plugin context
	 * down via its own lifecycle; Bun's plugin API offers no shutdown hook.
	 */
	close(): void
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
 * Usage (preload via `bunfig.toml`):
 *
 * ```ts
 * // buzola.preload.ts
 * import { buzolaPlugin } from '@buzola/bun-plugin'
 * Bun.plugin(await buzolaPlugin())
 * ```
 *
 * ```toml
 * # bunfig.toml
 * preload = ["./buzola.preload.ts"]
 * ```
 */
export async function buzolaPlugin(options: BuzolaPluginOptions = {}): Promise<BuzolaBunPlugin> {
	const generateOptions = await resolveOptions(options)
	const { pluginName, id: virtualId } = resolveVirtualModuleId(options.name)
	const virtualSource = buildVirtualSource(generateOptions.outputPath)

	const routesDirExists = fs.existsSync(generateOptions.routesDir)
	if (routesDirExists) {
		await generate(generateOptions)
	}

	const watcher = options.watch && routesDirExists ? startWatcher(generateOptions) : null

	return {
		name: pluginName,
		setup(build) {
			build.onResolve({ filter: /^virtual:buzola\// }, args => {
				if (args.path !== virtualId) return
				return { path: args.path, namespace: 'buzola' }
			})

			build.onLoad({ filter: /.*/, namespace: 'buzola' }, () => ({
				contents: virtualSource,
				loader: 'ts',
			}))
		},
		close() {
			watcher?.close()
		},
	}
}

interface Watcher {
	close(): void
}

function startWatcher(options: GenerateOptions): Watcher {
	let pending: Promise<unknown> | null = null
	let rerun = false
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	const run = (): void => {
		if (pending) {
			rerun = true
			return
		}
		pending = (async () => {
			do {
				rerun = false
				try {
					await generate(options)
				} catch (err) {
					console.error('[buzola] regenerate failed:', err)
				}
			} while (rerun)
			pending = null
		})()
	}

	const fsWatcher = fs.watch(options.routesDir, { recursive: true }, (_event, filename) => {
		// fs.watch on macOS/Linux fires 2-4 events per save (atomic rename + change,
		// editor swap files). Trailing debounce collapses these into one regen.
		if (filename && !isRouteFile(filename)) return
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(run, 75)
	})
	fsWatcher.unref()

	return {
		close() {
			fsWatcher.close()
			if (debounceTimer) clearTimeout(debounceTimer)
		},
	}
}
