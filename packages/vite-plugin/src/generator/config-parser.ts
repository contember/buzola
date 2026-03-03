export interface ConfigRoutePath {
	path: string
	params: string[]
}

/**
 * Minimal shape of a RouteNode — only the fields we need for path extraction.
 * Avoids importing the full buzola types at build time.
 */
interface RouteNodeLike {
	fullPath: string
	isLayout: boolean
	children: RouteNodeLike[]
}

/**
 * Extract route paths from a runtime route tree (result of `defineRoutes()`).
 *
 * Walks the tree and collects `fullPath` + extracted param names for each
 * non-layout route. Layout routes are excluded — they are not navigable destinations.
 */
export function collectConfigRoutePaths(nodes: RouteNodeLike[]): ConfigRoutePath[] {
	const results: ConfigRoutePath[] = []

	function walk(node: RouteNodeLike): void {
		if (!node.isLayout) {
			results.push({
				path: node.fullPath,
				params: extractParams(node.fullPath),
			})
		}

		for (const child of node.children) {
			walk(child)
		}
	}

	for (const node of nodes) {
		walk(node)
	}

	return results
}

function extractParams(fullPath: string): string[] {
	const params: string[] = []
	// Match :paramName or :paramName+ (catch-all)
	const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)\+?/g
	let match: RegExpExecArray | null
	while ((match = regex.exec(fullPath)) !== null) {
		params.push(match[1])
	}
	return params
}
