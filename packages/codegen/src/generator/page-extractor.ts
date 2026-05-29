export interface ExtractedPage {
	/** Export name (e.g., "detail", "list"). "default" for default exports. */
	exportName: string
	/** Explicit route pattern from .route('...'), if present. */
	route?: string
	/** Whether this is a default export. */
	isDefault: boolean
	/** Extracted param info from .params(z.object({...})). */
	params: ExtractedParam[]
}

export interface ExtractedParam {
	name: string
	optional: boolean
	array: boolean
}

export type ModuleLoader = (absolutePath: string) => Promise<Record<string, unknown>>

function isPageDefinition(value: unknown): value is {
	__buzolaPage: true
	route?: string
	paramsMeta: { name: string; optional: boolean; array: boolean }[]
} {
	return value != null && typeof value === 'object' && '__buzolaPage' in value && (value as any).__buzolaPage === true
}

/**
 * Extract createPage() metadata by loading the module and inspecting exports.
 */
export async function extractPages(absolutePath: string, loadModule: ModuleLoader): Promise<ExtractedPage[]> {
	const mod = await loadModule(absolutePath)
	const pages: ExtractedPage[] = []

	for (const [key, value] of Object.entries(mod)) {
		if (!isPageDefinition(value)) continue

		const exportName = key === 'default' ? 'default' : key
		pages.push({
			exportName,
			isDefault: key === 'default',
			route: value.route,
			params: value.paramsMeta ?? [],
		})
	}

	return pages
}
