import {
	type BasePluginOptions,
	buildVirtualSource,
	BUZOLA_NAMESPACE,
	generate,
	resolveOptions,
	resolveVirtualModuleId,
	VIRTUAL_ID_PATTERN,
} from '@buzola/codegen'
import type { BunPlugin } from 'bun'

export interface BuzolaPluginOptions extends BasePluginOptions {}

/**
 * Bun plugin for Buzola page-centric routing. Scans the routes directory,
 * generates `buzola.gen.ts`, and exposes the `virtual:buzola/routes` module.
 *
 * Options can also be provided via `buzola.config.ts` in the project root;
 * plugin options take precedence. See `examples/bun` for a `Bun.build` setup.
 */
export function buzolaPlugin(options: BuzolaPluginOptions = {}): BunPlugin {
	const { pluginName, id: virtualId } = resolveVirtualModuleId(options.name)

	return {
		name: pluginName,
		async setup(build) {
			const generateOptions = await resolveOptions(options)
			await generate({ ...generateOptions, optional: true })
			const virtualSource = buildVirtualSource(generateOptions.outputPath)

			build.onResolve({ filter: VIRTUAL_ID_PATTERN }, args => {
				if (args.path !== virtualId) return
				return { path: args.path, namespace: BUZOLA_NAMESPACE }
			})

			build.onLoad({ filter: /.*/, namespace: BUZOLA_NAMESPACE }, () => ({
				contents: virtualSource,
				loader: 'ts',
			}))
		},
	}
}
