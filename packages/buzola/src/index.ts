// ─── Engine ─────────────────────────────────────────────────────────────────
export { LoaderCache } from './engine/loader-cache.js'

export { NavigationAbortedError, Router } from './engine/router.js'
export type { RouterOptions, RouterSubscriber } from './engine/router.js'

export { buildRouteTree, createRouteNode } from './engine/route-tree.js'
export type { CreateRouteNodeOptions } from './engine/route-tree.js'

export { matchRoutes } from './engine/matcher.js'

export { createBrowserNavigationAdapter, createMemoryNavigationAdapter } from './engine/navigation-adapter.js'
export type { MemoryNavigationAdapterOptions } from './engine/navigation-adapter.js'

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
	BlockerFn,
	BuzolaNavigateEvent,
	BuzolaPageMap,
	BuzolaPersistentParams,
	EffectivePageParams,
	NavigateOptions,
	NavigationAdapter,
	PageParams,
	RegisteredPage,
	RouteComponent,
	RouteConfig,
	RouteMatch,
	RouteNode,
	RouterState,
	StandardSchema,
} from './engine/types.js'

// ─── Schema ──────────────────────────────────────────────────────────────────
export { s } from './engine/schema.js'

// ─── Route definition ───────────────────────────────────────────────────────
export { BuzolaRedirect, createPage, redirect } from './define/create-page.js'
export type { CatchContext, PageDefinition, PageProps, RedirectFn } from './define/create-page.js'

// ─── React (re-export from subpath) ─────────────────────────────────────────
export {
	BuzolaProvider,
	ErrorBoundary,
	Link,
	Outlet,
	RouteContext,
	RouterContext,
	useBlocker,
	useInvalidate,
	useNavigate,
	useNavigationState,
	useParams,
	useRoute,
	useRouter,
	useRouterState,
	useSearchParams,
} from './react/index.js'
export type { BlockerState, BuzolaProviderProps, LinkProps, OutletProps, RouteContextValue } from './react/index.js'
