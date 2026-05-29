import * as path from 'node:path'

const dist = './dist'
const indexHtml = Bun.file(path.join(dist, 'index.html'))

if (!await indexHtml.exists()) {
	console.error('dist/index.html not found — run "bun run build" first.')
	process.exit(1)
}

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3174),
	fetch(req) {
		const url = new URL(req.url)
		const filePath = url.pathname === '/' ? '/index.html' : url.pathname
		// Extensionless paths fall back to index.html so the client router can resolve them;
		// everything else hits a static file (Bun.serve returns 404 if missing).
		if (!path.extname(filePath)) return new Response(indexHtml)
		return new Response(Bun.file(path.join(dist, filePath)))
	},
})

console.log(`Buzola Bun example — ${server.url}`)
