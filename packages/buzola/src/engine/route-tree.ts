import type { RouteComponent, RouteConfig, RouteNode, RouteTree, StandardSchema, TrieNode } from './types.js'

// ─── Public API ─────────────────────────────────────────────────────────────

export interface CreateRouteNodeOptions {
	path: string
	fullPath: string
	component?: RouteComponent
	searchSchema?: StandardSchema
	preload?: () => void
	isLayout?: boolean
	isIndex?: boolean
}

/**
 * Create a route node (layout or page entry in a match chain).
 */
export function createRouteNode(options: CreateRouteNodeOptions): RouteNode {
	const {
		path,
		fullPath,
		component,
		searchSchema,
		preload,
		isLayout = false,
		isIndex = false,
	} = options

	return {
		id: `route:${fullPath || '/'}${isLayout ? ':layout' : ''}`,
		path: normalizePath(path),
		fullPath: normalizePath(fullPath),
		component,
		searchSchema,
		preload,
		isLayout,
		isIndex,
	}
}

/**
 * Build a route tree (segment trie) from an array of RouteConfig.
 *
 * Two phases:
 * 1. Flatten the nested RouteConfig tree into leaf routes, each with its layout chain.
 * 2. Insert each leaf route into a segment trie for O(segments) matching.
 */
export function buildRouteTree(configs: RouteConfig[], parentPath = ''): RouteTree {
	const entries = flattenConfigs(configs, parentPath, [])
	const root = createTrieNode()

	for (const entry of entries) {
		insertIntoTrie(root, entry.pattern, entry.chain)
	}

	return { root }
}

// ─── Phase 1: Flatten RouteConfig tree ──────────────────────────────────────

interface FlatEntry {
	/** The URL pattern for matching (e.g., "/project/:id/edit"). */
	pattern: string
	/** Layout chain from root to leaf — each becomes a RouteMatch. */
	chain: RouteNode[]
}

function flattenConfigs(configs: RouteConfig[], parentPath: string, layoutChain: RouteNode[]): FlatEntry[] {
	const entries: FlatEntry[] = []

	for (const config of configs) {
		const segment = config.isPathlessGroup ? '' : config.path
		const hasChildren = config.children != null && config.children.length > 0
		const isLayout = config.isLayout ?? hasChildren
		const isIndex = config.isIndex ?? (!isLayout && (config.path === '/' || config.path === ''))

		let fullPath: string
		if (config.matchPath != null) {
			fullPath = config.matchPath
		} else if (isIndex) {
			fullPath = parentPath || '/'
		} else {
			fullPath = joinPaths(parentPath || '/', segment)
		}

		const node = createRouteNode({
			path: segment,
			fullPath,
			component: config.component,
			searchSchema: config.searchSchema,
			preload: config.preload,
			isLayout,
			isIndex,
		})

		if (isLayout) {
			// Layout: add to chain and recurse children
			const newChain = [...layoutChain, node]
			if (config.children) {
				const childParent = config.isPathlessGroup ? parentPath : fullPath
				entries.push(...flattenConfigs(config.children, childParent, newChain))
			}
		} else {
			// Leaf route: create entry with full chain
			entries.push({
				pattern: fullPath,
				chain: [...layoutChain, node],
			})
		}
	}

	return entries
}

// ─── Phase 2: Trie construction ─────────────────────────────────────────────

function createTrieNode(): TrieNode {
	return { staticChildren: new Map() }
}

function insertIntoTrie(root: TrieNode, pattern: string, chain: RouteNode[]): void {
	const segments = splitPathSegments(pattern)
	let node = root

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]

		if (segment.startsWith(':') && (segment.endsWith('+') || segment.endsWith('*'))) {
			// Catch-all segment — consumes all remaining segments
			const paramName = segment.slice(1, -1)
			node.catchAllChild = { paramName, chain }
			return
		}

		if (segment.startsWith(':')) {
			// Dynamic segment
			const paramName = segment.slice(1)
			if (!node.dynamicChild) {
				node.dynamicChild = { paramName, node: createTrieNode() }
			}
			node = node.dynamicChild.node
		} else {
			// Static segment
			let child = node.staticChildren.get(segment)
			if (!child) {
				child = createTrieNode()
				node.staticChildren.set(segment, child)
			}
			node = child
		}
	}

	// Terminal — route matches at this trie node
	node.route = { chain }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Split a path pattern into segments, filtering out empty strings.
 * "/app/project/:id" → ["app", "project", ":id"]
 */
function splitPathSegments(pattern: string): string[] {
	return pattern.split('/').filter(Boolean)
}

function normalizePath(path: string): string {
	if (path === '' || path === '/') return '/'
	const p = path.startsWith('/') ? path : `/${path}`
	return p.endsWith('/') ? p.slice(0, -1) : p
}

function joinPaths(parent: string, child: string): string {
	if (child === '/') return parent === '/' ? '/' : parent
	const base = parent === '/' ? '' : parent
	const segment = child.startsWith('/') ? child : `/${child}`
	return base + segment
}
