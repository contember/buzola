import type { RouteComponent, RouteConfig, RouteNode, StandardSchema } from './types.js'

/**
 * Normalize a path segment — ensure it starts with "/" and strip trailing slashes.
 */
function normalizePath(path: string): string {
	if (path === '' || path === '/') return '/'
	const p = path.startsWith('/') ? path : `/${path}`
	return p.endsWith('/') ? p.slice(0, -1) : p
}

/**
 * Join two path segments.
 */
function joinPaths(parent: string, child: string): string {
	if (child === '/') return parent === '/' ? '/' : parent
	const base = parent === '/' ? '' : parent
	const segment = child.startsWith('/') ? child : `/${child}`
	return base + segment
}

export interface CreateRouteNodeOptions {
	path: string
	fullPath: string
	component?: RouteComponent
	searchSchema?: StandardSchema
	children?: RouteNode[]
	parent?: RouteNode
	isLayout?: boolean
	isIndex?: boolean
}

/**
 * Create a route node with a compiled URLPattern.
 */
export function createRouteNode(options: CreateRouteNodeOptions): RouteNode {
	const {
		path,
		fullPath,
		component,
		searchSchema,
		children = [],
		parent,
		isLayout = false,
		isIndex = false,
	} = options

	// Build the pattern — layouts get a prefix pattern for param extraction,
	// index and leaf routes get an exact pattern for matching.
	let pattern: URLPattern | undefined
	let prefixPattern: URLPattern | undefined
	if (!isLayout || isIndex) {
		pattern = new URLPattern({ pathname: fullPath === '' ? '/' : fullPath })
	}
	if (isLayout && !isIndex) {
		// Layouts get a prefix pattern that matches any path starting with their fullPath.
		// The {/.*}? suffix optionally matches a trailing slash and anything after.
		const prefix = fullPath === '' || fullPath === '/' ? '/' : fullPath
		prefixPattern = new URLPattern({ pathname: prefix === '/' ? '/{.*}?' : `${prefix}{/.*}?` })
	}

	const node: RouteNode = {
		id: `route:${fullPath || '/'}${isLayout ? ':layout' : ''}`,
		path: normalizePath(path),
		fullPath: normalizePath(fullPath),
		pattern,
		prefixPattern,
		component,
		searchSchema,
		children,
		parent,
		isLayout,
		isIndex,
	}

	// Set parent reference on children
	for (const child of node.children) {
		child.parent = node
	}

	return node
}

/**
 * Build a route tree from an array of RouteConfig.
 */
export function buildRouteTree(configs: RouteConfig[], parentPath = ''): RouteNode[] {
	return buildRouteNodes(configs, parentPath)
}

function buildRouteNodes(configs: RouteConfig[], parentPath: string): RouteNode[] {
	const nodes: RouteNode[] = []

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

		const children = config.children
			? buildRouteNodes(config.children, config.isPathlessGroup ? parentPath : fullPath)
			: []

		const node = createRouteNode({
			path: segment,
			fullPath,
			component: config.component,
			searchSchema: config.searchSchema,
			children,
			isLayout,
			isIndex,
		})

		nodes.push(node)
	}

	return nodes
}
