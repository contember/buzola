import * as path from 'node:path'
import type { BuzolaConfig } from './config.js'
import { loadConfig } from './config.js'
import type { GenerateOptions } from './generate.js'

/** Shared base for bundler-plugin option types. */
export interface BasePluginOptions extends BuzolaConfig {
	/**
	 * Unique name for this plugin instance. Required when registering multiple
	 * entrypoints in the same bundler config. Affects the plugin name
	 * (`buzola:${name}`) and the virtual module ID (`virtual:buzola/${name}/routes`).
	 *
	 * When omitted, the plugin uses `buzola` as its name and
	 * `virtual:buzola/routes` as the virtual module ID.
	 */
	name?: string
}

export interface ResolveOptionsInput extends BuzolaConfig {
	/** Project root used to resolve relative paths and locate `buzola.config.*`. Defaults to `process.cwd()`. */
	root?: string
}

export interface ResolvedOptions extends GenerateOptions {
	root: string
}

/**
 * Resolve plugin/CLI input against `buzola.config.*` and built-in defaults.
 * Returns absolute paths plus the resolved project root.
 */
export async function resolveOptions(input: ResolveOptionsInput = {}): Promise<ResolvedOptions> {
	const root = path.resolve(input.root ?? process.cwd())
	const fileConfig = await loadConfig(root)
	return {
		root,
		routesDir: path.resolve(root, input.routesDir ?? fileConfig.routesDir ?? 'src/routes'),
		outputPath: path.resolve(root, input.output ?? fileConfig.output ?? 'src/buzola.gen.ts'),
		persistentParams: input.persistentParams ?? fileConfig.persistentParams,
	}
}

export interface VirtualModuleId {
	/** Plugin name (e.g. `buzola` or `buzola:admin`). */
	pluginName: string
	/** Virtual module ID (e.g. `virtual:buzola/routes` or `virtual:buzola/admin/routes`). */
	id: string
}

/**
 * Derive plugin name and virtual module ID. `name` distinguishes multiple
 * entrypoints in the same bundler config.
 */
export function resolveVirtualModuleId(name: string | undefined): VirtualModuleId {
	return {
		pluginName: name ? `buzola:${name}` : 'buzola',
		id: name ? `virtual:buzola/${name}/routes` : 'virtual:buzola/routes',
	}
}

/**
 * Build the virtual module source — re-exports `routes` and `pageRegistry`
 * from the generated file at `outputPath`.
 */
export function buildVirtualSource(outputPath: string): string {
	const importPath = outputPath.replace(/\.ts$/, '')
	return `export { routes, pageRegistry } from ${JSON.stringify(importPath)};\n`
}
