import * as path from 'node:path'
import { parseDirName, parseFileName } from '../conventions'
import type { ExtractedPage, ModuleLoader } from './page-extractor'
import { extractPages } from './page-extractor'
import type { ScannedFile } from './scanner'

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
 * A node in the file-based route tree (before compilation into RouteNode).
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

/**
 * Build a route tree from scanned files.
 * Loads each module via moduleLoader to extract createPage() metadata.
 */
export async function buildFileRouteTree(files: ScannedFile[], moduleLoader: ModuleLoader): Promise<FileRouteNode[]> {
	const root: FileRouteNode = {
		segment: '',
		fullPath: '/',
		isLayout: false,
		isIndex: false,
		isNotFound: false,
		isPathlessGroup: false,
		children: [],
	}

	for (const file of files) {
		await insertFile(root, file, moduleLoader)
	}

	sortChildren(root)

	if (root.isLayout && root.filePath) {
		return [root]
	}

	return root.children
}

async function insertFile(root: FileRouteNode, file: ScannedFile, moduleLoader: ModuleLoader): Promise<void> {
	const ext = path.extname(file.relativePath)
	const withoutExt = file.relativePath.slice(0, -ext.length)
	const parts = withoutExt.split(path.sep)
	const fileName = parts.pop()!
	const dirs = parts

	let current = root
	let currentPath = ''

	for (const dir of dirs) {
		const dirInfo = parseDirName(dir)
		const segmentPath = dirInfo.isPathlessGroup
			? currentPath
			: joinPath(currentPath, dirInfo.segment)

		let child = current.children.find(c => c.segment === dirInfo.segment && c.isPathlessGroup === dirInfo.isPathlessGroup && c.isLayout)

		if (!child) {
			child = current.children.find(c => c.segment === dirInfo.segment && c.isPathlessGroup === dirInfo.isPathlessGroup && !c.filePath)
		}

		if (!child) {
			child = {
				segment: dirInfo.segment,
				fullPath: segmentPath || '/',
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: dirInfo.isPathlessGroup,
				children: [],
			}
			current.children.push(child)
		}

		current = child
		currentPath = segmentPath
	}

	const fileInfo = parseFileName(fileName)

	if (fileInfo.isLayout) {
		current.isLayout = true
		current.filePath = file.absolutePath
	} else if (fileInfo.isNotFound) {
		const catchAllSegment = ':__notFound+'
		const fullPath = joinPath(currentPath, catchAllSegment)
		const pageId = dirs.length === 0 ? '404' : `${dirs.join('/')}/404`
		const pageExports: PageExportInfo[] = [{
			pageId,
			exportName: 'default',
			routePattern: fullPath,
			params: [{ name: '__notFound', optional: false, array: false }],
		}]
		const notFoundNode: FileRouteNode = {
			segment: catchAllSegment,
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: false,
			isNotFound: true,
			isPathlessGroup: false,
			pageExports,
			children: [],
		}
		current.children.push(notFoundNode)
	} else if (fileInfo.isIndex) {
		const fullPath = currentPath || '/'
		const allExports = await extractPageExportsFromFile(file, dirs, '', true, currentPath, moduleLoader)
		const defaultExports = allExports?.filter(e => e.exportName === 'default')
		const namedExports = allExports?.filter(e => e.exportName !== 'default') ?? []

		const hasDefault = defaultExports != null && defaultExports.length > 0
		const indexNode: FileRouteNode = {
			segment: '',
			fullPath,
			filePath: hasDefault ? file.absolutePath : undefined,
			exportName: hasDefault ? 'default' : undefined,
			isLayout: false,
			isIndex: true,
			isNotFound: false,
			isPathlessGroup: false,
			pageExports: hasDefault ? defaultExports : undefined,
			children: [],
		}
		current.children.push(indexNode)

		// Named exports become siblings (children of current, not of the index node)
		for (const exp of namedExports) {
			const namedSegment = exp.routePattern ? (computeRelativeSegment(currentPath, exp.routePattern) ?? exp.exportName) : exp.exportName
			checkCollision(current.children, namedSegment, file.absolutePath, exp.exportName)
			current.children.push({
				segment: namedSegment,
				fullPath: joinPath(currentPath, namedSegment),
				filePath: file.absolutePath,
				exportName: exp.exportName,
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				pageExports: [exp],
				children: [],
			})
		}
	} else {
		const allExports = await extractPageExportsFromFile(file, dirs, fileName, false, currentPath, moduleLoader)
		const defaultExports = allExports?.filter(e => e.exportName === 'default')
		const namedExports = allExports?.filter(e => e.exportName !== 'default') ?? []

		const hasDefault = defaultExports != null && defaultExports.length > 0
		const routeSegment = hasDefault ? deriveSegmentFromPageExports(defaultExports, currentPath) : undefined
		const segment = routeSegment ?? fileInfo.segment
		const fullPath = joinPath(currentPath, segment)

		if (hasDefault) {
			checkCollision(current.children, segment, file.absolutePath, 'default')
		}

		// Reuse existing container node (created by a previous file's named exports) if available
		let routeNode = !hasDefault ? current.children.find(c => c.segment === segment && !c.filePath && !c.isLayout && !c.isPathlessGroup) : undefined
		if (!routeNode) {
			routeNode = {
				segment,
				fullPath,
				filePath: hasDefault ? file.absolutePath : undefined,
				exportName: hasDefault ? 'default' : undefined,
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				pageExports: hasDefault ? defaultExports : undefined,
				children: [],
			}
			current.children.push(routeNode)
		}

		// Named exports become children (equivalent to files in a subdirectory)
		for (const exp of namedExports) {
			const namedSegment = exp.routePattern ? (computeRelativeSegment(fullPath, exp.routePattern) ?? exp.exportName) : exp.exportName
			checkCollision(routeNode.children, namedSegment, file.absolutePath, exp.exportName)
			routeNode.children.push({
				segment: namedSegment,
				fullPath: joinPath(fullPath, namedSegment),
				filePath: file.absolutePath,
				exportName: exp.exportName,
				isLayout: false,
				isIndex: false,
				isNotFound: false,
				isPathlessGroup: false,
				pageExports: [exp],
				children: [],
			})
		}
	}
}

