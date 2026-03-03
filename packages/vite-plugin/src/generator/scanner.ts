import * as fs from 'node:fs'
import * as path from 'node:path'
import { isRouteFile } from '../conventions'

export interface ScannedFile {
	/** Absolute path to the file. */
	absolutePath: string
	/** Path relative to the routes directory. */
	relativePath: string
}

/**
 * Scan a directory recursively for route files.
 */
export function scanRouteFiles(routesDir: string): ScannedFile[] {
	const files: ScannedFile[] = []

	function scan(dir: string): void {
		if (!fs.existsSync(dir)) return

		const entries = fs.readdirSync(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories
				if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
				scan(fullPath)
			} else if (entry.isFile() && isRouteFile(entry.name)) {
				files.push({
					absolutePath: fullPath,
					relativePath: path.relative(routesDir, fullPath),
				})
			}
		}
	}

	scan(routesDir)

	// Sort for deterministic output
	files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

	return files
}
