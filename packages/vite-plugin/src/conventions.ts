import * as path from 'node:path'

/**
 * File naming conventions for file-based routing.
 *
 * layout.tsx    → Layout wrapper (renders children via <Outlet />)
 * index.tsx     → Index route (renders at parent's exact path)
 * about.tsx     → Named route (→ /about)
 * [param].tsx   → Dynamic segment (→ /:param)
 * [...slug].tsx → Catch-all (→ /:slug+)
 * (group)/      → Pathless group (no URL segment)
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
	/** Whether this is a catch-all route. */
	isCatchAll: boolean
	/** The dynamic parameter name, if any. */
	paramName?: string
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
export function parseDirName(name: string): { segment: string; isPathlessGroup: boolean; paramName?: string } {
	// Pathless group: (auth)
	if (name.startsWith('(') && name.endsWith(')')) {
		return { segment: '', isPathlessGroup: true }
	}

	// Dynamic segment: [userId]
	if (name.startsWith('[') && name.endsWith(']')) {
		const inner = name.slice(1, -1)
		// Catch-all: [...slug]
		if (inner.startsWith('...')) {
			return { segment: `:${inner.slice(3)}+`, isPathlessGroup: false, paramName: inner.slice(3) }
		}
		return { segment: `:${inner}`, isPathlessGroup: false, paramName: inner }
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
	isCatchAll: boolean
	paramName?: string
} {
	if (nameWithoutExt === 'layout') {
		return { segment: '', isLayout: true, isIndex: false, isCatchAll: false }
	}

	if (nameWithoutExt === 'index') {
		return { segment: '', isLayout: false, isIndex: true, isCatchAll: false }
	}

	// Dynamic segment file: [userId].tsx
	if (nameWithoutExt.startsWith('[') && nameWithoutExt.endsWith(']')) {
		const inner = nameWithoutExt.slice(1, -1)
		// Catch-all: [...slug].tsx
		if (inner.startsWith('...')) {
			const paramName = inner.slice(3)
			return { segment: `:${paramName}+`, isLayout: false, isIndex: false, isCatchAll: true, paramName }
		}
		return { segment: `:${inner}`, isLayout: false, isIndex: false, isCatchAll: false, paramName: inner }
	}

	return { segment: nameWithoutExt, isLayout: false, isIndex: false, isCatchAll: false }
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
		isCatchAll: fileInfo.isCatchAll,
		paramName: fileInfo.paramName,
		relativePath,
	}
}
