#!/usr/bin/env node
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { loadConfig } from './config.js'
import { generate } from './generate.js'

const { values } = parseArgs({
	options: {
		'routes-dir': { type: 'string', short: 'r' },
		output: { type: 'string', short: 'o' },
		'persistent-param': { type: 'string', multiple: true },
		root: { type: 'string' },
	},
	strict: true,
})

const root = path.resolve(values.root ?? process.cwd())
const fileConfig = await loadConfig(root)

const routesDir = path.resolve(root, values['routes-dir'] ?? fileConfig.routesDir ?? 'src/routes')
const outputPath = path.resolve(root, values.output ?? fileConfig.output ?? 'src/buzola.gen.ts')
const persistentParams = values['persistent-param'] ?? fileConfig.persistentParams

const changed = await generate({ routesDir, outputPath, persistentParams })

if (changed) {
	console.log(`Generated ${path.relative(root, outputPath)}`)
} else {
	console.log('No changes')
}
