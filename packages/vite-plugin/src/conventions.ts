import * as path from 'node:path'

/**
 * File naming conventions for page-centric routing.
 *
 * layout.tsx    → Layout wrapper (renders children via <Outlet />)
 * index.tsx     → Index route (renders at parent's exact path)
 * about.tsx     → Named page file (page ID derived from file name)
 * (group)/      → Pathless group (no URL segment)
 *
 * Route patterns (URL paths) come exclusively from `.route()` on `createPage()`.
 * File names only determine page IDs and layout nesting.
 */

export const ROUTE_FILE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']

export interface ParsedRouteFile {
	/** The route segment this file contributes. */
	segment: string
	/** Whether this is a layout file. */
	isLayout: boolean
	/** Whether this is an index file. */
	isIndex: boolean
	/** Whether this directory is a pathless group. */
	isPathlessGroup: boolean
	/** Original file path relative to routes dir. */
	relativePath: string
}

/**
 * Check if a file is a route file based on extension.
 */
export function isRouteFile(filePath: string): boolean {
	return ROUTE_FILE_EXTENSIONS.some(ext => filePath.endsWith(ext))
}

/**
 * Parse a directory name for routing conventions.
 */
export function parseDirName(name: string): { segment: string; isPathlessGroup: boolean } {
	// Pathless group: (auth)
	if (name.startsWith('(') && name.endsWith(')')) {
		return { segment: '', isPathlessGroup: true }
	}

	return { segment: name, isPathlessGroup: false }
}

/**
 * Parse a route file name (without extension) into routing info.
 */
export function parseFileName(nameWithoutExt: string): {
	segment: string
	isLayout: boolean
	isIndex: boolean
} {
	if (nameWithoutExt === 'layout') {
		return { segment: '', isLayout: true, isIndex: false }
	}

	if (nameWithoutExt === 'index') {
		return { segment: '', isLayout: false, isIndex: true }
	}

	return { segment: nameWithoutExt, isLayout: false, isIndex: false }
}

/**
 * Parse a route file path relative to the routes directory.
 */
export function parseRouteFile(relativePath: string): ParsedRouteFile {
	const ext = path.extname(relativePath)
	const withoutExt = relativePath.slice(0, -ext.length)
	const parts = withoutExt.split(path.sep)
	const fileName = parts.pop()!
	const dirs = parts

	const fileInfo = parseFileName(fileName)

	// Build segment from directory path + file
	const segments: string[] = []
	let isPathlessGroup = false

	for (const dir of dirs) {
		const dirInfo = parseDirName(dir)
		if (dirInfo.isPathlessGroup) {
			isPathlessGroup = true
		} else {
			segments.push(dirInfo.segment)
		}
	}

	if (fileInfo.segment) {
		segments.push(fileInfo.segment)
	}

	const segment = segments.length > 0 ? segments.join('/') : ''

	return {
		segment,
		isLayout: fileInfo.isLayout,
		isIndex: fileInfo.isIndex,
		isPathlessGroup,
		relativePath,
	}
}
