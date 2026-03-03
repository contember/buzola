import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { generateConfigTypeAugmentation, generateRouteModule } from './generator/codegen'
import { collectConfigRoutePaths } from './generator/config-parser'
import { scanRouteFiles } from './generator/scanner'
import { buildFileRouteTree } from './generator/tree-builder'

export interface BuzolaPluginOptions {
	/** Path to routes directory, relative to project root. Defaults to "src/routes". */
	routesDir?: string
	/** Path to output generated file, relative to project root. Defaults to "src/buzola.gen.ts". */
	output?: string
	/**
	 * Path to a route config file (relative to project root) that uses `defineRoutes()`.
	 * When set, the plugin uses config-based mode instead of file scanning.
	 * Only the type augmentation is generated — no virtual module or route tree.
	 *
	 * The module must export `routes` as the result of `defineRoutes()`.
	 */
	routeConfigFile?: string
}

const VIRTUAL_MODULE_ID = 'virtual:buzola/routes'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * Vite plugin for Buzola routing.
 *
 * Supports two modes:
 *
 * **File-based** (default):
 * - Scans `src/routes/` for route files
 * - Generates `buzola.gen.ts` with route tree and type augmentation
 * - Provides `virtual:buzola/routes` virtual module
 *
 * **Config-based** (when `routeConfigFile` is set):
 * - Loads the config file via `ssrLoadModule()` at dev time
 * - Extracts route paths from the runtime route tree
 * - Generates `buzola.gen.ts` with type augmentation only
 * - No virtual module (user imports routes directly)
 */
export function buzolaPlugin(options: BuzolaPluginOptions = {}): Plugin {
	const {
		routesDir: routesDirOption = 'src/routes',
		output: outputOption = 'src/buzola.gen.ts',
		routeConfigFile: routeConfigFileOption,
	} = options

	const isConfigMode = !!routeConfigFileOption

	let root: string
	let routesDir: string
	let outputPath: string
	let configFilePath: string
	let server: ViteDevServer | undefined

	function generateFileMode(): boolean {
		const files = scanRouteFiles(routesDir)
		const tree = buildFileRouteTree(files)
		const code = generateRouteModule({
			tree,
			routesDir,
			outputPath,
		})

		return writeIfChanged(outputPath, code)
	}

	async function generateConfigMode(): Promise<boolean> {
		if (!server) return false

		// Invalidate the module so ssrLoadModule picks up the latest version
		const mod = server.moduleGraph.getModuleById(configFilePath)
		if (mod) {
			server.moduleGraph.invalidateModule(mod)
		}

		const exported = await server.ssrLoadModule(configFilePath)
		const routeTree = exported.routes

		if (!Array.isArray(routeTree)) {
			server.config.logger.warn(
				`[buzola] Config file "${routeConfigFileOption}" does not export \`routes\`. Skipping type generation.`,
			)
			return false
		}

		const routes = collectConfigRoutePaths(routeTree)
		const code = generateConfigTypeAugmentation(routes)

		return writeIfChanged(outputPath, code)
	}

	return {
		name: 'buzola',
		enforce: 'pre',

		configResolved(config) {
			root = config.root
			routesDir = path.resolve(root, routesDirOption)
			outputPath = path.resolve(root, outputOption)
			if (routeConfigFileOption) {
				configFilePath = path.resolve(root, routeConfigFileOption)
			}
		},

		configureServer(srv) {
			server = srv

			if (isConfigMode) {
				// Generate types once the server is ready (ssrLoadModule is now available)
				srv.httpServer?.once('listening', () => {
					generateConfigMode()
				})
			}
		},

		buildStart() {
			// File-based mode generates synchronously at build start.
			// Config mode defers to configureServer (needs ssrLoadModule).
			if (!isConfigMode && fs.existsSync(routesDir)) {
				generateFileMode()
			}
		},

		resolveId(id) {
			if (!isConfigMode && id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_ID
			}
		},

		load(id) {
			if (!isConfigMode && id === RESOLVED_VIRTUAL_ID) {
				return `export { routes } from '${outputPath.replace(/\.ts$/, '')}';\n`
			}
		},

		async handleHotUpdate({ file }) {
			if (isConfigMode) {
				// In config mode, watch the config file
				if (file === configFilePath) {
					const changed = await generateConfigMode()
					if (changed && server) {
						server.ws.send({ type: 'full-reload' })
					}
				}
			} else {
				// In file mode, watch the routes directory
				if (file.startsWith(routesDir)) {
					const changed = generateFileMode()

					if (changed && server) {
						const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)
						if (mod) {
							server.moduleGraph.invalidateModule(mod)
						}
						server.ws.send({ type: 'full-reload' })
					}
				}
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
