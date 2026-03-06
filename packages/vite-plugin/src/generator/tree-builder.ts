import * as path from 'node:path'
import { parseDirName, parseFileName } from '../conventions'
import type { ExtractedPage } from './page-extractor'
import { extractPages } from './page-extractor'
import type { ScannedFile } from './scanner'

/**
 * Page export info attached to a file route node.
 */
export interface PageExportInfo {
	/** Page ID (e.g., "project/detail"). */
	pageId: string
	/** Route pattern (e.g., "/project/:id"). */
	routePattern: string
	/** Param info extracted from the page schema. */
	params: { name: string; optional: boolean }[]
}

/**
 * A node in the file-based route tree (before compilation into RouteNode).
 */
export interface FileRouteNode {
	/** Route path segment. */
	segment: string
	/** Full path from root. */
	fullPath: string
	/** Absolute file path to the component. */
	filePath?: string
	/** Whether this is a layout. */
	isLayout: boolean
	/** Whether this is an index route. */
	isIndex: boolean
	/** Whether this is a pathless group. */
	isPathlessGroup: boolean
	/** Whether this is a catch-all route. */
	isCatchAll: boolean
	/** Dynamic parameter names contributed by this node and its ancestor directories. */
	paramNames: string[]
	/** Page exports discovered in this file. */
	pageExports?: PageExportInfo[]
	/** Children nodes. */
	children: FileRouteNode[]
}

/**
 * Build a route tree from scanned files.
 * Also extracts createPage() metadata for page-centric routing.
 */
export function buildFileRouteTree(files: ScannedFile[]): FileRouteNode[] {
	const root: FileRouteNode = {
		segment: '',
		fullPath: '/',
		isLayout: false,
		isIndex: false,
		isPathlessGroup: false,
		isCatchAll: false,
		paramNames: [],
		children: [],
	}

	for (const file of files) {
		insertFile(root, file)
	}

	return root.children
}

function insertFile(root: FileRouteNode, file: ScannedFile): void {
	const ext = path.extname(file.relativePath)
	const withoutExt = file.relativePath.slice(0, -ext.length)
	const parts = withoutExt.split(path.sep)
	const fileName = parts.pop()!
	const dirs = parts

	// Navigate/create intermediate directory nodes
	let current = root
	let currentPath = ''
	let accumulatedParams: string[] = []

	for (const dir of dirs) {
		const dirInfo = parseDirName(dir)
		const segmentPath = dirInfo.isPathlessGroup
			? currentPath
			: joinPath(currentPath, dirInfo.segment)
		if (dirInfo.paramName) {
			accumulatedParams = [...accumulatedParams, dirInfo.paramName]
		}

		let child = current.children.find(c => c.segment === dirInfo.segment && c.isPathlessGroup === dirInfo.isPathlessGroup && c.isLayout)

		if (!child) {
			// Find or create a group/directory node
			child = current.children.find(c => c.segment === dirInfo.segment && c.isPathlessGroup === dirInfo.isPathlessGroup && !c.filePath)
		}

		if (!child) {
			child = {
				segment: dirInfo.segment,
				fullPath: segmentPath || '/',
				isLayout: false,
				isIndex: false,
				isPathlessGroup: dirInfo.isPathlessGroup,
				isCatchAll: false,
				paramNames: accumulatedParams,
				children: [],
			}
			current.children.push(child)
		}

		current = child
		currentPath = segmentPath
	}

	// Add the file node
	const fileInfo = parseFileName(fileName)

	if (fileInfo.isLayout) {
		// Layout: attach to the current directory node
		current.isLayout = true
		current.filePath = file.absolutePath
	} else if (fileInfo.isIndex) {
		// Index: add as child
		const fullPath = currentPath || '/'
		const pageExports = extractPageExports(file, dirs, '', true)
		const indexNode: FileRouteNode = {
			segment: '',
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: true,
			isPathlessGroup: false,
			isCatchAll: false,
			paramNames: accumulatedParams,
			pageExports,
			children: [],
		}
		current.children.push(indexNode)
	} else {
		// Regular or dynamic route
		const fullPath = joinPath(currentPath, fileInfo.segment)
		const fileParams = fileInfo.paramName
			? [...accumulatedParams, fileInfo.paramName]
			: accumulatedParams
		const pageExports = extractPageExports(file, dirs, fileName, false)
		const routeNode: FileRouteNode = {
			segment: fileInfo.segment,
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: false,
			isPathlessGroup: false,
			isCatchAll: fileInfo.isCatchAll,
			paramNames: fileParams,
			pageExports,
			children: [],
		}
		current.children.push(routeNode)
	}
}

/**
 * Derive page ID from file path and export name.
 * Convention: strip routesDir prefix, strip extension, append /exportName (unless default).
 *
 * Examples:
 * - File: project.tsx, export: detail → "project/detail"
 * - File: project.tsx, export: default → "project"
 * - File: project/detail.tsx, export: default → "project/detail"
 * - File: index.tsx, export: default → "index"
 */
function derivePageId(dirs: string[], fileName: string, isIndex: boolean, exportName: string): string {
	const segments = [...dirs]

	if (isIndex) {
		// index files: page ID is just the directory path
		// If at root: "index"
		if (segments.length === 0) {
			return exportName === 'default' ? 'index' : `index/${exportName}`
		}
		const base = segments.join('/')
		return exportName === 'default' ? base : `${base}/${exportName}`
	}

	// Regular files
	segments.push(fileName)
	const base = segments.join('/')

	return exportName === 'default' ? base : `${base}/${exportName}`
}

/**
 * Derive route pattern for a page without explicit .route().
 * Uses the file path convention.
 */
function deriveRoutePattern(dirs: string[], fileName: string, isIndex: boolean): string {
	const segments: string[] = []

	for (const dir of dirs) {
		const dirInfo = parseDirName(dir)
		if (!dirInfo.isPathlessGroup && dirInfo.segment) {
			segments.push(dirInfo.segment)
		}
	}

	if (!isIndex) {
		const fileInfo = parseFileName(fileName)
		if (fileInfo.segment) {
			segments.push(fileInfo.segment)
		}
	}

	return '/' + segments.join('/')
}

/**
 * Extract page exports and their metadata from a source file.
 */
function extractPageExports(
	file: ScannedFile,
	dirs: string[],
	fileName: string,
	isIndex: boolean,
): PageExportInfo[] | undefined {
	let pages: ExtractedPage[]
	try {
		pages = extractPages(file.absolutePath)
	} catch {
		return undefined
	}

	if (pages.length === 0) return undefined

	const result: PageExportInfo[] = []

	for (const page of pages) {
		const pageId = derivePageId(dirs, fileName, isIndex, page.exportName)
		const routePattern = page.route ?? deriveRoutePattern(dirs, fileName, isIndex)

		result.push({
			pageId,
			routePattern,
			params: page.params,
		})
	}

	return result
}

function joinPath(parent: string, child: string): string {
	if (!child) return parent || '/'
	const base = parent || ''
	return `${base}/${child}`
}

/**
 * Collect all route paths from a file route tree (for codegen).
 */
export function collectRoutePaths(nodes: FileRouteNode[]): { path: string; params: string[] }[] {
	const result: { path: string; params: string[] }[] = []

	for (const node of nodes) {
		if (node.filePath && !node.isLayout) {
			result.push({ path: node.fullPath, params: node.paramNames })
		}

		if (node.children.length > 0) {
			result.push(...collectRoutePaths(node.children))
		}
	}

	return result
}
