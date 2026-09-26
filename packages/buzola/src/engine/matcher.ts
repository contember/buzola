import type { RouteMatch, RouteTree, TrieNode, TrieRoute } from './types.js'

/**
 * Match a URL against the route trie.
 * Returns an array of RouteMatch from root layout to leaf page, or null if no match.
 *
 * Matching priority is structural: static segments are always checked before
 * dynamic segments, which are checked before catch-all segments.
 */
export function matchRoutes(tree: RouteTree, url: URL): RouteMatch[] | null {
	const pathname = url.pathname
	const segments = pathname.split('/').filter(Boolean)
	return matchTrie(tree.root, segments, 0, [], pathname)
}

function matchTrie(
	node: TrieNode,
	segments: string[],
	index: number,
	values: string[],
	pathname: string,
): RouteMatch[] | null {
	// All segments consumed — check if this trie node has a terminal route
	if (index === segments.length) {
		if (node.route) {
			return buildMatchChain(node.route, values, pathname)
		}
		return null
	}

	const segment = segments[index]

	// 1. Try static child first — O(1) Map lookup, always most specific
	const staticChild = node.staticChildren.get(segment)
	if (staticChild) {
		const result = matchTrie(staticChild, segments, index + 1, values, pathname)
		if (result) return result
	}

	// 2. Try dynamic child — matches any single segment
	if (node.dynamicChild) {
		const result = matchTrie(node.dynamicChild, segments, index + 1, [...values, decodeURIComponent(segment)], pathname)
		if (result) return result
	}

	// 3. Try catch-all child — consumes all remaining segments
	if (node.catchAllChild) {
		const remaining = segments.slice(index).map(s => decodeURIComponent(s)).join('/')
		return buildMatchChain(node.catchAllChild, [...values, remaining], pathname)
	}

	return null
}

/**
 * Build a RouteMatch[] array for a matched route. Values are collected by position and named here,
 * by the matched route's own pattern, since routes sharing a trie position may name it differently.
 * Each match in the chain gets all params (they're merged by the React layer anyway).
 */
function buildMatchChain(route: TrieRoute, values: string[], pathname: string): RouteMatch[] {
	const params: Record<string, string> = {}
	route.paramNames.forEach((name, i) => {
		params[name] = values[i]
	})
	return route.chain.map(node => ({ node, params, pathname }))
}
