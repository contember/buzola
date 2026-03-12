import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { generateRouteModule } from './generator/codegen.js'
import type { ModuleLoader } from './generator/page-extractor.js'
import { scanRouteFiles } from './generator/scanner.js'
import { buildFileRouteTree } from './generator/tree-builder.js'

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
 */
export function buzolaPlugin(options: BuzolaPluginOptions = {}): Plugin {
	const {
		name: nameOption,
		routesDir: routesDirOption = 'src/routes',
		output: outputOption = 'src/buzola.gen.ts',
		persistentParams: persistentParamsOption,
	} = options

	const pluginName = nameOption ? `buzola:${nameOption}` : 'buzola'
	const virtualModuleId = nameOption ? `virtual:buzola/${nameOption}/routes` : 'virtual:buzola/routes'
	const resolvedVirtualId = '\0' + virtualModuleId

	let root: string
	let routesDir: string
	let outputPath: string
	let server: ViteDevServer | undefined

	async function generate(moduleLoader: ModuleLoader): Promise<boolean> {
		const files = scanRouteFiles(routesDir)
		const tree = await buildFileRouteTree(files, moduleLoader)
		const code = generateRouteModule({
			tree,
			routesDir,
			outputPath,
			persistentParams: persistentParamsOption,
		})

		return writeIfChanged(outputPath, code)
	}

	return {
		name: pluginName,
		enforce: 'pre',

		configResolved(config) {
			root = config.root
			routesDir = path.resolve(root, routesDirOption)
			outputPath = path.resolve(root, outputOption)
		},

		configureServer(srv) {
			server = srv
		},

		async buildStart() {
			if (!fs.existsSync(routesDir)) return

			if (server) {
				await generate((p) => server!.ssrLoadModule(p))
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
					await generate((p) => tempServer.ssrLoadModule(p))
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
				return `export { routes, pageRegistry } from '${outputPath.replace(/\.ts$/, '')}';\n`
			}
		},

		async handleHotUpdate({ file }) {
			if (!file.startsWith(routesDir) || !server) return

			const changed = await generate((p) => server!.ssrLoadModule(p))

			if (changed) {
				const mod = server.moduleGraph.getModuleById(resolvedVirtualId)
				if (mod) {
					server.moduleGraph.invalidateModule(mod)
				}
				server.ws.send({ type: 'full-reload' })
			}
		},
	}
}

function writeIfChanged(filePath: string, content: string): boolean {
	if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf-8') === content) {
		return false
	}

	fs.writeFileSync(filePath, content, 'utf-8')
	return true
}
