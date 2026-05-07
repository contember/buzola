import type { RouteMatch, RouteTree, TrieNode } from './types.js'

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
	return matchTrie(tree.root, segments, 0, {}, pathname)
}

function matchTrie(
	node: TrieNode,
	segments: string[],
	index: number,
	params: Record<string, string>,
	pathname: string,
): RouteMatch[] | null {
	// All segments consumed — check if this trie node has a terminal route
	if (index === segments.length) {
		if (node.route) {
			return buildMatchChain(node.route.chain, params, pathname)
		}
		return null
	}

	const segment = segments[index]

	// 1. Try static child first — O(1) Map lookup, always most specific
	const staticChild = node.staticChildren.get(segment)
	if (staticChild) {
		const result = matchTrie(staticChild, segments, index + 1, params, pathname)
		if (result) return result
	}

	// 2. Try dynamic child — matches any single segment
	if (node.dynamicChild) {
		const newParams = { ...params, [node.dynamicChild.paramName]: decodeURIComponent(segment) }
		const result = matchTrie(node.dynamicChild.node, segments, index + 1, newParams, pathname)
		if (result) return result
	}

	// 3. Try catch-all child — consumes all remaining segments
	if (node.catchAllChild) {
		const remaining = segments.slice(index).map(s => decodeURIComponent(s)).join('/')
		const newParams = { ...params, [node.catchAllChild.paramName]: remaining }
		return buildMatchChain(node.catchAllChild.chain, newParams, pathname)
	}

	return null
}

/**
 * Build a RouteMatch[] array from a chain of RouteNodes and collected params.
 * Each match in the chain gets all collected params (they're merged by the React layer anyway).
 */
function buildMatchChain(
	chain: import('./types.js').RouteNode[],
	params: Record<string, string>,
	pathname: string,
): RouteMatch[] {
	return chain.map(node => ({ node, params, pathname }))
}
