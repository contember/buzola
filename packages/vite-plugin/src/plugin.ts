import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { generateRouteModule } from './generator/codegen'
import { scanRouteFiles } from './generator/scanner'
import { buildFileRouteTree } from './generator/tree-builder'

export interface BuzolaPluginOptions {
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

const VIRTUAL_MODULE_ID = 'virtual:buzola/routes'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID

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
		routesDir: routesDirOption = 'src/routes',
		output: outputOption = 'src/buzola.gen.ts',
		persistentParams: persistentParamsOption,
	} = options

	let root: string
	let routesDir: string
	let outputPath: string
	let server: ViteDevServer | undefined

	function generate(): boolean {
		const files = scanRouteFiles(routesDir)
		const tree = buildFileRouteTree(files)
		const code = generateRouteModule({
			tree,
			routesDir,
			outputPath,
			persistentParams: persistentParamsOption,
		})

		return writeIfChanged(outputPath, code)
	}

	return {
		name: 'buzola',
		enforce: 'pre',

		configResolved(config) {
			root = config.root
			routesDir = path.resolve(root, routesDirOption)
			outputPath = path.resolve(root, outputOption)
		},

		configureServer(srv) {
			server = srv
		},

		buildStart() {
			if (fs.existsSync(routesDir)) {
				generate()
			}
		},

		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_ID
			}
		},

		load(id) {
			if (id === RESOLVED_VIRTUAL_ID) {
				return `export { routes, pageRegistry } from '${outputPath.replace(/\.ts$/, '')}';\n`
			}
		},

		async handleHotUpdate({ file }) {
			if (file.startsWith(routesDir)) {
				const changed = generate()

				if (changed && server) {
					const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID)
					if (mod) {
						server.moduleGraph.invalidateModule(mod)
					}
					server.ws.send({ type: 'full-reload' })
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
