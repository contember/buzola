import * as path from 'node:path'
import { parseDirName, parseFileName } from '../conventions'
import type { ScannedFile } from './scanner'

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
	/** Children nodes. */
	children: FileRouteNode[]
}

/**
 * Build a route tree from scanned files.
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
		const indexNode: FileRouteNode = {
			segment: '',
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: true,
			isPathlessGroup: false,
			isCatchAll: false,
			paramNames: accumulatedParams,
			children: [],
		}
		current.children.push(indexNode)
	} else {
		// Regular or dynamic route
		const fullPath = joinPath(currentPath, fileInfo.segment)
		const fileParams = fileInfo.paramName
			? [...accumulatedParams, fileInfo.paramName]
			: accumulatedParams
		const routeNode: FileRouteNode = {
			segment: fileInfo.segment,
			fullPath,
			filePath: file.absolutePath,
			isLayout: false,
			isIndex: false,
			isPathlessGroup: false,
			isCatchAll: fileInfo.isCatchAll,
			paramNames: fileParams,
			children: [],
		}
		current.children.push(routeNode)
	}
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
