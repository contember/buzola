import type { ReactElement } from 'react'
import { type ComponentType, use, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { isOptionalSchema, type ParamLiteral, resolveParamLiteral } from '../engine/schema'
import type { RouteComponent, StandardSchema } from '../engine/types'
import { extractParamNames } from '../engine/utils'
import { RouteContext, RouterContext } from '../react/context'

export interface PageProps<TParams> {
	params: TParams
}

export interface ParamMeta {
	name: string
	optional: boolean
	array: boolean
}

export interface PageDefinition<TParams = Record<string, never>> {
	__buzolaPage: true
	component: RouteComponent
	route?: string
	paramsSchema?: StandardSchema
	paramsMeta: ParamMeta[]
	loader?: (ctx: { params: any }) => Promise<unknown>
}

// ─── Route pattern type safety ──────────────────────────────────────────────

/**
 * Extract dynamic parameter names from a route pattern at the type level.
 * "/users/:userId/posts/:postId" → "userId" | "postId"
 * "/:slug+" → "slug"
 */
type ExtractRouteParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
	? (Param extends `${infer P}+` ? P : Param) | ExtractRouteParams<Rest>
	: T extends `${string}:${infer Param}` ? (Param extends `${infer P}+` ? P : Param)
	: never

// ─── Schema helpers ──────────────────────────────────────────────────────────

type ParamField = StandardSchema | ParamLiteral
type ParamsShape = Record<string, ParamField>

type ScalarType<T extends string> = T extends 'string' ? string
	: T extends 'number' ? number
	: T extends 'uuid' ? string
	: never

type LiteralToType<L extends string> = L extends `?${infer Base}[]` ? ScalarType<Base>[] | undefined
	: L extends `${infer Base}[]` ? ScalarType<Base>[]
	: L extends `?${infer Base}` ? ScalarType<Base> | undefined
	: ScalarType<L>

type InferShape<T extends ParamsShape> = {
	[K in keyof T]: T[K] extends StandardSchema<infer V> ? V : T[K] extends string ? LiteralToType<T[K]> : never
}

function isStandardSchema(value: StandardSchema | ParamsShape): value is StandardSchema {
	return '~standard' in value
}

function resolveParamsInput<T>(input: StandardSchema<T> | ParamsShape): {
	schema: StandardSchema<T>
	paramsMeta: ParamMeta[]
} {
	if (isStandardSchema(input)) {
		return {
			schema: input,
			paramsMeta: (input as any).__buzolaKeys ?? [],
		}
	}

	const shape = input
	const paramsMeta: ParamMeta[] = []
	const fieldSchemas: Record<string, StandardSchema> = {}

	for (const [name, field] of Object.entries(shape)) {
		if (typeof field === 'string') {
			const resolved = resolveParamLiteral(field)
			fieldSchemas[name] = resolved.schema
			paramsMeta.push({ name, optional: resolved.optional, array: resolved.array })
		} else {
			fieldSchemas[name] = field
			paramsMeta.push({ name, optional: isOptionalSchema(field), array: false })
		}
	}

	const schema: StandardSchema<T> = {
		'~standard': {
			version: 1,
			vendor: 'buzola',
			validate: (v) => {
				const record = (v ?? {}) as Record<string, unknown>
				const result: Record<string, unknown> = {}
				for (const [key, fs] of Object.entries(fieldSchemas)) {
					const r = fs['~standard'].validate(record[key])
					if ('issues' in r) return r
					result[key] = r.value
				}
				return { value: result } as { value: T }
			},
		},
	}

	return { schema, paramsMeta }
}

// ─── Loader helpers ─────────────────────────────────────────────────────────

type LoaderFn = (ctx: { params: any }) => Promise<any>

function combineLoaders(loaders: LoaderFn[]): LoaderFn | undefined {
	if (loaders.length === 0) return undefined
	if (loaders.length === 1) return loaders[0]
	return async (ctx) => Object.assign({}, ...await Promise.all(loaders.map(fn => fn(ctx))))
}

// ─── Component factory ──────────────────────────────────────────────────────

function createPageComponent<TParams>(
	schema: StandardSchema<TParams> | undefined,
	paramsMeta: ParamMeta[],
	loaderFn: LoaderFn | undefined,
	routePattern: string | undefined,
	RenderComponent: ComponentType<any>,
): PageDefinition<TParams> {
	const arrayParams = new Set(paramsMeta.filter(m => m.array).map(m => m.name))

	// Loader promise cache lives in the closure, outside React's render cycle.
	// This is critical: when use() suspends during the initial render, React
	// discards all uncommitted hook state (useRef, useState, useMemo).
	// On retry, hooks reinitialize, and useMemo/useRef would create a new promise,
	// causing an infinite suspend loop. The closure cache survives this.
	let cachedUrlHref: string | null = null
	let cachedLoaderKey: string | null = null
	let cachedLoaderPromise: Promise<unknown> | null = null
	let cachedResolvedData: unknown = undefined
	let hasResolvedOnce = false
	let pendingBackgroundKey: string | null = null

	function BuzolaPage(): ReactElement | null {
		const routeContext = use(RouteContext)
		if (!routeContext) {
			throw new Error('createPage component must be used within a <BuzolaProvider>')
		}

		const router = use(RouterContext)

		const params = useMemo(() => {
			const { state, matches, params: pathParams } = routeContext

			const currentMatch = matches.find(m => m.node.component === BuzolaPage)
			const pathParamNames = new Set(
				currentMatch ? extractParamNames(currentMatch.node.fullPath) : [],
			)

			const merged: Record<string, string | string[]> = {}

			if (arrayParams.size > 0) {
				for (const name of arrayParams) {
					if (pathParamNames.has(name)) continue
					const values = [
						...state.location.searchParams.getAll(name),
						...state.location.searchParams.getAll(`${name}[]`),
					]
					if (values.length > 0) merged[name] = values
				}
			}

			state.location.searchParams.forEach((value, key) => {
				const cleanKey = key.endsWith('[]') ? key.slice(0, -2) : key
				if (!pathParamNames.has(cleanKey) && !(cleanKey in merged)) {
					merged[cleanKey] = value
				}
			})

			for (const [key, value] of Object.entries(pathParams)) {
				if (arrayParams.has(key)) {
					merged[key] = value.split(',')
				} else {
					merged[key] = value
				}
			}

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

		const [loaderKey, setLoaderKey] = useState(0)
		const [, forceUpdate] = useReducer(x => x + 1, 0)
		const invalidate = useCallback(() => setLoaderKey(k => k + 1), [])

		// Subscribe to router-level invalidation
		useEffect(() => {
			if (!router) return
			return router.onInvalidate(() => setLoaderKey(k => k + 1))
		}, [router])

		let data: unknown = undefined
		let isLoading = false

		if (loaderFn) {
			const currentUrlHref = routeContext.state.location.href
			const cacheKey = `${currentUrlHref}:${loaderKey}`

			// URL changed — reset SWR state, next load suspends via use()
			if (cachedUrlHref !== null && cachedUrlHref !== currentUrlHref) {
				hasResolvedOnce = false
				cachedResolvedData = undefined
				pendingBackgroundKey = null
			}
			cachedUrlHref = currentUrlHref

			if (cachedLoaderKey === cacheKey) {
				// Cache hit — check if background load is pending
				if (pendingBackgroundKey === cacheKey) {
					data = cachedResolvedData
					isLoading = true
				} else {
					// Either resolved or first-time suspend
					if (hasResolvedOnce) {
						data = cachedResolvedData
					} else {
						data = use(cachedLoaderPromise!)
						cachedResolvedData = data
						hasResolvedOnce = true
					}
				}
			} else if (hasResolvedOnce) {
				// Cache key changed + we have stale data → background reload (SWR)
				const promise = loaderFn({ params })
				cachedLoaderKey = cacheKey
				cachedLoaderPromise = promise
				pendingBackgroundKey = cacheKey
				data = cachedResolvedData
				isLoading = true

				promise.then(
					(result) => {
						// Only apply if this is still the active load
						if (cachedLoaderKey === cacheKey) {
							cachedResolvedData = result
							pendingBackgroundKey = null
							forceUpdate()
						}
					},
					(error) => {
						// Store rejected promise so use() triggers ErrorBoundary
						if (cachedLoaderKey === cacheKey) {
							cachedLoaderPromise = promise
							hasResolvedOnce = false
							pendingBackgroundKey = null
							forceUpdate()
						}
					},
				)
			} else {
				// No stale data — first load, suspend via use()
				const promise = loaderFn({ params })
				cachedLoaderKey = cacheKey
				cachedLoaderPromise = promise
				data = use(promise)
				cachedResolvedData = data
				hasResolvedOnce = true
			}
		}

		return <RenderComponent params={params} data={data} invalidate={invalidate} isLoading={isLoading} />
	}

	return {
		__buzolaPage: true,
		component: BuzolaPage as unknown as RouteComponent,
		route: routePattern,
		paramsSchema: schema as StandardSchema | undefined,
		paramsMeta,
		loader: loaderFn,
	}
}

// ─── Builder ────────────────────────────────────────────────────────────────

interface WithRoute<TParams, TRenderProps> {
	route<R extends string>(
		pattern: [ExtractRouteParams<R>] extends [keyof TParams & string] ? R : never,
	): { render(fn: ComponentType<TRenderProps>): PageDefinition<TParams> }
	render(fn: ComponentType<TRenderProps>): PageDefinition<TParams>
}

interface WithLoaderChain<TParams, TData>
	extends WithRoute<TParams, PageProps<TParams> & { data: TData; invalidate: () => void; isLoading: boolean }>
{
	loader<TNew extends Record<string, unknown>>(
		fn: (ctx: { params: TParams }) => Promise<TNew>,
	): WithLoaderChain<TParams, TData & TNew>
}

interface WithLoader<TParams> extends WithRoute<TParams, PageProps<TParams>> {
	loader<TData extends Record<string, unknown>>(
		fn: (ctx: { params: TParams }) => Promise<TData>,
	): WithLoaderChain<TParams, TData>
}

interface PageBuilder {
	params<T extends ParamsShape>(shape: T): WithLoader<InferShape<T>>
	params<T extends Record<string, unknown>>(schema: StandardSchema<T>): WithLoader<T>
	loader<TData extends Record<string, unknown>>(
		fn: (ctx: { params: Record<string, never> }) => Promise<TData>,
	): WithLoaderChain<Record<string, never>, TData>
	route<R extends string>(
		pattern: [ExtractRouteParams<R>] extends [never] ? R : never,
	): { render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition }
	render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition
}

function withRouteAndRender(
	schema: StandardSchema | undefined,
	paramsMeta: ParamMeta[],
	loaders: LoaderFn[],
) {
	return {
		loader(loaderFn: LoaderFn) {
			return withRouteAndRender(schema, paramsMeta, [...loaders, loaderFn])
		},
		route(pattern: string) {
			return {
				render(fn: ComponentType<any>) {
					return createPageComponent(schema, paramsMeta, combineLoaders(loaders), pattern, fn)
				},
			}
		},
		render(fn: ComponentType<any>) {
			return createPageComponent(schema, paramsMeta, combineLoaders(loaders), undefined, fn)
		},
	}
}

export function createPage(): PageBuilder {
	return {
		params(input: StandardSchema | ParamsShape) {
			const { schema, paramsMeta } = resolveParamsInput(input)
			return withRouteAndRender(schema, paramsMeta, [])
		},
		...withRouteAndRender(undefined, [], []),
	} as PageBuilder
}
