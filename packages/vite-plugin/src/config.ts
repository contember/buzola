import { createJiti } from 'jiti'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface BuzolaConfig {
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

const CONFIG_FILES = ['buzola.config.ts', 'buzola.config.js', 'buzola.config.mjs']

/**
 * Load buzola config from the project root.
 * Looks for `buzola.config.ts`, `buzola.config.js`, or `buzola.config.mjs`.
 * Uses jiti to support TypeScript configs when running under Node.js.
 *
 * @returns The loaded config, or an empty object if no config file is found.
 */
export async function loadConfig(root: string): Promise<BuzolaConfig> {
	for (const file of CONFIG_FILES) {
		const configPath = path.resolve(root, file)
		if (!fs.existsSync(configPath)) continue

		const jiti = createJiti(configPath)
		const mod = await jiti.import(configPath)
		return (mod as any).default ?? mod
	}

	return {}
}
