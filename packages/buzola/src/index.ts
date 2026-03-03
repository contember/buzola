// ─── Engine ─────────────────────────────────────────────────────────────────
export { NavigationAbortedError, Router } from './engine/router'
export type { RouterOptions, RouterSubscriber } from './engine/router'

export { buildRouteTree, createRouteNode } from './engine/route-tree'
export type { CreateRouteNodeOptions } from './engine/route-tree'

export { matchRoutes } from './engine/matcher'

export { createBrowserNavigationAdapter, createMemoryNavigationAdapter } from './engine/navigation-adapter'
export type { MemoryNavigationAdapterOptions } from './engine/navigation-adapter'

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
	BlockerFn,
	BuzolaNavigateEvent,
	BuzolaRouteMap,
	GuardContext,
	GuardRedirect,
	NavigateOptions,
	NavigationAdapter,
	ParamsForPath,
	RegisteredParams,
	RegisteredPath,
	RouteComponent,
	RouteConfig,
	RouteGuard,
	RouteGuardResult,
	RouteMatch,
	RouteNode,
	RouterState,
	StandardSchema,
} from './engine/types'

// ─── Route definition ───────────────────────────────────────────────────────
export { defineRoute, defineRoutes } from './define/define-routes'
export type { DefineRouteOptions, RouteBuilderFn, RouteDefinitionOptions } from './define/define-routes'

// ─── React (re-export from subpath) ─────────────────────────────────────────
export {
	BuzolaProvider,
	ErrorBoundary,
	Link,
	Outlet,
	RouteContext,
	RouterContext,
	useBlocker,
	useNavigate,
	useNavigationState,
	useParams,
	useRoute,
	useRouter,
	useRouterState,
	useSearchParams,
} from './react/index'
export type { BlockerState, BuzolaProviderProps, LinkProps, OutletProps, RouteContextValue } from './react/index'
