import * as fs from 'node:fs'

export interface ExtractedPage {
	/** Export name (e.g., "detail", "list"). "default" for default exports. */
	exportName: string
	/** Explicit route pattern from .route('...'), if present. */
	route?: string
	/** Whether this is a default export. */
	isDefault: boolean
	/** Extracted param info from .params(z.object({...})). */
	params: ExtractedParam[]
}

export interface ExtractedParam {
	name: string
	optional: boolean
}

/**
 * Statically extract createPage() metadata from a source file.
 * Scans for `export const <name> = createPage()` and `export default createPage()`.
 * Extracts `.route('...')` string literal and `.params(...)` object keys.
 */
export function extractPages(filePath: string): ExtractedPage[] {
	const source = fs.readFileSync(filePath, 'utf-8')
	return extractPagesFromSource(source)
}

/**
 * Extract createPage() metadata from source code string.
 */
export function extractPagesFromSource(source: string): ExtractedPage[] {
	const pages: ExtractedPage[] = []

	// Match: export const <name> = createPage()
	const namedExportRegex = /export\s+const\s+(\w+)\s*=\s*createPage\s*\(\s*\)/g
	let match: RegExpExecArray | null

	while ((match = namedExportRegex.exec(source)) !== null) {
		const exportName = match[1]
		const chainStart = match.index + match[0].length
		const chain = extractChain(source, chainStart)
		pages.push({
			exportName,
			isDefault: false,
			route: extractRoute(chain),
			params: extractParams(chain),
		})
	}

	// Match: export default createPage()
	const defaultExportRegex = /export\s+default\s+createPage\s*\(\s*\)/g
	while ((match = defaultExportRegex.exec(source)) !== null) {
		const chainStart = match.index + match[0].length
		const chain = extractChain(source, chainStart)
		pages.push({
			exportName: 'default',
			isDefault: true,
			route: extractRoute(chain),
			params: extractParams(chain),
		})
	}

	return pages
}

/**
 * Extract the method chain after createPage() up to the .render() call.
 */
function extractChain(source: string, startIndex: number): string {
	// We need to find the extent of the chain. The chain ends at .render(...)
	// We'll grab a reasonable chunk and parse it.
	// Find .render( and then find its matching closing paren
	const chunk = source.slice(startIndex, startIndex + 2000)
	const renderIndex = chunk.indexOf('.render(')
	if (renderIndex === -1) return chunk
	return chunk.slice(0, renderIndex)
}

/**
 * Extract .route('...') string literal from chain.
 */
function extractRoute(chain: string): string | undefined {
	const routeRegex = /\.route\(\s*(['"`])([^'"`]*)\1\s*\)/
	const match = routeRegex.exec(chain)
	return match ? match[2] : undefined
}

/**
 * Extract param info from .params(z.object({...})) or .params(s.object({...})) etc.
 */
function extractParams(chain: string): ExtractedParam[] {
	// Match .params( followed by anything.object({ ... })
	const paramsRegex = /\.params\(\s*\w+\.object\(\s*\{([^}]*)\}\s*\)/
	const match = paramsRegex.exec(chain)
	if (!match) return []

	const objectBody = match[1]
	return extractObjectKeys(objectBody)
}

/**
 * Extract keys and optionality from an object literal body.
 * Handles patterns like: `id: z.string(), tab: z.string().optional()`
 */
function extractObjectKeys(body: string): ExtractedParam[] {
	const params: ExtractedParam[] = []
	// Match key: value pairs. Key can be a simple identifier.
	const keyRegex = /(\w+)\s*:\s*([^,}]+)/g
	let match: RegExpExecArray | null

	while ((match = keyRegex.exec(body)) !== null) {
		const name = match[1]
		const valuePart = match[2].trim()
		const optional = valuePart.includes('.optional(')
		params.push({ name, optional })
	}

	return params
}
