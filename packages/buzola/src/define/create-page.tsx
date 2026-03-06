import type { ReactElement } from 'react'
import { type ComponentType, use, useMemo } from 'react'
import type { RouteComponent, StandardSchema } from '../engine/types'
import { extractParamNames } from '../engine/utils'
import { RouteContext } from '../react/context'

export interface PageProps<TParams> {
	params: TParams
}

export interface PageDefinition<TParams = Record<string, never>> {
	__buzolaPage: true
	component: RouteComponent
	route?: string
	paramsSchema?: StandardSchema
}

function createPageComponent<TParams>(
	schema: StandardSchema<TParams> | undefined,
	routePattern: string | undefined,
	RenderComponent: ComponentType<PageProps<TParams>>,
): PageDefinition<TParams> {
	function BuzolaPage(): ReactElement | null {
		const routeContext = use(RouteContext)
		if (!routeContext) {
			throw new Error('createPage component must be used within a <BuzolaProvider>')
		}

		const params = useMemo(() => {
			const { state, matches, params: pathParams } = routeContext

			// Find the current match to determine which params are path params
			// by looking at the route node's fullPath
			const currentMatch = matches.find(m => m.node.component === BuzolaPage)
			const pathParamNames = new Set(
				currentMatch ? extractParamNames(currentMatch.node.fullPath) : [],
			)

			// Merge: start with search params, then overlay path params (path wins)
			const merged: Record<string, string> = {}

			// Add search params that are NOT path params
			state.location.searchParams.forEach((value, key) => {
				if (!pathParamNames.has(key)) {
					merged[key] = value
				}
			})

			// Add path params (override search params)
			Object.assign(merged, pathParams)

			if (schema) {
				const result = schema['~standard'].validate(merged)
				if ('issues' in result) {
					throw new Error(
						`Page params validation failed: ${result.issues.map(i => i.message).join(', ')}`,
					)
				}
				return result.value
			}

			return merged as TParams
		}, [routeContext])

		return <RenderComponent params={params} />
	}

	return {
		__buzolaPage: true,
		component: BuzolaPage as unknown as RouteComponent,
		route: routePattern,
		paramsSchema: schema as StandardSchema | undefined,
	}
}

export function createPage() {
	return {
		params<T>(schema: StandardSchema<T>) {
			return {
				route(pattern: string) {
					return {
						render(fn: ComponentType<PageProps<T>>): PageDefinition<T> {
							return createPageComponent(schema, pattern, fn)
						},
					}
				},
				render(fn: ComponentType<PageProps<T>>): PageDefinition<T> {
					return createPageComponent(schema, undefined, fn)
				},
			}
		},
		route(pattern: string) {
			return {
				render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition {
					return createPageComponent(undefined, pattern, fn)
				},
			}
		},
		render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition {
			return createPageComponent(undefined, undefined, fn)
		},
	}
}
