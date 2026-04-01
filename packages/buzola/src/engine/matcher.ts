import type { RouteMatch, RouteNode } from './types.js'

/**
 * Match a URL against the route tree.
 * Returns an array of RouteMatch from root layout to leaf page, or null if no match.
 * When multiple routes match, selects the most specific one (fewest dynamic params).
 */
export function matchRoutes(nodes: RouteNode[], url: URL): RouteMatch[] | null {
	const pathname = url.pathname
	return pickBestMatch(nodes, pathname)
}

/**
 * Find the best match among sibling nodes.
 * Tries all siblings and picks the most specific match (fewest dynamic params).
 */
function pickBestMatch(nodes: RouteNode[], pathname: string): RouteMatch[] | null {
	let best: RouteMatch[] | null = null
	let bestParamCount = Infinity

	for (const node of nodes) {
		const result = matchNode(node, pathname)
		if (result) {
			const paramCount = countParams(result)
			if (paramCount < bestParamCount) {
				best = result
				bestParamCount = paramCount
				if (paramCount === 0) break // Can't do better than zero params
			}
		}
	}

	return best
}

/**
 * Count total dynamic params across all matches in a chain.
 */
function countParams(matches: RouteMatch[]): number {
	let count = 0
	for (const match of matches) {
		count += Object.keys(match.params).length
	}
	return count
}

function matchNode(node: RouteNode, pathname: string): RouteMatch[] | null {
	// Layout nodes: try to match children, prepend self if any child matches
	if (node.isLayout && !node.isIndex) {
		const childMatch = pickBestMatch(node.children, pathname)
		if (childMatch) {
			const layoutMatch: RouteMatch = {
				node,
				params: extractLayoutParams(node, pathname),
				pathname,
			}
			return [layoutMatch, ...childMatch]
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
				const childMatch = pickBestMatch(node.children, pathname)
				if (childMatch) {
					return [match, ...childMatch]
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
