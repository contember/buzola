import {
	type BasePluginOptions,
	buildVirtualSource,
	generate,
	isRouteFile,
	type ResolvedOptions,
	resolveOptions,
	resolveVirtualModuleId,
} from '@buzola/codegen'
import * as path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

export interface BuzolaPluginOptions extends BasePluginOptions {}

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
	const { pluginName, id: virtualId } = resolveVirtualModuleId(options.name)
	const resolvedVirtualId = '\0' + virtualId

	let baseOptions: ResolvedOptions
	let virtualSource: string
	let server: ViteDevServer | undefined

	return {
		name: pluginName,
		enforce: 'pre',

		async configResolved(config) {
			baseOptions = await resolveOptions({ ...options, root: config.root })
			virtualSource = buildVirtualSource(baseOptions.outputPath)
		},

		configureServer(srv) {
			server = srv
		},

		async buildStart() {
			if (server) {
				await generate({ ...baseOptions, optional: true, moduleLoader: (p) => server!.ssrLoadModule(p) })
			} else {
				const { createServer } = await import('vite')
				const tempServer = await createServer({
					root: baseOptions.root,
					server: { middlewareMode: true },
					logLevel: 'silent',
					optimizeDeps: { noDiscovery: true },
				})
				try {
					await generate({ ...baseOptions, optional: true, moduleLoader: (p) => tempServer.ssrLoadModule(p) })
				} finally {
					await tempServer.close()
				}
			}
		},

		resolveId(id) {
			if (id === virtualId) {
				return resolvedVirtualId
			}
		},

		load(id) {
			if (id === resolvedVirtualId) {
				return virtualSource
			}
		},

		async handleHotUpdate({ file }) {
			if (!server || !file.startsWith(baseOptions.routesDir) || !isRouteFile(path.basename(file))) return

			const changed = await generate({ ...baseOptions, moduleLoader: (p) => server!.ssrLoadModule(p) })
			if (!changed) return

			const mod = server.moduleGraph.getModuleById(resolvedVirtualId)
			if (mod) {
				server.moduleGraph.invalidateModule(mod)
				return [mod]
			}
		},
	}
}
