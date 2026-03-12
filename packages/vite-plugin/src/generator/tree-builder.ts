import * as path from 'node:path'
import { parseDirName, parseFileName } from '../conventions.js'
import type { ExtractedPage, ModuleLoader } from './page-extractor.js'
import { extractPages } from './page-extractor.js'
import type { ScannedFile } from './scanner.js'

/**
 * Page export info attached to a file route node.
 */
export interface PageExportInfo {
	/** Page ID (e.g., "project/detail"). */
	pageId: string
	/** Export name (e.g., "default", "detail"). */
	exportName: string
	/** Route pattern (e.g., "/project/:id"). */
	routePattern: string
	/** Param info extracted from the page schema. */
	params: { name: string; optional: boolean; array: boolean }[]
}

/**
 * A node in the route tree (before compilation into RouteNode).
 */
export interface FileRouteNode {
	/** Route path segment (from file name, or derived from .route() pattern). */
	segment: string
	/** Full path from root. */
	fullPath: string
	/** Absolute file path to the component. */
	filePath?: string
	/** Which export to use from the file ("default" or a named export). */
	exportName?: string
	/** Whether this is a layout. */
	isLayout: boolean
	/** Whether this is an index route. */
	isIndex: boolean
	/** Whether this is a not-found catch-all. */
	isNotFound: boolean
	/** Whether this is a pathless group. */
	isPathlessGroup: boolean
	/** Page exports discovered in this file. */
	pageExports?: PageExportInfo[]
	/** Children nodes. */
	children: FileRouteNode[]
}

// ─── Flat route entry (intermediate representation) ─────────────────────────