/**
 * Derive page ID from file path and export name.
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

/**
 * Compute the relative route segment from a page's .route() pattern and parent path.
 */
function computeRelativeSegment(parentPath: string, routePattern: string): string | undefined {
	const prefix = parentPath === '/' ? '/' : parentPath + '/'

	if (routePattern.startsWith(prefix)) {
		return routePattern.slice(prefix.length)
	}

	if (routePattern === parentPath) {
		return undefined
	}

	const lastSlash = routePattern.lastIndexOf('/')
	return lastSlash >= 0 ? routePattern.slice(lastSlash + 1) : routePattern
}

function deriveSegmentFromPageExports(
	pageExports: PageExportInfo[] | undefined,
	parentPath: string,
): string | undefined {
	if (!pageExports || pageExports.length === 0) return undefined
	const firstRoute = pageExports[0].routePattern
	return computeRelativeSegment(parentPath, firstRoute)
}

async function extractPageExportsFromFile(
	file: ScannedFile,
	dirs: string[],
	fileName: string,
	isIndex: boolean,
	parentPath: string,
	moduleLoader: ModuleLoader,
): Promise<PageExportInfo[] | undefined> {
	let pages: ExtractedPage[]
	try {
		pages = await extractPages(file.absolutePath, moduleLoader)
	} catch {
		return undefined
	}

	if (pages.length === 0) return undefined

	const result: PageExportInfo[] = []

	for (const page of pages) {
		const pageId = derivePageId(dirs, fileName, isIndex, page.exportName)
		// If no explicit .route(), derive from file path — all params become query params
		const basePath = isIndex ? (parentPath || '/') : joinPath(parentPath, fileName)
		const routePattern = page.route ?? (page.isDefault ? basePath : joinPath(basePath, page.exportName))

		result.push({
			pageId,
			exportName: page.exportName,
			routePattern,
			params: page.params,
		})
	}

	return result.length > 0 ? result : undefined
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

/** Sort precedence: static routes first, then dynamic, catch-all, not-found last. */
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
