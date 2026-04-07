import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { loadConfig } from './config.js'
import { generate, type GenerateOptions } from './generate.js'

export interface BuzolaPluginOptions {
	/**
	 * Unique name for this plugin instance. Required when registering multiple
	 * entrypoints in the same Vite config. Affects the plugin name
	 * (`buzola:${name}`) and the virtual module ID (`virtual:buzola/${name}/routes`).
	 *
	 * When omitted, the plugin uses `buzola` as its name and
	 * `virtual:buzola/routes` as the virtual module ID.
	 */
	name?: string
	/** Path to routes directory, relative to project root. Defaults to "src/routes". */
	routesDir?: string
	/** Path to output generated file, relative to project root. Defaults to "src/buzola.gen.ts". */
	output?: string
	/**
	 * Parameter names that should be persistent across navigations.
	 * When set, generates a BuzolaPersistentParams type augmentation
	 * so these params become optional in Link and navigate() calls.
	 */
	persistentParams?: string[]
}

/**
 * Vite plugin for Buzola page-centric routing.
 *
 * Scans `src/routes/` for page files using `createPage()`.
 * Generates `buzola.gen.ts` with:
 * - Route tree
 * - Page registry (page ID → route pattern)
 * - BuzolaPageMap type augmentation
 *
 * Provides `virtual:buzola/routes` virtual module.
 *
 * Options can also be provided via `buzola.config.ts` in the project root.
 * Plugin options take precedence over the config file.
 */
export function buzolaPlugin(options: BuzolaPluginOptions = {}): Plugin {
	const { name: nameOption } = options

	const pluginName = nameOption ? `buzola:${nameOption}` : 'buzola'
	const virtualModuleId = nameOption ? `virtual:buzola/${nameOption}/routes` : 'virtual:buzola/routes'
	const resolvedVirtualId = '\0' + virtualModuleId

	let root: string
	let baseOptions: Omit<GenerateOptions, 'moduleLoader'>
	let server: ViteDevServer | undefined

	return {
		name: pluginName,
		enforce: 'pre',

		async configResolved(config) {
			root = config.root
			const fileConfig = await loadConfig(root)

			const routesDir = options.routesDir ?? fileConfig.routesDir ?? 'src/routes'
			const output = options.output ?? fileConfig.output ?? 'src/buzola.gen.ts'
			const persistentParams = options.persistentParams ?? fileConfig.persistentParams

			baseOptions = {
				routesDir: path.resolve(root, routesDir),
				outputPath: path.resolve(root, output),
				persistentParams,
			}
		},

		configureServer(srv) {
			server = srv
		},

		async buildStart() {
			if (!fs.existsSync(baseOptions.routesDir)) return

			if (server) {
				await generate({ ...baseOptions, moduleLoader: (p) => server!.ssrLoadModule(p) })
			} else {
				// Production build — create a temporary Vite server for module loading
				const { createServer } = await import('vite')
				const tempServer = await createServer({
					root,
					server: { middlewareMode: true },
					logLevel: 'silent',
					optimizeDeps: { noDiscovery: true },
				})
				try {
					await generate({ ...baseOptions, moduleLoader: (p) => tempServer.ssrLoadModule(p) })
				} finally {
					await tempServer.close()
				}
			}
		},

		resolveId(id) {
			if (id === virtualModuleId) {
				return resolvedVirtualId
			}
		},

		load(id) {
			if (id === resolvedVirtualId) {
				return `export { routes, pageRegistry } from '${baseOptions.outputPath.replace(/\.ts$/, '')}';\n`
			}
		},

		async handleHotUpdate({ file }) {
			if (!file.startsWith(baseOptions.routesDir) || !server) return

			const changed = await generate({ ...baseOptions, moduleLoader: (p) => server!.ssrLoadModule(p) })
			if (!changed) return

			// Invalidate the virtual module so Vite re-evaluates it.
			// Vite propagates the update through the import chain — if the app
			// supports HMR for the route tree, no full-page reload is needed.
			// If not, Vite falls back to full-reload automatically.
			const mod = server.moduleGraph.getModuleById(resolvedVirtualId)
			if (mod) {
				server.moduleGraph.invalidateModule(mod)
				return [mod]
			}
		},
	}
}
