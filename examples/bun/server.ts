import * as path from 'node:path'

const dist = './dist'
const indexHtml = Bun.file(path.join(dist, 'index.html'))

if (!await indexHtml.exists()) {
	console.error('dist/index.html not found — run "bun run build" first.')
	process.exit(1)
}

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3174),
	async fetch(req) {
		const url = new URL(req.url)
		const filePath = url.pathname === '/' ? '/index.html' : url.pathname
		const candidate = Bun.file(path.join(dist, filePath))
		if (await candidate.exists()) return new Response(candidate)
		// SPA fallback — unknown paths without an extension fall back to index.html
		// so the client-side router can resolve them.
		if (!path.extname(filePath)) return new Response(indexHtml)
		return new Response('Not Found', { status: 404 })
	},
})

console.log(`Buzola Bun example — ${server.url}`)
