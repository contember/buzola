/**
 * Parse a dynamic route segment (e.g., ":userId" or ":slug+").
 * Returns the parameter name and whether it's a catch-all.
 */
export function parseParamSegment(segment: string): { name: string; isCatchAll: boolean } {
	const isCatchAll = segment.endsWith('+')
	const name = isCatchAll ? segment.slice(1, -1) : segment.slice(1)
	return { name, isCatchAll }
}

/**
 * Extract parameter names from a route pattern.
 * "/users/:userId/posts/:postId" → ["userId", "postId"]
 * "/:lang/users/:userId+" → ["lang", "userId"]
 */
export function extractParamNames(pattern: string): string[] {
	const names: string[] = []
	for (const segment of pattern.split('/')) {
		if (segment.startsWith(':')) {
			names.push(parseParamSegment(segment).name)
		}
	}
	return names
}

/**
 * Whether two URLs address the same page — i.e. only search/hash differ.
 * Same-path navigations (filters, sorting, pagination, search) keep the page
 * on screen and keep focus where it is; path changes do not.
 */
export function isSamePath(a: string | URL, b: string | URL): boolean {
	const urlA = typeof a === 'string' ? new URL(a) : a
	const urlB = typeof b === 'string' ? new URL(b) : b
	return urlA.origin === urlB.origin && urlA.pathname === urlB.pathname
}
