import type { ReactElement } from 'react'
import { type ComponentType, use, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { PageLoaderState } from '../engine/loader-state.js'
import { isOptionalSchema, type ParamLiteral, resolveParamLiteral, validateSchema } from '../engine/schema.js'
import type { EffectivePageParams, RegisteredPage, RouteComponent, StandardSchema } from '../engine/types.js'
import { extractParamNames } from '../engine/utils.js'
import { RouteContext, RouterContext } from '../react/context.js'
import { ErrorBoundary } from '../react/error-boundary.js'

export interface PageProps<TParams> {
	params: TParams
}

export interface CatchContext {
	error: Error
	retry: () => void
}

type CatchHandler = React.ReactNode | ((ctx: CatchContext) => React.ReactNode)

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
	loader?: (ctx: { params: any; redirect: RedirectFn }) => Promise<unknown>
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

// ─── Redirect response ───────────────────────────────────────────────────────

export class BuzolaRedirect {
	readonly __buzolaRedirect = true
	constructor(
		readonly pageId: string,
		readonly params?: Record<string, string>,
	) {}
}

export type RedirectFn = <P extends RegisteredPage>(
	to: P,
	...args: [keyof EffectivePageParams<P>] extends [never] ? []
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		: {} extends EffectivePageParams<P> ? [params?: EffectivePageParams<P>]
		: [params: EffectivePageParams<P>]
) => BuzolaRedirect

export const redirect: RedirectFn = (pageId: string, params?: Record<string, string>): BuzolaRedirect => {
	return new BuzolaRedirect(pageId, params)
}

// ─── Loader helpers ─────────────────────────────────────────────────────────

type LoaderFn = (ctx: { params: any; redirect: RedirectFn }) => Promise<any>

function combineLoaders(loaders: LoaderFn[]): LoaderFn | undefined {
	if (loaders.length === 0) return undefined
	if (loaders.length === 1) return loaders[0]
	return async (ctx) => {
		const results = await Promise.all(loaders.map(fn => fn(ctx)))
		const redir = results.find(r => r instanceof BuzolaRedirect)
		if (redir) return redir
		return Object.assign({}, ...results)
	}
}

// ─── Component factory ──────────────────────────────────────────────────────

function createPageComponent<TParams>(
	schema: StandardSchema<TParams> | undefined,
	paramsMeta: ParamMeta[],
	loaderFn: LoaderFn | undefined,
	routePattern: string | undefined,
	RenderComponent: ComponentType<any>,
	catchHandler?: CatchHandler,
): PageDefinition<TParams> {
	const arrayParams = new Set(paramsMeta.filter(m => m.array).map(m => m.name))

	// Loader state lives in the closure, outside React's render cycle.
	// This is critical: when use() suspends, React discards uncommitted hook
	// state. The PageLoaderState instance survives Suspense retries.
	const loaderState = loaderFn ? new PageLoaderState() : undefined

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
				return validateSchema(schema, merged, 'Page params validation failed: ')
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

		let data: unknown
		let isLoading = false
		let shouldRedirect = false

		if (loaderFn && loaderState) {
			const currentUrlHref = routeContext.state.location.href
			const cacheKey = `${currentUrlHref}:${loaderKey}`

			const instruction = loaderState.resolve({
				currentUrlHref,
				cacheKey,
				load: () => loaderFn({ params, redirect }),
				loaderCache: router?.loaderCache,
				onBackgroundSettled: (outcome) => {
					if (outcome.ok) {
						if (outcome.result instanceof BuzolaRedirect) {
							router?.navigateToPage(outcome.result.pageId, outcome.result.params, { replace: true })
							return
						}
						loaderState.commitBackgroundResult(outcome.result)
					} else {
						loaderState.commitBackgroundError()
					}
					forceUpdate()
				},
			})

			if (instruction.action === 'render') {
				data = instruction.data
				isLoading = instruction.isLoading
			} else {
				const result = use(instruction.promise)
				if (result instanceof BuzolaRedirect) {
					router?.navigateToPage(result.pageId, result.params, { replace: true })
					shouldRedirect = true
				} else {
					data = result
					loaderState.commitResult(data)
				}
			}
		}

		// On unmount, save active data to stale cache and reset
		useEffect(() => {
			return () => loaderState?.dispose(router?.loaderCache)
		}, [])

		if (shouldRedirect) return null

		return <RenderComponent params={params} data={data} invalidate={invalidate} isLoading={isLoading} />
	}

	function BuzolaPageWithCatch(): ReactElement | null {
		const routeContext = use(RouteContext)
		const [retryCount, setRetryCount] = useState(0)
		const retry = useCallback(() => setRetryCount(c => c + 1), [])
		const resetKey = `${routeContext?.state.location.href ?? ''}:${retryCount}`
		const boundFallback = typeof catchHandler === 'function'
			? (error: Error) => (catchHandler as (ctx: CatchContext) => React.ReactNode)({ error, retry })
			: catchHandler
		return (
			<ErrorBoundary fallback={boundFallback} resetKey={resetKey}>
				<BuzolaPage key={retryCount} />
			</ErrorBoundary>
		)
	}

	const component = catchHandler ? BuzolaPageWithCatch : BuzolaPage

	return {
		__buzolaPage: true,
		component: component as unknown as RouteComponent,
		route: routePattern,
		paramsSchema: schema as StandardSchema | undefined,
		paramsMeta,
		loader: loaderFn,
	}
}

