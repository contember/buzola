import { buzolaPlugin } from '@buzola/bun-plugin'
import { rm } from 'node:fs/promises'

const outdir = './dist'
await rm(outdir, { recursive: true, force: true })

const plugin = await buzolaPlugin()
try {
	const result = await Bun.build({
		entrypoints: ['./index.html'],
		outdir,
		target: 'browser',
		plugins: [plugin],
		minify: process.env.NODE_ENV === 'production',
	})

	if (!result.success) {
		for (const log of result.logs) console.error(log)
		process.exit(1)
	}

	console.log(`Built ${result.outputs.length} file(s) to ${outdir}`)
} finally {
	plugin.close()
}
