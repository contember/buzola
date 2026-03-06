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
		const pageExports = await extractPageExportsFromFile(file, dirs, '', true, currentPath, moduleLoader)
		const indexNode: FileRouteNode = {
			segment: '',
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: true,
			isNotFound: false,
			isPathlessGroup: false,
			pageExports,
			children: [],
		}
		current.children.push(indexNode)
	} else {
		const pageExports = await extractPageExportsFromFile(file, dirs, fileName, false, currentPath, moduleLoader)
		const routeSegment = deriveSegmentFromPageExports(pageExports, currentPath)
		const segment = routeSegment ?? fileInfo.segment
		const fullPath = joinPath(currentPath, segment)
		const routeNode: FileRouteNode = {
			segment,
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: false,
			isNotFound: false,
			isPathlessGroup: false,
			pageExports,
			children: [],
		}
		current.children.push(routeNode)
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
		const routePattern = page.route ?? (isIndex ? (parentPath || '/') : joinPath(parentPath, fileName))

		result.push({
			pageId,
			routePattern,
			params: page.params,
		})
	}

	return result.length > 0 ? result : undefined
}

function sortChildren(node: FileRouteNode): void {
	for (const child of node.children) {
		sortChildren(child)
	}

	node.children.sort((a, b) => sortWeight(a) - sortWeight(b))
}

function sortWeight(node: FileRouteNode): number {
	if (node.isIndex) return 0
	if (node.isNotFound) return 4
	if (node.segment.includes(':') && node.segment.includes('+')) return 3
	if (node.segment.includes(':')) return 2
	return 1
}

function joinPath(parent: string, child: string): string {
	if (!child) return parent || '/'
	const base = parent || ''
	return `${base}/${child}`
}
