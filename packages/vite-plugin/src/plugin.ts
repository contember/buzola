import { type BasePluginOptions, buildVirtualSource, generate, type ResolvedOptions, resolveOptions, resolveVirtualModuleId } from '@buzola/codegen'
import * as fs from 'node:fs'
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
			baseOptions = await resolveOptions({ root: config.root, ...options })
			virtualSource = buildVirtualSource(baseOptions.outputPath)
		},

		configureServer(srv) {
			server = srv
		},

		async buildStart() {
			if (!fs.existsSync(baseOptions.routesDir)) return

			if (server) {
				await generate({ ...baseOptions, moduleLoader: (p) => server!.ssrLoadModule(p) })
			} else {
				const { createServer } = await import('vite')
				const tempServer = await createServer({
					root: baseOptions.root,
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