// ─── Builder ────────────────────────────────────────────────────────────────

interface WithCatch<TParams, TRenderProps> {
	route<R extends string>(
		pattern: [ExtractRouteParams<R>] extends [keyof TParams & string] ? R : never,
	): { render(fn: ComponentType<TRenderProps>): PageDefinition<TParams> }
	render(fn: ComponentType<TRenderProps>): PageDefinition<TParams>
}

interface WithRoute<TParams, TRenderProps> {
	catch(handler: CatchHandler): WithCatch<TParams, TRenderProps>
	route<R extends string>(
		pattern: [ExtractRouteParams<R>] extends [keyof TParams & string] ? R : never,
	): {
		catch(handler: CatchHandler): { render(fn: ComponentType<TRenderProps>): PageDefinition<TParams> }
		render(fn: ComponentType<TRenderProps>): PageDefinition<TParams>
	}
	render(fn: ComponentType<TRenderProps>): PageDefinition<TParams>
}

interface WithLoaderChain<TParams, TData>
	extends WithRoute<TParams, PageProps<TParams> & { data: TData; invalidate: () => void; isLoading: boolean }>
{
	loader<TNew extends Record<string, unknown>>(
		fn: (ctx: { params: TParams; redirect: RedirectFn }) => Promise<TNew | BuzolaRedirect>,
	): WithLoaderChain<TParams, TData & TNew>
}

interface WithLoader<TParams> extends WithRoute<TParams, PageProps<TParams>> {
	loader<TData extends Record<string, unknown>>(
		fn: (ctx: { params: TParams; redirect: RedirectFn }) => Promise<TData | BuzolaRedirect>,
	): WithLoaderChain<TParams, TData>
}

interface PageBuilder {
	params<T extends ParamsShape>(shape: T): WithLoader<InferShape<T>>
	params<T extends Record<string, unknown>>(schema: StandardSchema<T>): WithLoader<T>
	loader<TData extends Record<string, unknown>>(
		fn: (ctx: { params: Record<string, never>; redirect: RedirectFn }) => Promise<TData | BuzolaRedirect>,
	): WithLoaderChain<Record<string, never>, TData>
	catch(handler: CatchHandler): WithCatch<Record<string, never>, PageProps<Record<string, never>>>
	route<R extends string>(
		pattern: [ExtractRouteParams<R>] extends [never] ? R : never,
	): {
		catch(handler: CatchHandler): { render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition }
		render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition
	}
	render(fn: ComponentType<PageProps<Record<string, never>>>): PageDefinition
}

function withCatchAndRender(
	schema: StandardSchema | undefined,
	paramsMeta: ParamMeta[],
	loaders: LoaderFn[],
	catchHandler: CatchHandler,
) {
	return {
		route(pattern: string) {
			return {
				render(fn: ComponentType<any>) {
					return createPageComponent(schema, paramsMeta, combineLoaders(loaders), pattern, fn, catchHandler)
				},
			}
		},
		render(fn: ComponentType<any>) {
			return createPageComponent(schema, paramsMeta, combineLoaders(loaders), undefined, fn, catchHandler)
		},
	}
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
		catch(handler: CatchHandler) {
			return withCatchAndRender(schema, paramsMeta, loaders, handler)
		},
		route(pattern: string) {
			return {
				catch(handler: CatchHandler) {
					return {
						render(fn: ComponentType<any>) {
							return createPageComponent(schema, paramsMeta, combineLoaders(loaders), pattern, fn, handler)
						},
					}
				},
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
