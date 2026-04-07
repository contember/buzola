#!/usr/bin/env node
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { generate } from './generate.js'

const { values } = parseArgs({
	options: {
		'routes-dir': { type: 'string', short: 'r', default: 'src/routes' },
		output: { type: 'string', short: 'o', default: 'src/buzola.gen.ts' },
		'persistent-param': { type: 'string', multiple: true },
		root: { type: 'string' },
	},
	strict: true,
})

const root = path.resolve(values.root ?? process.cwd())
const routesDir = path.resolve(root, values['routes-dir']!)
const outputPath = path.resolve(root, values.output!)
const persistentParams = values['persistent-param']

const changed = await generate({ routesDir, outputPath, persistentParams })

if (changed) {
	console.log(`Generated ${path.relative(root, outputPath)}`)
} else {
	console.log('No changes')
}
