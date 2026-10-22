#!/usr/bin/env node
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import { generate } from './generate.js'
import { resolveOptions } from './resolve.js'

const { values } = parseArgs({
	options: {
		'routes-dir': { type: 'string', short: 'r' },
		output: { type: 'string', short: 'o' },
		'persistent-param': { type: 'string', multiple: true },
		root: { type: 'string' },
		hot: { type: 'string' },
		help: { type: 'boolean', short: 'h', default: false },
	},
	strict: true,
})

if (values.help) {
	console.log(`Usage: buzola-generate [options]

Options:
  -r, --routes-dir <path>         Routes directory (default: src/routes)
  -o, --output <path>             Output file path (default: src/buzola.gen.ts)
      --persistent-param <name>   Persistent parameter name (repeatable)
      --root <path>               Project root directory (default: cwd)
      --hot vite                  Emit Vite hot update code, as the Vite plugin does
  -h, --help                      Show this help message`)
	process.exit(0)
}

const hot = values.hot
if (hot !== undefined && hot !== 'vite') {
	console.error(`--hot accepts only "vite", got "${hot}"`)
	process.exit(1)
}

const options = await resolveOptions({
	root: values.root,
	routesDir: values['routes-dir'],
	output: values.output,
	persistentParams: values['persistent-param'],
})

const changed = await generate({ ...options, hot })

if (changed) {
	console.log(`Generated ${path.relative(options.root, options.outputPath)}`)
} else {
	console.log('No changes')
}
