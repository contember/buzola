/**
 * Extract parameter names from a route pattern.
 * "/users/:userId/posts/:postId" → ["userId", "postId"]
 * "/:lang/users/:userId+" → ["lang", "userId"]
 */
export function extractParamNames(pattern: string): string[] {
	const names: string[] = []
	for (const segment of pattern.split('/')) {
		if (segment.startsWith(':')) {
			// Strip catch-all suffix (+)
			const name = segment.endsWith('+') ? segment.slice(1, -1) : segment.slice(1)
			names.push(name)
		}
	}
	return names
}
