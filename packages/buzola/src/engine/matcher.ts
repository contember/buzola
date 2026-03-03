import type { RouteMatch, RouteNode } from './types'

/**
 * Match a URL against the route tree.
 * Returns an array of RouteMatch from root layout to leaf page, or null if no match.
 * Performs depth-first matching.
 */
export function matchRoutes(nodes: RouteNode[], url: URL): RouteMatch[] | null {
	const pathname = url.pathname

	for (const node of nodes) {
		const result = matchNode(node, pathname)
		if (result) return result
	}

	return null
}

function matchNode(node: RouteNode, pathname: string): RouteMatch[] | null {
	// Layout nodes: try to match children, prepend self if any child matches
	if (node.isLayout && !node.isIndex) {
		for (const child of node.children) {
			const childMatch = matchNode(child, pathname)
			if (childMatch) {
				// Layout is part of the match chain
				const layoutMatch: RouteMatch = {
					node,
					params: extractLayoutParams(node, pathname),
					pathname,
				}
				return [layoutMatch, ...childMatch]
			}
		}
		return null
	}

	// Leaf/index nodes: try to match the URLPattern
	if (node.pattern) {
		const result = node.pattern.exec({ pathname })
		if (result) {
			const params = extractParamsFromResult(result)
			const match: RouteMatch = { node, params, pathname }

			// If this node has children (e.g., a page with nested routes), try them too
			if (node.children.length > 0) {
				for (const child of node.children) {
					const childMatch = matchNode(child, pathname)
					if (childMatch) {
						return [match, ...childMatch]
					}
				}
			}

			return [match]
		}
	}

	return null
}

/**
 * Extract params from a URLPattern exec result.
 */
function extractParamsFromResult(result: URLPatternResult): Record<string, string> {
	const params: Record<string, string> = {}
	const groups = result.pathname.groups
	for (const [key, value] of Object.entries(groups)) {
		// Skip unnamed groups (numeric keys from wildcards/optionals)
		if (value !== undefined && !/^\d+$/.test(key)) {
			params[key] = value
		}
	}
	return params
}

/**
 * Extract params from a layout node using its prefix URLPattern.
 * Falls back to empty params if no prefix pattern is available.
 */
function extractLayoutParams(node: RouteNode, pathname: string): Record<string, string> {
	if (node.prefixPattern) {
		const result = node.prefixPattern.exec({ pathname })
		if (result) {
			return extractParamsFromResult(result)
		}
	}
	return {}
}