interface RouteEntry {
	routePattern: string
	/** File-hierarchy-based position for tree building (may differ from routePattern when .route() is used). */
	treePosition: string
	filePath: string
	exportName: string
	kind: 'page' | 'layout' | 'notFound'
	pageId?: string
	params: { name: string; optional: boolean; array: boolean }[]
	/** File-system-derived URL path (ignoring pathless groups). */
	fileScope: string
	/** Chain of pathless group directory paths this file is nested under. */
	pathlessGroups: string[]
	/** For pathless group layouts: the directory path of the group. */
	pathlessGroupId?: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a route tree from scanned files.
 * Loads each module via moduleLoader to extract createPage() metadata.
 *
 * Two-phase approach:
 * 1. Extract flat route entries from all files.
 * 2. Build the tree using route-pattern prefix matching (not file hierarchy).
 */
export async function buildFileRouteTree(files: ScannedFile[], moduleLoader: ModuleLoader): Promise<FileRouteNode[]> {
	const entries = await extractEntries(files, moduleLoader)
	return buildTreeFromEntries(entries)
}

// ─── Phase 1: Extract flat route entries ────────────────────────────────────

async function extractEntries(files: ScannedFile[], moduleLoader: ModuleLoader): Promise<RouteEntry[]> {
	const entries: RouteEntry[] = []

	for (const file of files) {
		const ext = path.extname(file.relativePath)
		const withoutExt = file.relativePath.slice(0, -ext.length)
		const parts = withoutExt.split(path.sep)
		const fileName = parts.pop()!
		const dirs = parts
		const fileInfo = parseFileName(fileName)

		// Compute fileScope (URL path from directory structure, skipping pathless groups)
		// and pathlessGroups chain
		let fileScope = ''
		const pathlessGroups: string[] = []
		let groupPath = ''

		for (const dir of dirs) {
			groupPath = groupPath ? `${groupPath}/${dir}` : dir
			const dirInfo = parseDirName(dir)
			if (dirInfo.isPathlessGroup) {
				pathlessGroups.push(groupPath)
			} else {
				fileScope = joinPath(fileScope, dirInfo.segment)
			}
		}
		if (!fileScope) fileScope = '/'

		if (fileInfo.isLayout) {
			// Detect pathless group layout: immediate parent dir is a pathless group
			const lastDir = dirs.length > 0 ? dirs[dirs.length - 1] : null
			const isPathlessGroupLayout = lastDir != null && parseDirName(lastDir).isPathlessGroup

			entries.push({
				routePattern: fileScope,
				treePosition: fileScope,
				filePath: file.absolutePath,
				exportName: 'default',
				kind: 'layout',
				params: [],
				fileScope,
				pathlessGroups,
				pathlessGroupId: isPathlessGroupLayout ? groupPath : undefined,
			})
		} else if (fileInfo.isNotFound) {
			const catchAllPattern = fileScope === '/' ? '/:__notFound+' : `${fileScope}/:__notFound+`
			const pageId = dirs.length === 0 ? '404' : `${dirs.join('/')}/404`
			entries.push({
				routePattern: catchAllPattern,
				treePosition: catchAllPattern,
				filePath: file.absolutePath,
				exportName: 'default',
				kind: 'notFound',
				pageId,
				params: [{ name: '__notFound', optional: false, array: false }],
				fileScope,
				pathlessGroups,
			})
		} else {
			const isIndex = fileInfo.isIndex
			const basePath = isIndex ? fileScope : joinPath(fileScope, fileName)

			const pages = await safeExtractPages(file, moduleLoader)

			if (pages.length === 0) {
				// No createPage() — plain component
				entries.push({
					routePattern: basePath,
					treePosition: basePath,
					filePath: file.absolutePath,
					exportName: 'default',
					kind: 'page',
					params: [],
					fileScope,
					pathlessGroups,
				})
			} else {
				for (const page of pages) {
					const pageId = derivePageId(dirs, fileName, isIndex, page.exportName)
					const defaultPattern = page.isDefault ? basePath : joinPath(basePath, page.exportName)
					const routePattern = page.route ?? defaultPattern
					entries.push({
						routePattern,
						treePosition: defaultPattern,
						filePath: file.absolutePath,
						exportName: page.exportName,
						kind: 'page',
						pageId,
						params: page.params,
						fileScope,
						pathlessGroups,
					})
				}
			}
		}
	}

	return entries
}

// ─── Phase 2: Build tree from flat entries ──────────────────────────────────

interface LayoutRef {
	node: FileRouteNode
	pathlessGroupId?: string
}

function buildTreeFromEntries(entries: RouteEntry[]): FileRouteNode[] {
	const root: FileRouteNode = {
		segment: '',
		fullPath: '/',
		isLayout: false,
		isIndex: false,
		isNotFound: false,
		isPathlessGroup: false,
		children: [],
	}

	const layouts = entries.filter(e => e.kind === 'layout')
	const pages = entries.filter(e => e.kind !== 'layout')

	// Sort layouts: shorter routePattern first, non-pathless before pathless
	layouts.sort((a, b) => {
		if (a.routePattern.length !== b.routePattern.length) return a.routePattern.length - b.routePattern.length
		if (a.pathlessGroupId && !b.pathlessGroupId) return 1
		if (!a.pathlessGroupId && b.pathlessGroupId) return -1
		return 0
	})

	// Insert layouts into tree
	// Track all layout nodes for page assignment
	const layoutRefs: LayoutRef[] = [{ node: root }]

	for (const layout of layouts) {
		if (layout.pathlessGroupId) {
			// Pathless group layout — find parent by walking layoutRefs, respecting pathless group chain
			const parent = findParentForPathlessGroupLayout(layoutRefs, layout)
			const node: FileRouteNode = {
				segment: '',
				fullPath: layout.treePosition,
				filePath: layout.filePath,
				isLayout: true,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: true,
				children: [],
			}
			parent.node.children.push(node)
			layoutRefs.push({ node, pathlessGroupId: layout.pathlessGroupId })
		} else if (layout.treePosition === '/' && !root.filePath) {
			// Root layout
			root.isLayout = true
			root.filePath = layout.filePath
		} else if (layout.treePosition === '/') {
			// Additional layout at root (shouldn't happen normally, but handle)
			root.isLayout = true
			root.filePath = layout.filePath
		} else {
			// Regular layout — find parent by prefix matching
			const parent = findDeepestLayoutParent(layoutRefs, layout.treePosition, layout.pathlessGroups)
			const segment = computeSegmentFromParent(parent.node.fullPath, layout.treePosition)
			const node: FileRouteNode = {
				segment,
				fullPath: layout.treePosition,
				filePath: layout.filePath,
				isLayout: true,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				children: [],
			}
			parent.node.children.push(node)
			layoutRefs.push({ node })
		}
	}

	// Insert pages into tree (using file-hierarchy position, not route pattern)
	for (const entry of pages) {
		const parent = findDeepestLayoutParent(layoutRefs, entry.treePosition, entry.pathlessGroups)
		const isIndex = entry.treePosition === parent.node.fullPath
		const segment = isIndex ? '' : computeSegmentFromParent(parent.node.fullPath, entry.treePosition)

		const pageExports: PageExportInfo[] | undefined = entry.pageId
			? [{
				pageId: entry.pageId,
				exportName: entry.exportName,
				routePattern: entry.routePattern,
				params: entry.params,
			}]
			: undefined

		// For named exports from the same file as an existing node, check collision
		if (!isIndex) {
			checkCollision(parent.node.children, segment, entry.filePath, entry.exportName)
		}

		// Try to reuse an existing container node (e.g., from a directory that has no _layout.tsx)
		const existing = !isIndex
			? parent.node.children.find(c => c.segment === segment && !c.filePath && !c.isLayout && !c.isPathlessGroup)
			: undefined

		if (existing) {
			existing.filePath = entry.filePath
			existing.exportName = entry.exportName
			existing.pageExports = pageExports
		} else {
			parent.node.children.push({
				segment,
				fullPath: entry.treePosition,
				filePath: entry.filePath,
				exportName: entry.exportName,
				isLayout: false,
				isIndex,
				isNotFound: entry.kind === 'notFound',
				isPathlessGroup: false,
				pageExports,
				children: [],
			})
		}
	}

	// Sort children recursively
	sortChildren(root)

	if (root.isLayout && root.filePath) {
		return [root]
	}

	return root.children
}

/**
 * Find the parent layout for a pathless group layout.
 * The parent is the deepest layout at the same routePattern level,
 * considering the pathless group nesting chain.
 */
function findParentForPathlessGroupLayout(layoutRefs: LayoutRef[], entry: RouteEntry): LayoutRef {
	// The parent is the layout whose pathlessGroupId is the previous entry in the chain,
	// or the deepest non-pathless layout at the same routePattern if this is the first group.
	const groupChain = entry.pathlessGroups
	const thisGroupIndex = groupChain.indexOf(entry.pathlessGroupId!)

	if (thisGroupIndex > 0) {
		// Has a parent pathless group — find it
		const parentGroupId = groupChain[thisGroupIndex - 1]
		const parentRef = layoutRefs.find(r => r.pathlessGroupId === parentGroupId)
		if (parentRef) return parentRef
	}

	// First pathless group in chain (or parent not found) — find the deepest regular layout at prefix
	let best = layoutRefs[0] // root
	for (const ref of layoutRefs) {
		if (ref.pathlessGroupId) continue // skip other pathless groups
		if (isPathPrefixOrEqual(ref.node.fullPath, entry.routePattern) && ref.node.fullPath.length >= best.node.fullPath.length) {
			best = ref
		}
	}
	return best
}

/**
 * Find the deepest layout whose routePattern is a prefix of the given pattern.
 * Respects pathless group membership.
 */
function findDeepestLayoutParent(layoutRefs: LayoutRef[], routePattern: string, pathlessGroups: string[]): LayoutRef {
	let best = layoutRefs[0] // root

	for (const ref of layoutRefs) {
		if (!isPathPrefixOrEqual(ref.node.fullPath, routePattern)) continue

		// For pathless groups, only match if the entry belongs to this group
		if (ref.pathlessGroupId && !pathlessGroups.includes(ref.pathlessGroupId)) continue

		// Prefer deeper matches. For ties (pathless groups at same depth), prefer pathless group
		// that the entry belongs to over non-pathless.
		if (ref.node.fullPath.length > best.node.fullPath.length) {
			best = ref
		} else if (ref.node.fullPath.length === best.node.fullPath.length && ref.pathlessGroupId && pathlessGroups.includes(ref.pathlessGroupId)) {
			best = ref
		}
	}

	return best
}

function isPathPrefixOrEqual(prefix: string, path: string): boolean {
	if (prefix === '/') return true
	return path === prefix || path.startsWith(prefix + '/')
}

function computeSegmentFromParent(parentFullPath: string, childFullPath: string): string {
	if (parentFullPath === '/') return childFullPath.slice(1)
	return childFullPath.slice(parentFullPath.length + 1)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive page ID from file path and export name.
 */
function derivePageId(dirs: string[], fileName: string, isIndex: boolean, exportName: string): string {
	const segments = [...dirs]

	if (isIndex) {
		if (segments.length === 0) {
			return exportName === 'default' ? 'index' : `index/${exportName}`
		}
		const base = segments.join('/')
		return exportName === 'default' ? base : `${base}/${exportName}`
	}

	segments.push(fileName)
	const base = segments.join('/')

	return exportName === 'default' ? base : `${base}/${exportName}`
}

async function safeExtractPages(file: ScannedFile, moduleLoader: ModuleLoader): Promise<ExtractedPage[]> {
	try {
		return await extractPages(file.absolutePath, moduleLoader)
	} catch (error) {
		console.warn(`[buzola] Failed to extract pages from ${file.relativePath}:`, error instanceof Error ? error.message : error)
		return []
	}
}

function checkCollision(siblings: FileRouteNode[], segment: string, filePath: string, exportName: string): void {
	const existing = siblings.find(c => c.segment === segment && !c.isLayout && !c.isPathlessGroup)
	if (!existing || !existing.filePath) return

	const existingDesc = existing.exportName && existing.exportName !== 'default'
		? `named export '${existing.exportName}' in '${existing.filePath}'`
		: `'${existing.filePath}'`
	const newDesc = exportName !== 'default'
		? `named export '${exportName}' in '${filePath}'`
		: `'${filePath}'`

	throw new Error(`Route collision: ${newDesc} conflicts with ${existingDesc} — both resolve to segment '${segment}'`)
}

function sortChildren(node: FileRouteNode): void {
	for (const child of node.children) {
		sortChildren(child)
	}
	node.children.sort((a, b) => sortWeight(a) - sortWeight(b))
}

const SORT_INDEX = 0
const SORT_STATIC = 1
const SORT_DYNAMIC = 2
const SORT_CATCHALL = 3
const SORT_NOT_FOUND = 4

function sortWeight(node: FileRouteNode): number {
	if (node.isIndex) return SORT_INDEX
	if (node.isNotFound) return SORT_NOT_FOUND
	if (node.segment.includes(':') && node.segment.includes('+')) return SORT_CATCHALL
	if (node.segment.includes(':')) return SORT_DYNAMIC
	return SORT_STATIC
}

function joinPath(parent: string, child: string): string {
	if (!child) return parent || '/'
	if (!parent || parent === '/') return `/${child}`
	return `${parent}/${child}`
}
